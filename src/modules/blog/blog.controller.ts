import { Request, Response } from 'express';
import { sendResponse } from '../../common/utils/send-response.js';
import { blogService } from './blog.service.js';
import { normalizeUploadedFiles, uploadMultipleFilesToCloudinary, deleteCloudinaryAsset } from '../../common/utils/file-upload.js';
import crypto from 'node:crypto';
import { AppError } from '../../common/errors/app-error.js';

const parseTagIds = (input: any): string[] => {
    if (!input) return [];
    if (Array.isArray(input)) return input.map(String).filter(Boolean);
    if (typeof input === 'string') {
        try {
            const parsed = JSON.parse(input);
            if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
        } catch (_err) {
            // not JSON, fallthrough
        }

        if (input.includes(',')) return input.split(',').map((s) => s.trim()).filter(Boolean);
        return [input];
    }
    return [];
};

const createBlog = async (req: Request, res: Response) => {
    const { title, authorName, shortDescription, content, categoryId } = req.body;
    const rawTagIds = req.body.tagIds;
    const tagIds = parseTagIds(rawTagIds);

    let newlyUploadedPublicId: string | null = null;
    let imageUrl: string | null | undefined = undefined;

    try {
        const files = normalizeUploadedFiles(req.files);
        if (files.length > 0) {
            const generatedId = crypto.randomUUID();
            const uploadedFiles = await uploadMultipleFilesToCloudinary(files, {
                projectFolder: 'blogs',
                entityId: generatedId,
                subFolder: generatedId,
                fileNamePrefix: 'blog'
            });

            const uploaded = uploadedFiles[0];
            imageUrl = uploaded?.secureUrl ?? null;
            newlyUploadedPublicId = uploaded?.publicId ?? null;
        }

        // user from middleware
        const userId = req.user?.id as string | undefined;
        if (!userId) throw new AppError(401, 'Authentication required', [{ message: 'User not found on request', code: 'AUTH_MISSING' }]);

        const created = await blogService.createBlog({ title, image: imageUrl ?? null, authorName, shortDescription, content, categoryId, tagIds, userId });

        sendResponse({ res, statusCode: 201, success: true, message: 'Blog created', data: created });
        return;
    } catch (err) {
        if (newlyUploadedPublicId) {
            try {
                await deleteCloudinaryAsset(newlyUploadedPublicId);
            } catch (cleanupErr) {
                console.warn('Failed to cleanup uploaded blog image after create failure', { newlyUploadedPublicId, err: (cleanupErr as Error).message });
            }
        }

        throw err;
    }
};

const updateBlog = async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const payload: any = req.body || {};
    let newlyUploadedPublicId: string | null = null;

    try {
        const files = normalizeUploadedFiles(req.files);

        if (files.length > 0) {
            const uploadedFiles = await uploadMultipleFilesToCloudinary(files, {
                projectFolder: 'blogs',
                entityId: id,
                subFolder: id,
                fileNamePrefix: 'blog'
            });

            const uploaded = uploadedFiles[0];
            payload.image = uploaded?.secureUrl ?? null;
            newlyUploadedPublicId = uploaded?.publicId ?? null;
        }

        // normalize tagIds if provided
        if (payload.tagIds !== undefined) payload.tagIds = parseTagIds(payload.tagIds);

        const updated = await blogService.updateBlog(id, payload, newlyUploadedPublicId);

        sendResponse({ res, statusCode: 200, success: true, message: 'Blog updated', data: updated });
        return;
    } catch (err) {
        if (newlyUploadedPublicId) {
            try {
                await deleteCloudinaryAsset(newlyUploadedPublicId);
            } catch (deleteErr) {
                console.warn('Failed to cleanup newly uploaded blog asset after update failure', { newlyUploadedPublicId, err: (deleteErr as Error).message });
            }
        }

        throw err;
    }
};

const getBlogs = async (req: Request, res: Response) => {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 10);
    const searchTerm = typeof req.query.searchTerm === 'string' ? req.query.searchTerm : undefined;

    const result = await blogService.getBlogs({ page, limit, searchTerm });

    sendResponse({ res, statusCode: 200, success: true, message: 'Blogs fetched', data: result.data, meta: { ...result.meta, timestamp: new Date().toISOString() } });
};

const getBlog = async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const b = await blogService.getBlogById(id);

    sendResponse({ res, statusCode: 200, success: true, message: 'Blog fetched', data: b });
};

const getAllBlogs = async (req: Request, res: Response) => {
    const blogs = await blogService.getAllBlogs();

    sendResponse({ res, statusCode: 200, success: true, message: 'All blogs fetched', data: blogs });
};

const deleteBlog = async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    await blogService.deleteBlog(id);

    sendResponse({ res, statusCode: 200, success: true, message: 'Blog deleted', data: null });
};

export const blogController = {
    createBlog,
    updateBlog,
    getBlogs,
    getBlog,
    getAllBlogs,
    deleteBlog
};
