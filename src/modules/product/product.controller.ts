import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { sendResponse } from '../../common/utils/send-response.js';
import { AppError } from '../../common/errors/app-error.js';
import { deleteCloudinaryAsset, uploadMultipleFilesToCloudinary } from '../../common/utils/file-upload.js';
import { productService } from './product.service.js';

const nullableNumberSchema = z.preprocess(
	(value) => {
		if (value === '' || value === null || value === undefined) {
			return null;
		}
		return Number(value);
	},
	z.number().nullable()
);

const nullablePositiveNumberSchema = z.preprocess(
	(value) => {
		if (value === '' || value === null || value === undefined) {
			return null;
		}
		return Number(value);
	},
	z.number().positive().nullable()
);

const nullableDateSchema = z.preprocess(
	(value) => {
		if (value === '' || value === null || value === undefined) {
			return null;
		}
		return new Date(String(value));
	},
	z.date().nullable()
);

const createProductBodySchema = z.object({
	name: z.string().trim().min(1, 'Product name is required'),
	shortDescription: z.preprocess((value) => {
		if (value === '' || value === null || value === undefined) {
			return null;
		}
		return String(value).trim();
	}, z.string().nullable()),
	description: z.string().trim().min(1, 'Description is required'),
	basePrice: z.coerce.number().nonnegative(),
	discountType: z.enum(['NONE', 'FLAT_DISCOUNT', 'PERCENTAGE_DISCOUNT']),
	discountValue: nullableNumberSchema,
	discountStartDate: nullableDateSchema,
	discountEndDate: nullableDateSchema,
	stock: z.coerce.number().int().nonnegative(),
	sku: z.preprocess((value) => {
		if (value === '' || value === null || value === undefined) {
			return null;
		}
		return String(value).trim();
	}, z.string().nullable()),
	weight: nullablePositiveNumberSchema,
	length: nullablePositiveNumberSchema,
	width: nullablePositiveNumberSchema,
	height: nullablePositiveNumberSchema,
	brandId: z.string().trim().min(1, 'Brand is required'),
	status: z.enum(['ACTIVE', 'INACTIVE']),
	stockStatus: z.enum(['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK']),
	categories: z.array(z.string().trim().min(1)).min(1, 'At least one category is required'),
	tags: z.array(z.string().trim().min(1)).min(1, 'At least one tag is required'),
	galleryImagesMeta: z.array(z.object({ id: z.string().trim().min(1), name: z.string().trim().min(1) })),
	attributes: z.array(
		z.object({
			name: z.string().trim().min(1),
			pairs: z.array(
				z.object({
					value: z.string().trim().min(1),
					price: nullableNumberSchema
				})
			).min(1),
			imageId: z.string().trim().optional().nullable()
		})
	),
	additionalInfo: z.array(
		z.object({
			name: z.string().trim().min(1),
			value: z.string().trim().min(1)
		})
	),
	seo: z.object({
		metaTitle: z.preprocess((value) => {
			if (value === '' || value === null || value === undefined) {
				return '';
			}
			return String(value).trim();
		}, z.string()),
		metaDescription: z.preprocess((value) => {
			if (value === '' || value === null || value === undefined) {
				return '';
			}
			return String(value).trim();
		}, z.string()),
		seoKeywords: z.array(z.string().trim().min(1))
	}).nullable()
}).superRefine((data, ctx) => {
	const hasWeight = data.weight != null;
	const hasDimensions = data.length != null && data.width != null && data.height != null;

	if (!hasWeight && !hasDimensions) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			path: ['weight'],
			message: 'Provide weight or all three dimensions'
		});
	}

	if (data.discountType !== 'NONE' && data.discountValue == null) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			path: ['discountValue'],
			message: 'Discount value is required when a discount type is selected'
		});
	}

	if (data.discountStartDate && data.discountEndDate && data.discountEndDate < data.discountStartDate) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			path: ['discountEndDate'],
			message: 'Discount end date must be after the start date'
		});
	}

	const seoProvided = Boolean(data.seo && (data.seo.metaTitle || data.seo.metaDescription || data.seo.seoKeywords.length > 0));
	if (seoProvided && !data.seo?.metaTitle) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			path: ['seo', 'metaTitle'],
			message: 'SEO meta title is required when SEO data is provided'
		});
	}
});

const parseJsonField = <T,>(value: unknown, fallback: T): T => {
	if (value === undefined || value === null || value === '') {
		return fallback;
	}

	if (typeof value !== 'string') {
		return value as T;
	}

	try {
		return JSON.parse(value) as T;
	} catch {
		throw new AppError(400, 'Invalid payload', [
			{ message: 'One or more JSON fields could not be parsed', code: 'INVALID_JSON_PAYLOAD' }
		]);
	}
};

const createProduct = async (req: Request, res: Response) => {
	const files = req.files as Record<string, Express.Multer.File[]> | undefined;
	const mainImageFile = files?.mainImage?.[0] ?? null;
	const galleryFiles = files?.galleryImages ?? [];

	if (!mainImageFile) {
		throw new AppError(400, 'Main image is required', [
			{ message: 'Please upload a product image', code: 'MAIN_IMAGE_REQUIRED' }
		]);
	}

	const parsed = createProductBodySchema.parse({
		name: req.body.name,
		shortDescription: req.body.shortDescription,
		description: req.body.description,
		basePrice: req.body.basePrice,
		discountType: req.body.discountType,
		discountValue: req.body.discountValue,
		discountStartDate: req.body.discountStartDate,
		discountEndDate: req.body.discountEndDate,
		stock: req.body.stock,
		sku: req.body.sku,
		weight: req.body.weight,
		length: req.body.length,
		width: req.body.width,
		height: req.body.height,
		brandId: req.body.brandId,
		status: req.body.status,
		stockStatus: req.body.stockStatus,
		categories: parseJsonField(req.body.categories, [] as string[]),
		tags: parseJsonField(req.body.tags, [] as string[]),
		galleryImagesMeta: parseJsonField(req.body.galleryImagesMeta, [] as { id: string; name: string }[]),
		attributes: parseJsonField(req.body.attributes, [] as { name: string; pairs: { value: string; price?: number | null }[]; imageId?: string | null }[]),
		additionalInfo: parseJsonField(req.body.additionalInfo, [] as { name: string; value: string }[]),
		seo: parseJsonField(req.body.seo, null as { metaTitle: string; metaDescription: string; seoKeywords: string[] } | null)
	});

	if (galleryFiles.length !== parsed.galleryImagesMeta.length) {
		throw new AppError(400, 'Invalid gallery images', [
			{ message: 'Gallery image metadata does not match uploaded files', code: 'GALLERY_IMAGE_MISMATCH' }
		]);
	}

	const galleryIdSet = new Set(parsed.galleryImagesMeta.map((item) => item.id));
	const invalidAttributeImage = parsed.attributes.find((attribute) => attribute.imageId && !galleryIdSet.has(attribute.imageId));
	if (invalidAttributeImage) {
		throw new AppError(400, 'Invalid attribute image selection', [
			{ message: `Attribute ${invalidAttributeImage.name} references a gallery image that was not uploaded`, code: 'ATTRIBUTE_IMAGE_NOT_FOUND' }
		]);
	}

	const uploadEntityId = crypto.randomUUID();
	const uploadedPublicIds: string[] = [];

	try {
		const [mainImageUpload] = await uploadMultipleFilesToCloudinary([mainImageFile], {
			projectFolder: 'products',
			entityId: uploadEntityId,
			subFolder: 'main',
			fileNamePrefix: 'product'
		});

		uploadedPublicIds.push(mainImageUpload.publicId);

		const galleryUploads = galleryFiles.length > 0
			? await uploadMultipleFilesToCloudinary(galleryFiles, {
					projectFolder: 'products',
					entityId: uploadEntityId,
					subFolder: 'gallery',
					fileNamePrefix: 'gallery'
				})
			: [];

		uploadedPublicIds.push(...galleryUploads.map((uploaded) => uploaded.publicId));

		const galleryUrlByClientId = new Map<string, string>();
		parsed.galleryImagesMeta.forEach((item, index) => {
			const uploaded = galleryUploads[index];
			if (uploaded) {
				galleryUrlByClientId.set(item.id, uploaded.secureUrl);
			}
		});

		const created = await productService.createProduct({
			name: parsed.name,
			shortDescription: parsed.shortDescription,
			description: parsed.description,
			basePrice: parsed.basePrice,
			discountType: parsed.discountType,
			discountValue: parsed.discountValue,
			discountStartDate: parsed.discountStartDate,
			discountEndDate: parsed.discountEndDate,
			stock: parsed.stock,
			sku: parsed.sku,
			weight: parsed.weight,
			length: parsed.length,
			width: parsed.width,
			height: parsed.height,
			brandId: parsed.brandId,
			image: mainImageUpload.secureUrl,
			galleryImages: galleryUploads.map((uploaded) => uploaded.secureUrl),
			status: parsed.status,
			stockStatus: parsed.stockStatus,
			categoryIds: parsed.categories,
			tagIds: parsed.tags,
			attributes: parsed.attributes.map((attribute) => ({
				name: attribute.name,
				pairs: attribute.pairs.map((pair) => ({ value: pair.value, price: pair.price ?? null })),
				galleryImage: attribute.imageId ? galleryUrlByClientId.get(attribute.imageId) ?? null : null
			})),
			additionalInformations: parsed.additionalInfo,
			seo: parsed.seo && (parsed.seo.metaTitle || parsed.seo.metaDescription || parsed.seo.seoKeywords.length > 0)
				? {
						title: parsed.seo.metaTitle,
						description: parsed.seo.metaDescription || null,
						keyword: parsed.seo.seoKeywords
					}
				: null
		});

		sendResponse({
			res,
			statusCode: 201,
			success: true,
			message: 'Product created',
			data: created
		});
	} catch (error) {
		await Promise.allSettled(uploadedPublicIds.map((publicId) => deleteCloudinaryAsset(publicId)));
		throw error;
	}
};

export const productController = {
	createProduct
};
