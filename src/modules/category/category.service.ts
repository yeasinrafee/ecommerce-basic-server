import { prisma } from '../../config/prisma.js';
import toSlug from '../../common/utils/slug.js';
import { toUpperUnderscore } from '../../common/utils/format.js';
import type { CreateCategoryDto, UpdateCategoryDto, ServiceListResult, CategoryListQuery } from './category.types.js';

const getCategories = async ({ page = 1, limit = 10 }: CategoryListQuery = {}): Promise<ServiceListResult<any>> => {
	const skip = (page - 1) * limit;

	const [data, total] = await Promise.all([
		prisma.category.findMany({
			skip,
			take: limit,
			orderBy: { createdAt: 'desc' }
		}),
		prisma.category.count()
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

const getCategoryById = async (id: string) => {
	return prisma.category.findUnique({ where: { id } });
};

const createCategory = async ({ name }: CreateCategoryDto) => {
	const cleanNameKey = toUpperUnderscore(name);
	const slug = toSlug(name);

	const existingBySlug = await prisma.category.findUnique({ where: { slug } });
	if (existingBySlug) throw new Error('Category slug already exists');

	const existing = await prisma.category.findMany({ select: { id: true, name: true } });
	const conflict = existing.find((c) => toUpperUnderscore(c.name) === cleanNameKey);
	if (conflict) throw new Error('Category name already exists');

	const created = await prisma.category.create({ data: { name, slug } });
	return created;
};

const updateCategory = async (id: string, payload: UpdateCategoryDto) => {
	const existing = await prisma.category.findUnique({ where: { id } });
	if (!existing) throw new Error('Category not found');

	if (payload.name) {
		const cleanNameKey = toUpperUnderscore(payload.name);
		const slug = toSlug(payload.name);

		
		const bySlug = await prisma.category.findUnique({ where: { slug } });
		if (bySlug && bySlug.id !== id) throw new Error('Category slug already exists');

		
		const others = await prisma.category.findMany({ where: { NOT: { id } }, select: { id: true, name: true } });
		const conflict = others.find((c) => toUpperUnderscore(c.name) === cleanNameKey);
		if (conflict) throw new Error('Category name already exists');

		return prisma.category.update({ where: { id }, data: { name: payload.name, slug } });
	}

	return prisma.category.update({ where: { id }, data: payload as any });
};

const deleteCategory = async (id: string) => {
	await prisma.category.delete({ where: { id } });
	return true;
};

export const categoryService = {
	getCategories,
	getCategoryById,
	createCategory,
	updateCategory,
	deleteCategory
};

