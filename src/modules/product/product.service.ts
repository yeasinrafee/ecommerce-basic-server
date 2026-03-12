import { prisma } from '../../config/prisma.js';
import toSlug from '../../common/utils/slug.js';
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

		const duplicateAttribute = payload.attributes.find((attribute) => attribute.pairs.length > 1);
		if (duplicateAttribute) {
			throw new AppError(400, 'Invalid attributes', [
				{ message: `Only one value is supported for attribute ${duplicateAttribute.name}`, code: 'ATTRIBUTE_VALUE_LIMIT' }
			]);
		}

		const attributeNames = Array.from(new Set(payload.attributes.map((attribute) => attribute.name.trim()).filter(Boolean)));
		const attributeRecords = attributeNames.length > 0
			? await tx.attribute.findMany({ where: { name: { in: attributeNames } }, select: { id: true, name: true } })
			: [];

		if (attributeRecords.length !== attributeNames.length) {
			const attributeNameSet = new Set(attributeRecords.map((attribute) => attribute.name));
			const missingAttribute = attributeNames.find((name) => !attributeNameSet.has(name));
			throw new AppError(400, 'Invalid attributes', [
				{ message: `Attribute ${missingAttribute ?? ''} was not found`, code: 'ATTRIBUTE_NOT_FOUND' }
			]);
		}

		const attributeMap = new Map(attributeRecords.map((attribute) => [attribute.name, attribute.id]));
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
			await tx.productVariation.createMany({
				data: payload.attributes.map((attribute) => ({
					productId: created.id,
					attributeId: attributeMap.get(attribute.name) as string,
					attributeValue: attribute.pairs[0]?.value,
					price: attribute.pairs[0]?.price ?? 0,
					galleryImage: attribute.galleryImage ?? null
				}))
			});
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

export const productService = {
	createProduct
};
