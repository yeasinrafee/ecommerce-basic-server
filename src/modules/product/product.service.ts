import { prisma } from '../../config/prisma.js';
import toSlug from '../../common/utils/slug.js';
import { toUpperUnderscore } from '../../common/utils/format.js';
import { AppError } from '../../common/errors/app-error.js';
import type { Prisma } from '@prisma/client';
import type { CreateProductDto } from './product.types.js';

const generateUniqueSlugTx = async (tx: Prisma.TransactionClient, name: string) => {
	const base = toSlug(name);
	let slug = base;
	let counter = 1;

	while (true) {
		const found = await tx.product.findFirst({ where: { slug }, select: { id: true } });
		if (!found) {
			return slug;
		}
		slug = `${base}-${counter++}`;
	}
};

const calculateFinalPrice = (basePrice: number, discountType: CreateProductDto['discountType'], discountValue?: number | null) => {
	const value = discountValue ?? 0;

	switch (discountType) {
		case 'FLAT_DISCOUNT':
			return Math.max(0, basePrice - value);
		case 'PERCENTAGE_DISCOUNT':
			return Math.max(0, basePrice - basePrice * (value / 100));
		default:
			return basePrice;
	}
};

const createProduct = async (payload: CreateProductDto) => {
	return prisma.$transaction(async (tx) => {
		const brand = await tx.brand.findUnique({ where: { id: payload.brandId }, select: { id: true } });
		if (!brand) {
			throw new AppError(400, 'Brand not found', [
				{ message: 'Provided brandId does not match any brand', code: 'BRAND_NOT_FOUND' }
			]);
		}

		if (payload.sku) {
			const existingSku = await tx.product.findFirst({ where: { sku: payload.sku }, select: { id: true } });
			if (existingSku) {
				throw new AppError(400, 'SKU already exists', [
					{ message: 'Another product uses the provided SKU', code: 'SKU_CONFLICT' }
				]);
			}
		}

		const categoryIds = Array.from(new Set(payload.categoryIds));
		const tagIds = Array.from(new Set(payload.tagIds));

		const [categories, tags] = await Promise.all([
			tx.productCategory.findMany({ where: { id: { in: categoryIds } }, select: { id: true } }),
			tx.productTag.findMany({ where: { id: { in: tagIds } }, select: { id: true } })
		]);

		if (categories.length !== categoryIds.length) {
			throw new AppError(400, 'Invalid categories', [
				{ message: 'One or more selected categories do not exist', code: 'CATEGORY_NOT_FOUND' }
			]);
		}

		if (tags.length !== tagIds.length) {
			throw new AppError(400, 'Invalid tags', [
				{ message: 'One or more selected tags do not exist', code: 'TAG_NOT_FOUND' }
			]);
		}

		const attributeNames = Array.from(new Set(payload.attributes.map((attribute) => attribute.name.trim()).filter(Boolean)));
		const attributeRecords = attributeNames.length > 0
			? await tx.attribute.findMany({
				where: {
					OR: attributeNames.map((name) => ({
						name: { equals: name, mode: 'insensitive' }
					}))
				},
				select: { id: true, name: true }
			})
			: [];

		const normalizedAttributeMap = new Map(attributeRecords.map((attribute) => [
			toUpperUnderscore(attribute.name),
			{ id: attribute.id, name: attribute.name }
		]));

		for (const name of attributeNames) {
			const normalizedName = toUpperUnderscore(name);
			if (!normalizedAttributeMap.has(normalizedName)) {
				const slug = toSlug(name);
				const createdAttribute = await tx.attribute.create({ data: { name, slug, values: [] } });
				normalizedAttributeMap.set(normalizedName, { id: createdAttribute.id, name: createdAttribute.name });
			}
		}

		const attributeMap = new Map(Array.from(normalizedAttributeMap.entries()).map(([key, value]) => [key, value.id]));
		const slug = await generateUniqueSlugTx(tx, payload.name);
		const volume = payload.length != null && payload.width != null && payload.height != null
			? payload.length * payload.width * payload.height
			: null;
		const finalPrice = calculateFinalPrice(payload.basePrice, payload.discountType, payload.discountValue);

		const created = await tx.product.create({
			data: {
				name: payload.name,
				slug,
				shortDescription: payload.shortDescription ?? null,
				description: payload.description,
				Baseprice: payload.basePrice,
				finalPrice,
				discountType: payload.discountType,
				discountValue: payload.discountType === 'NONE' ? null : payload.discountValue ?? null,
				stock: payload.stock,
				weight: payload.weight ?? null,
				length: payload.length ?? null,
				width: payload.width ?? null,
				height: payload.height ?? null,
				volume,
				sku: payload.sku ?? null,
				discountStartDate: payload.discountStartDate ?? null,
				discountEndDate: payload.discountEndDate ?? null,
				brandId: payload.brandId,
				image: payload.image,
				galleryImages: payload.galleryImages,
				status: payload.status,
				stockStatus: payload.stockStatus
			}
		});

		if (categoryIds.length > 0) {
			await tx.categoriesOnProducts.createMany({
				data: categoryIds.map((categoryId) => ({ productId: created.id, categoryId }))
			});
		}

		if (tagIds.length > 0) {
			await tx.tagsOnProducts.createMany({
				data: tagIds.map((tagId) => ({ productId: created.id, tagId }))
			});
		}

		if (payload.additionalInformations.length > 0) {
			await tx.additionalInformation.createMany({
				data: payload.additionalInformations.map((item) => ({
					productId: created.id,
					name: item.name,
					value: item.value
				}))
			});
		}

		if (payload.attributes.length > 0) {
			const variations = payload.attributes.flatMap((attribute) => {
				const normalizedName = toUpperUnderscore(attribute.name);
				const attributeId = attributeMap.get(normalizedName) as string;
				return attribute.pairs.map((pair) => ({
					productId: created.id,
					attributeId,
					attributeValue: pair.value,
					price: pair.price ?? 0,
					galleryImage: pair.galleryImage ?? null
				}));
			});

			if (variations.length > 0) {
				await tx.productVariation.createMany({ data: variations });
			}
		}

		if (payload.seo && (payload.seo.title.trim() || payload.seo.description || payload.seo.keyword.length > 0)) {
			await tx.seo.create({
				data: {
					productId: created.id,
					title: payload.seo.title,
					description: payload.seo.description ?? null,
					keyword: payload.seo.keyword
				}
			});
		}

		return tx.product.findUnique({
			where: { id: created.id },
			include: {
				brand: true,
				categories: {
					include: {
						category: true
					}
				},
				tags: {
					include: {
						tag: true
					}
				},
				additionalInformations: true,
				seos: true,
				productVariations: {
					include: {
						attribute: true
					}
				}
			}
		});
	});
};

const getProducts = async ({ page = 1, limit = 20 }: { page?: number; limit?: number }) => {
	const skip = (page - 1) * limit;
	const [data, total] = await Promise.all([
		prisma.product.findMany({
 			skip,
 			take: limit,
 			orderBy: { createdAt: 'desc' },
 			include: {
 				brand: true,
 				categories: { include: { category: true } },
 				tags: { include: { tag: true } },
 				additionalInformations: true,
 				seos: true,
 				productVariations: { include: { attribute: true } }
 			}
 		}),
 		prisma.product.count()
 	]);

	const meta = { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };

	return { data, meta };
};

const getAllProducts = async () => {
 	return prisma.product.findMany({
 		orderBy: { createdAt: 'desc' },
 		include: {
 			brand: true,
 			categories: { include: { category: true } },
 			tags: { include: { tag: true } },
 			additionalInformations: true,
 			seos: true,
 			productVariations: { include: { attribute: true } }
 		}
 	});
};

const getProductById = async (id: string) => {
 	return prisma.product.findUnique({
 		where: { id },
 		include: {
 			brand: true,
 			categories: { include: { category: true } },
 			tags: { include: { tag: true } },
 			additionalInformations: true,
 			seos: true,
 			productVariations: { include: { attribute: true } }
 		}
 	});
};

const deleteProduct = async (id: string) => {
 	return prisma.$transaction(async (tx) => {
 		await tx.productVariation.deleteMany({ where: { productId: id } });
 		await tx.categoriesOnProducts.deleteMany({ where: { productId: id } });
 		await tx.tagsOnProducts.deleteMany({ where: { productId: id } });
 		await tx.additionalInformation.deleteMany({ where: { productId: id } });
 		await tx.seo.deleteMany({ where: { productId: id } });
 		await tx.product.delete({ where: { id } });
 		return true;
 	});
};

export const productService = {
 	createProduct,
	getProducts,
	getAllProducts,
	getProductById,
	deleteProduct
};
