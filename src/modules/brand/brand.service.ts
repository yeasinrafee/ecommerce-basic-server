import { prisma } from '../../config/prisma.js';
import toSlug from '../../common/utils/slug.js';
import { toUpperUnderscore } from '../../common/utils/format.js';
import { AppError } from '../../common/errors/app-error.js';
import type { CreateBrandDto, UpdateBrandDto, ServiceListResult, BrandListQuery } from './brand.types.js';

import type { Prisma } from '@prisma/client';

const getBrands = async ({ page = 1, limit = 10, searchTerm }: BrandListQuery = {}): Promise<ServiceListResult<any>> => {
	const skip = (page - 1) * limit;
	const where: Prisma.BrandWhereInput = searchTerm
		? { name: { contains: searchTerm, mode: 'insensitive' } }
		: {};

	const [data, total] = await Promise.all([
		prisma.brand.findMany({
			where,
			skip,
			take: limit,
			orderBy: { createdAt: 'desc' }
		}),
		prisma.brand.count({ where })
	]);

	return {
		data,
		meta: {
			page,
			limit,
			total,
			totalPages: Math.max(1, Math.ceil(total / limit))
		}
	};
};

const getBrandById = async (id: string) => {
	return prisma.brand.findUnique({ where: { id } });
};

const createBrand = async ({ name }: CreateBrandDto) => {
	const cleanNameKey = toUpperUnderscore(name);
	const slug = toSlug(name);

	const existing = await prisma.brand.findMany({ select: { id: true, name: true } });
	const conflict = existing.find((c) => toUpperUnderscore(c.name) === cleanNameKey);
	if (conflict) {
		throw new AppError(400, 'Brand name already exists', [
			{ message: 'A brand with that name exists', code: 'NAME_CONFLICT' }
		]);
	}

	const created = await prisma.brand.create({ data: { name, slug } });
	return created;
};

const updateBrand = async (id: string, payload: UpdateBrandDto) => {
	const existing = await prisma.brand.findUnique({ where: { id } });
	if (!existing) {
		throw new AppError(404, 'Brand not found', [
			{ message: 'No brand exists with the provided id', code: 'NOT_FOUND' }
		]);
	}

	if (payload.name) {
		const cleanNameKey = toUpperUnderscore(payload.name);
		const slug = toSlug(payload.name);

		const others = await prisma.brand.findMany({ where: { NOT: { id } }, select: { id: true, name: true } });
		const conflict = others.find((c) => toUpperUnderscore(c.name) === cleanNameKey);
		if (conflict) {
			throw new AppError(400, 'Brand name already exists', [
				{ message: 'Another brand uses this name', code: 'NAME_CONFLICT' }
			]);
		}

		return prisma.brand.update({ where: { id }, data: { name: payload.name, slug } });
	}

	return prisma.brand.update({ where: { id }, data: payload as any });
};

const deleteBrand = async (id: string) => {
	await prisma.brand.delete({ where: { id } });
	return true;
};

const getAllBrands = async () => {
	return prisma.brand.findMany({ orderBy: { createdAt: 'desc' } });
};

export const brandService = {
	getBrands,
	getBrandById,
	getAllBrands,
	createBrand,
	updateBrand,
	deleteBrand
};

