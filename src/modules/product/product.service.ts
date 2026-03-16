import { prisma } from '../../config/prisma.js';
import toSlug from '../../common/utils/slug.js';
import { toUpperUnderscore } from '../../common/utils/format.js';
import { AppError } from '../../common/errors/app-error.js';
import type { Prisma } from '@prisma/client';
import type { CreateProductDto, UpdateProductDto, PatchProductDto, BulkPatchProductDto, ProductListQuery } from './product.types.js';

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

const parseVariantPrice = (val: unknown, fallback: number) => {
	if (val === null || val === undefined) return fallback;
	if (typeof val === 'number' && Number.isFinite(val)) return val;
	if (typeof val === 'string') {
 		const t = val.trim();
 		if (t === '') return fallback;
 		const n = Number(t);
 		return Number.isFinite(n) ? n : fallback;
 	}

	return fallback;
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
				return attribute.pairs.map((pair) => {
					const basePrice = parseVariantPrice((pair as any).price, payload.basePrice);
					const finalPrice = calculateFinalPrice(basePrice, payload.discountType, payload.discountValue);
					return {
						productId: created.id,
						attributeId,
						attributeValue: pair.value,
						basePrice,
						finalPrice,
						galleryImage: (pair as any).galleryImage ?? null
					};
				});
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

const getProducts = async ({
	page = 1,
	limit = 20,
	searchTerm,
	category,
	brand,
	minPrice,
	maxPrice
}: ProductListQuery = {}) => {
	const skip = (page - 1) * limit;

	const where: Prisma.ProductWhereInput = {};

	if (searchTerm) {
		where.OR = [
			{ name: { contains: searchTerm, mode: 'insensitive' } },
			{ sku: { contains: searchTerm, mode: 'insensitive' } }
		];
	}

	if (category) {
		const categories = Array.isArray(category) ? category : category.split('&');
		where.categories = {
			some: {
				category: {
					slug: { in: categories }
				}
			}
		};
	}

	if (brand) {
		const brands = Array.isArray(brand) ? brand : brand.split('&');
		where.brand = {
			slug: { in: brands }
		};
	}

	if (minPrice !== undefined || maxPrice !== undefined) {
		where.finalPrice = {};
		if (minPrice !== undefined) {
			where.finalPrice.gte = minPrice;
		}
		if (maxPrice !== undefined) {
			where.finalPrice.lte = maxPrice;
		}
	}

	const [data, total] = await Promise.all([
		prisma.product.findMany({
			where,
			skip,
			take: limit,
			orderBy: { createdAt: 'desc' },
			include: {
				brand: true,
				categories: { include: { category: true } },
				tags: { include: { tag: true } },
				additionalInformations: true,
				seos: true,
				productVariations: { include: { attribute: true } },
				productReviews: { include: { user: true } }
			}
		}),
		prisma.product.count({ where })
	]);

	const meta = {
		page,
		limit,
		total,
		totalPages: Math.max(1, Math.ceil(total / limit))
	};

	return { data, meta };
};

const getProductsLimited = async ({ count = 10, searchTerm, category, brand, minPrice, maxPrice }: { count?: number; searchTerm?: string; category?: string | string[]; brand?: string | string[]; minPrice?: number; maxPrice?: number } = {}) => {
	const where: Prisma.ProductWhereInput = {};

	if (searchTerm) {
		where.OR = [
			{ name: { contains: searchTerm, mode: 'insensitive' } },
			{ sku: { contains: searchTerm, mode: 'insensitive' } }
		];
	}

	if (category) {
		const categories = Array.isArray(category) ? category : String(category).split('&');
		where.categories = {
			some: {
				category: {
					slug: { in: categories }
				}
			}
		};
	}

	if (brand) {
		const brands = Array.isArray(brand) ? brand : String(brand).split('&');
		where.brand = {
			slug: { in: brands }
		};
	}

	if (minPrice !== undefined || maxPrice !== undefined) {
		where.finalPrice = {};
		if (minPrice !== undefined) {
			where.finalPrice.gte = minPrice;
		}
		if (maxPrice !== undefined) {
			where.finalPrice.lte = maxPrice;
		}
	}

	return prisma.product.findMany({
		where,
		take: count,
		orderBy: { createdAt: 'desc' },
		include: {
			brand: true,
			categories: { include: { category: true } },
			tags: { include: { tag: true } },
			additionalInformations: true,
			seos: true,
			productVariations: { include: { attribute: true } },
			productReviews: { include: { user: true } }
		}
	});
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
 			productVariations: { include: { attribute: true } },
			productReviews: {
				where: { parentId: null },
				include: {
					user: {
						select: {
							id: true,
							email: true,
							customers: { select: { phone: true } },
							admins: { select: { name: true, image: true } }
						}
					},
					replies: {
						include: {
							user: {
								select: {
									id: true,
									email: true,
									customers: { select: { phone: true } },
									admins: { select: { name: true, image: true } }
								}
							}
						},
						orderBy: { createdAt: 'asc' }
					}
				},
				orderBy: { createdAt: 'desc' }
			}
 		}
 	});
};

const getHotDeals = async (count: number = 10) => {
	return prisma.product.findMany({
		where: {
			discountType: { not: 'NONE' },
			discountValue: { not: null }
		},
		take: count,
		orderBy: { discountValue: 'desc' },
		include: {
			brand: true,
			categories: { include: { category: true } },
			tags: { include: { tag: true } },
			additionalInformations: true,
			seos: true,
			productVariations: { include: { attribute: true } },
			productReviews: { include: { user: true } }
		}
	});
};

const getNewArrivals = async (count: number = 10) => {
	return prisma.product.findMany({
		take: count,
		orderBy: { createdAt: 'desc' },
		include: {
			brand: true,
			categories: { include: { category: true } },
			tags: { include: { tag: true } },
			additionalInformations: true,
			seos: true,
			productVariations: { include: { attribute: true } },
			productReviews: { include: { user: true } }
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

const updateProduct = async (id: string, payload: UpdateProductDto) => {
	return prisma.$transaction(async (tx) => {
		const existing = await tx.product.findUnique({
			where: { id },
			select: { id: true, name: true, slug: true }
		});
		if (!existing) {
			throw new AppError(404, 'Product not found', [
				{ message: 'No product found with the provided id', code: 'PRODUCT_NOT_FOUND' }
			]);
		}

		const brand = await tx.brand.findUnique({ where: { id: payload.brandId }, select: { id: true } });
		if (!brand) {
			throw new AppError(400, 'Brand not found', [
				{ message: 'Provided brandId does not match any brand', code: 'BRAND_NOT_FOUND' }
			]);
		}

		if (payload.sku) {
			const existingSku = await tx.product.findFirst({
				where: { sku: payload.sku, id: { not: id } },
				select: { id: true }
			});
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

		const attributeNames = Array.from(new Set(payload.attributes.map((a) => a.name.trim()).filter(Boolean)));
		const attributeRecords = attributeNames.length > 0
			? await tx.attribute.findMany({
				where: { OR: attributeNames.map((name) => ({ name: { equals: name, mode: 'insensitive' } })) },
				select: { id: true, name: true }
			})
			: [];

		const normalizedAttributeMap = new Map(
			attributeRecords.map((attr) => [toUpperUnderscore(attr.name), { id: attr.id, name: attr.name }])
		);

		for (const name of attributeNames) {
			const normalizedName = toUpperUnderscore(name);
			if (!normalizedAttributeMap.has(normalizedName)) {
				const slug = toSlug(name);
				const createdAttr = await tx.attribute.create({ data: { name, slug, values: [] } });
				normalizedAttributeMap.set(normalizedName, { id: createdAttr.id, name: createdAttr.name });
			}
		}

		const attributeMap = new Map(Array.from(normalizedAttributeMap.entries()).map(([k, v]) => [k, v.id]));

		let slug = existing.slug;
		if (payload.name.trim().toLowerCase() !== existing.name.trim().toLowerCase()) {
			slug = await generateUniqueSlugTx(tx, payload.name);
		}

		const volume = payload.length != null && payload.width != null && payload.height != null
			? payload.length * payload.width * payload.height
			: null;
		const finalPrice = calculateFinalPrice(payload.basePrice, payload.discountType, payload.discountValue);

		await tx.product.update({
			where: { id },
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

		await Promise.all([
			tx.categoriesOnProducts.deleteMany({ where: { productId: id } }),
			tx.tagsOnProducts.deleteMany({ where: { productId: id } }),
			tx.additionalInformation.deleteMany({ where: { productId: id } }),
			tx.seo.deleteMany({ where: { productId: id } })
		]);

		if (categoryIds.length > 0) {
			await tx.categoriesOnProducts.createMany({
				data: categoryIds.map((categoryId) => ({ productId: id, categoryId }))
			});
		}

		if (tagIds.length > 0) {
			await tx.tagsOnProducts.createMany({
				data: tagIds.map((tagId) => ({ productId: id, tagId }))
			});
		}

		if (payload.additionalInformations.length > 0) {
			await tx.additionalInformation.createMany({
				data: payload.additionalInformations.map((item) => ({
					productId: id,
					name: item.name,
					value: item.value
				}))
			});
		}

		if (Array.isArray(payload.attributes)) {
			if (payload.attributes.length > 0) {
				await tx.productVariation.deleteMany({ where: { productId: id } });
				const variations = payload.attributes.flatMap((attribute) => {
					const normalizedName = toUpperUnderscore(attribute.name);
					const attributeId = attributeMap.get(normalizedName) as string;
					return attribute.pairs.map((pair) => {
						const basePrice = parseVariantPrice((pair as any).price, payload.basePrice);
						const finalPrice = calculateFinalPrice(basePrice, payload.discountType, payload.discountValue);
						return {
							productId: id,
							attributeId,
							attributeValue: pair.value,
							basePrice,
							finalPrice,
							galleryImage: (pair as any).galleryImage ?? null
						};
					});
				});
				if (variations.length > 0) {
					await tx.productVariation.createMany({ data: variations });
				}
			} else {
				await tx.productVariation.deleteMany({ where: { productId: id } });
			}
		} else {
			const existingVars = await tx.productVariation.findMany({ where: { productId: id }, select: { id: true, basePrice: true } });
			for (const v of existingVars) {
				const finalP = calculateFinalPrice(v.basePrice, payload.discountType, payload.discountValue);
				await tx.productVariation.update({ where: { id: v.id }, data: { finalPrice: finalP } });
			}
		}

		if (payload.seo && (payload.seo.title.trim() || payload.seo.description || payload.seo.keyword.length > 0)) {
			await tx.seo.create({
				data: {
					productId: id,
					title: payload.seo.title,
					description: payload.seo.description ?? null,
					keyword: payload.seo.keyword
				}
			});
		}

		return tx.product.findUnique({
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
	});
};

const patchProduct = async (id: string, payload: PatchProductDto) => {
	const existing = await prisma.product.findUnique({ where: { id }, select: { id: true } });
	if (!existing) {
		throw new AppError(404, 'Product not found', [
			{ message: 'No product found with the provided id', code: 'PRODUCT_NOT_FOUND' }
		]);
	}

	return prisma.product.update({
		where: { id },
		data: {
			...(payload.status !== undefined && { status: payload.status }),
			...(payload.stockStatus !== undefined && { stockStatus: payload.stockStatus })
		},
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

const bulkPatchProducts = async (payload: BulkPatchProductDto) => {
	const result = await prisma.product.updateMany({
		where: { id: { in: payload.ids } },
		data: {
			...(payload.status !== undefined && { status: payload.status }),
			...(payload.stockStatus !== undefined && { stockStatus: payload.stockStatus })
		}
	});
	return result;
};

export const productService = {
 	createProduct,
	getProducts,
	getProductsLimited,
	getAllProducts,
	getProductById,
	getHotDeals,
	getNewArrivals,
	deleteProduct,
	updateProduct,
	patchProduct,
	bulkPatchProducts
};
