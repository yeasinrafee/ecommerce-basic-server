import { prisma } from '../../config/prisma.js';
import toSlug from '../../common/utils/slug.js';
import { toUpperUnderscore } from '../../common/utils/format.js';
import { AppError } from '../../common/errors/app-error.js';
import type { CreateCategoryDto, UpdateCategoryDto, ServiceListResult, CategoryListQuery } from './product-category.types.js';

import type { Prisma } from '@prisma/client';

const getCategories = async ({ page = 1, limit = 10, searchTerm }: CategoryListQuery = {}): Promise<ServiceListResult<any>> => {
    const skip = (page - 1) * limit;
    const where: Prisma.ProductCategoryWhereInput = searchTerm
        ? { name: { contains: searchTerm, mode: 'insensitive' } }
        : {};

    const [data, total] = await Promise.all([
        prisma.productCategory.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' }
        }),
        prisma.productCategory.count({ where })
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
    return prisma.productCategory.findUnique({ where: { id } });
};

const createCategory = async ({ name }: CreateCategoryDto) => {
    const cleanNameKey = toUpperUnderscore(name);
    const slug = toSlug(name);

    const existing = await prisma.productCategory.findMany({ select: { id: true, name: true } });
    const conflict = existing.find((c) => toUpperUnderscore(c.name) === cleanNameKey);
    if (conflict) {
        throw new AppError(400, 'Category name already exists', [
            { message: 'A category with that name exists', code: 'NAME_CONFLICT' }
        ]);
    }

    const created = await prisma.productCategory.create({ data: { name, slug } });
    return created;
};

const updateCategory = async (id: string, payload: UpdateCategoryDto) => {
    const existing = await prisma.productCategory.findUnique({ where: { id } });
    if (!existing) {
        throw new AppError(404, 'Category not found', [
            { message: 'No category exists with the provided id', code: 'NOT_FOUND' }
        ]);
    }

    if (payload.name) {
        const cleanNameKey = toUpperUnderscore(payload.name);
        const slug = toSlug(payload.name);

        const others = await prisma.productCategory.findMany({ where: { NOT: { id } }, select: { id: true, name: true } });
        const conflict = others.find((c) => toUpperUnderscore(c.name) === cleanNameKey);
        if (conflict) {
            throw new AppError(400, 'Category name already exists', [
                { message: 'Another category uses this name', code: 'NAME_CONFLICT' }
            ]);
        }

        return prisma.productCategory.update({ where: { id }, data: { name: payload.name, slug } });
    }

    return prisma.productCategory.update({ where: { id }, data: payload as any });
};

const deleteCategory = async (id: string) => {
    await prisma.productCategory.delete({ where: { id } });
    return true;
};

const getAllCategories = async () => {
    return prisma.productCategory.findMany({ orderBy: { createdAt: 'desc' } });
};

export const productCategoryService = {
    getCategories,
    getCategoryById,
    getAllCategories,
    createCategory,
    updateCategory,
    deleteCategory
};
