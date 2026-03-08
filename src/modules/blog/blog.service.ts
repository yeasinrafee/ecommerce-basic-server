import { prisma } from '../../config/prisma.js';
import { AppError } from '../../common/errors/app-error.js';
import type { CreateBlogDto, UpdateBlogDto, ServiceListResult, BlogListQuery } from './blog.types.js';
import { deleteCloudinaryAsset, getPublicIdFromUrl } from '../../common/utils/file-upload.js';

import type { Prisma } from '@prisma/client';

const getBlogs = async ({ page = 1, limit = 10, searchTerm }: BlogListQuery = {}): Promise<ServiceListResult<any>> => {
    const skip = (page - 1) * limit;
    const where: Prisma.BlogWhereInput = searchTerm
        ? { title: { contains: searchTerm, mode: 'insensitive' } }
        : {};

    const [data, total] = await Promise.all([
        prisma.blog.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: {
                category: true,
                tags: { include: { tag: true } },
                user: true
            }
        }),
        prisma.blog.count({ where })
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

const getBlogById = async (id: string) => {
    return prisma.blog.findUnique({ where: { id }, include: { category: true, tags: { include: { tag: true } }, user: true } });
};

const createBlog = async ({ title, image, authorName, shortDescription, content, categoryId, tagIds = [], userId }: CreateBlogDto) => {
    const created = await prisma.blog.create({
        data: {
            title,
            image,
            authorName,
            shortDescription,
            content,
            category: { connect: { id: categoryId } },
            user: userId ? { connect: { id: userId } } : undefined,
            tags: tagIds && tagIds.length > 0 ? { create: tagIds.map((t) => ({ tag: { connect: { id: t } } })) } : undefined
        },
        include: { category: true, tags: { include: { tag: true } }, user: true }
    });

    return created;
};

const updateBlog = async (id: string, payload: UpdateBlogDto, newUploadedPublicId?: string | null) => {
    const existing = await prisma.blog.findUnique({ where: { id } });
    if (!existing) {
        throw new AppError(404, 'Blog not found', [{ message: 'No blog exists with the provided id', code: 'NOT_FOUND' }]);
    }

    const previousPublicId = getPublicIdFromUrl(existing.image) ?? null;

    const updated = await prisma.$transaction(async (tx) => {
        const data: any = {};

        if (payload.title) data.title = payload.title;
        if (payload.image !== undefined) data.image = payload.image;
        if (payload.authorName) data.authorName = payload.authorName;
        if (payload.shortDescription) data.shortDescription = payload.shortDescription;
        if (payload.content) data.content = payload.content;
        if (payload.categoryId) data.category = { connect: { id: payload.categoryId } };

        if (Object.keys(data).length > 0) {
            await tx.blog.update({ where: { id }, data });
        }

        if (payload.tagIds !== undefined) {
            // replace tag relations
            await tx.blogsOnTags.deleteMany({ where: { blogId: id } });
            if (Array.isArray(payload.tagIds) && payload.tagIds.length > 0) {
                const createData = payload.tagIds.map((t) => ({ blogId: id, tagId: t }));
                await tx.blogsOnTags.createMany({ data: createData });
            }
        }

        return tx.blog.findUnique({ where: { id }, include: { category: true, tags: { include: { tag: true } }, user: true } });
    });

    // Post-update cleanup: delete previous cloud asset if replaced
    try {
        if (newUploadedPublicId !== undefined) {
            const newPub = newUploadedPublicId ?? null;
            if (previousPublicId && previousPublicId !== newPub) {
                try {
                    await deleteCloudinaryAsset(previousPublicId);
                } catch (err) {
                    console.warn('Failed to delete previous cloud asset for blog', { previousPublicId, err: (err as Error).message });
                }
            }
        }

        if (payload.image === null && previousPublicId) {
            try {
                await deleteCloudinaryAsset(previousPublicId);
            } catch (err) {
                console.warn('Failed to delete previous cloud asset on explicit remove for blog', { previousPublicId, err: (err as Error).message });
            }
        }
    } catch (err) {
        console.warn('Unexpected error in post-update asset cleanup for blog', (err as Error).message);
    }

    return updated;
};

const deleteBlog = async (id: string) => {
    const existing = await prisma.blog.findUnique({ where: { id } });
    if (!existing) {
        throw new AppError(404, 'Blog not found', [{ message: 'No blog exists with the provided id', code: 'NOT_FOUND' }]);
    }

    const previousPublicId = getPublicIdFromUrl(existing.image) ?? null;

    if (previousPublicId) {
        try {
            await deleteCloudinaryAsset(previousPublicId);
        } catch (err) {
            console.warn('Failed to delete cloud asset before blog removal', { previousPublicId, err: (err as Error).message });
            throw new AppError(500, 'Failed to delete associated image from cloud', [
                { message: (err as Error).message, code: 'CLOUD_DELETE_FAILED' }
            ]);
        }
    }

    // delete join rows first then blog
    await prisma.$transaction([prisma.blogsOnTags.deleteMany({ where: { blogId: id } }), prisma.blog.delete({ where: { id } })]);
    return true;
};

const getAllBlogs = async () => {
    return prisma.blog.findMany({ orderBy: { createdAt: 'desc' }, include: { category: true, tags: { include: { tag: true } }, user: true } });
};

export const blogService = {
    getBlogs,
    getBlogById,
    getAllBlogs,
    createBlog,
    updateBlog,
    deleteBlog
};
