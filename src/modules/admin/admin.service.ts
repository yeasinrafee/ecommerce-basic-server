import { prisma } from '../../config/prisma.js';
import { AppError } from '../../common/errors/app-error.js';
import type { UpdateAdminDto, ServiceListResult, AdminListQuery } from './admin.types.js';
import type { Prisma } from '@prisma/client';
import { Role } from '@prisma/client';
import { deleteCloudinaryAsset, getPublicIdFromUrl } from '../../common/utils/file-upload.js';

const getAdmins = async ({ page = 1, limit = 10, searchTerm, status }: AdminListQuery = {}): Promise<ServiceListResult<any>> => {
    const skip = (page - 1) * limit;

    // Always restrict to admins whose related user has role = ADMIN
    const where: Prisma.AdminWhereInput = {
        user: { role: Role.ADMIN }
    };

    if (searchTerm) {
        // apply search on name or user's email while keeping role restriction
        where.AND = [
            {
                OR: [
                    { name: { contains: searchTerm, mode: 'insensitive' } },
                    { user: { email: { contains: searchTerm, mode: 'insensitive' } } }
                ]
            }
        ];
    }

    if (status) {
        Object.assign(where, { status });
    }

    const [data, total] = await Promise.all([
        prisma.admin.findMany({ where, skip, take: limit, include: { user: true }, orderBy: { createdAt: 'desc' } }),
        prisma.admin.count({ where })
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

const getAdminById = async (id: string) => {
    // use findFirst so we can restrict by related user role
    return prisma.admin.findFirst({ where: { id, user: { role: Role.ADMIN } }, include: { user: true } });
};

const updateAdmin = async (id: string, payload: UpdateAdminDto, newUploadedPublicId?: string | null) => {
    const existing = await prisma.admin.findFirst({ where: { id, user: { role: Role.ADMIN } } });
    if (!existing) {
        throw new AppError(404, 'Admin not found', [{ message: 'No admin exists with the provided id', code: 'NOT_FOUND' }]);
    }

    const previousPublicId = getPublicIdFromUrl(existing.image) ?? null;

    // perform DB updates in a transaction
    const updated = await prisma.$transaction(async (tx) => {
        if (payload.email) {
            const other = await tx.user.findUnique({ where: { email: payload.email } });
            if (other && other.id !== existing.userId) {
                throw new AppError(409, 'Email already registered', [{ field: 'email', message: 'Another user uses this email', code: 'EMAIL_ALREADY_EXISTS' }]);
            }

            await tx.user.update({ where: { id: existing.userId }, data: { email: payload.email } });
        }

        const adminData: any = {};
        if (typeof payload.name === 'string') adminData.name = payload.name;
        if (payload.status !== undefined) adminData.status = payload.status as any;
        if (payload.image !== undefined) adminData.image = payload.image;
        // Do not persist any Cloudinary public id in the DB; only store the image URL.

        const updatedAdmin = await tx.admin.update({ where: { id }, data: adminData });
        const user = await tx.user.findUnique({ where: { id: existing.userId } });

        return {
            ...updatedAdmin,
            user
        };
    });

    // After successful DB update, if a new publicId was provided, delete the previous cloud asset
    try {
        // If a new public id was provided (i.e. an upload happened), remove the previous asset
        if (newUploadedPublicId !== undefined) {
            const newPub = newUploadedPublicId ?? null;
            if (previousPublicId && previousPublicId !== newPub) {
                try {
                    await deleteCloudinaryAsset(previousPublicId);
                } catch (err) {
                    console.warn('Failed to delete previous cloud asset', { previousPublicId, err: (err as Error).message });
                }
            }
        }
        // If payload.image === null and there was a previous image, delete it
        if (payload.image === null && previousPublicId) {
            try {
                await deleteCloudinaryAsset(previousPublicId);
            } catch (err) {
                console.warn('Failed to delete previous cloud asset on explicit remove', { previousPublicId, err: (err as Error).message });
            }
        }
    } catch (err) {
        // swallow any unexpected errors from deletion logic
        console.warn('Unexpected error in post-update asset cleanup', (err as Error).message);
    }

    return updated;
};

const deleteAdmin = async (id: string) => {
    const existing = await prisma.admin.findFirst({ where: { id, user: { role: Role.ADMIN } } });
    if (!existing) {
        throw new AppError(404, 'Admin not found', [{ message: 'No admin exists with the provided id', code: 'NOT_FOUND' }]);
    }

    const previousPublicId = getPublicIdFromUrl(existing.image) ?? null;

    await prisma.$transaction(async (tx) => {
        await tx.admin.delete({ where: { id } });
        await tx.user.delete({ where: { id: existing.userId } });
    });

    if (previousPublicId) {
        try {
            await deleteCloudinaryAsset(previousPublicId);
        } catch (err) {
            console.warn('Failed to delete cloud asset after admin removal', { previousPublicId, err: (err as Error).message });
        }
    }

    return true;
};

const getAllAdmins = async () => {
    return prisma.admin.findMany({ where: { user: { role: Role.ADMIN } }, include: { user: true }, orderBy: { createdAt: 'desc' } });
};

const adminServiceObj = {
    getAdmins,
    getAdminById,
    getAllAdmins,
    updateAdmin,
    deleteAdmin
};


const bulkUpdateStatus = async (ids: string[], status: string) => {
    if (!Array.isArray(ids) || ids.length === 0) {
        throw new AppError(400, 'No ids provided', [{ message: 'Provide an array of admin ids', code: 'INVALID_PAYLOAD' }]);
    }

    const result = await prisma.admin.updateMany({ where: { id: { in: ids } }, data: { status: status as any } });

    return result.count;
};

export const adminService = Object.assign(adminServiceObj, { bulkUpdateStatus });
