import { Request, Response } from "express";
import { z } from "zod";
import { customerService } from "./customer.service.js";
import { sendResponse } from "../../common/utils/send-response.js";
import { AppError } from "../../common/errors/app-error.js";
import { uploadMultipleFilesToCloudinary, deleteCloudinaryAsset, getPublicIdFromUrl } from "../../common/utils/file-upload.js";
import { prisma } from "../../config/prisma.js";

const updateCustomerSchema = z.object({
    phone: z.string().optional()
});

const bulkStatusUpdateSchema = z.object({
    ids: z.array(z.string().uuid()),
    status: z.enum(["ACTIVE", "INACTIVE"])
});

const getCustomers = async (req: Request, res: Response) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const searchTerm = req.query.searchTerm as string;
    const status = req.query.status as "ACTIVE" | "INACTIVE";

    const result = await customerService.getCustomers({ page, limit, searchTerm, status });

    sendResponse({
        res,
        statusCode: 200,
        success: true,
        message: "Customers retrieved",
        data: result.data,
        meta: result.meta
    });
};

const getMyAddresses = async (req: Request, res: Response) => {
    const userId = req.user?.id;

    if (!userId) {
        throw new AppError(401, "Unauthorized");
    }

    const addresses = await customerService.getCustomerAddressesByUserId(userId);

    sendResponse({
        res,
        statusCode: 200,
        success: true,
        message: "Addresses retrieved",
        data: addresses
    });
};

const updateSelf = async (req: Request, res: Response) => {
    const userId = (req.user as any).id;
    const customer = await prisma.customer.findUnique({
        where: { userId }
    });

    if (!customer) {
        throw new AppError(404, "Customer not found", []);
    }

    const parsed = updateCustomerSchema.parse(req.body);
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const imageFile = files?.image?.[0];

    let imageUrl = customer.image;
    let oldImagePublicId: string | null = null;

    if (imageFile) {
        const uploaded = await uploadMultipleFilesToCloudinary([imageFile], {
            projectFolder: 'customers',
            entityId: customer.id,
            fileNamePrefix: 'profile'
        });

        imageUrl = uploaded[0].secureUrl;
        if (customer.image) {
            oldImagePublicId = getPublicIdFromUrl(customer.image);
        }
    }

    const updated = await customerService.updateCustomer(customer.id, userId, {
        ...parsed,
        image: imageUrl ?? undefined
    });

    if (oldImagePublicId) {
        await deleteCloudinaryAsset(oldImagePublicId);
    }

    sendResponse({
        res,
        statusCode: 200,
        success: true,
        message: "Profile updated",
        data: updated
    });
};

const bulkUpdateStatus = async (req: Request, res: Response) => {
    const parsed = bulkStatusUpdateSchema.parse(req.body);
    await customerService.bulkUpdateStatus(parsed);

    sendResponse({
        res,
        statusCode: 200,
        success: true,
        message: "Status updated"
    });
};

export const customerController = {
    getCustomers,
    updateSelf,
    getMyAddresses,
    bulkUpdateStatus
};
