import { Request, Response } from 'express';
import { sendResponse } from '../../common/utils/send-response.js';
import { adminService } from './admin.service.js';

const getAdmins = async (req: Request, res: Response) => {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 10);
    const searchTerm = typeof req.query.searchTerm === 'string' ? req.query.searchTerm : undefined;
    const status = typeof req.query.status === 'string' ? (req.query.status as any) : undefined;

    const result = await adminService.getAdmins({ page, limit, searchTerm, status });

    sendResponse({
        res,
        statusCode: 200,
        success: true,
        message: 'Admins fetched',
        data: result.data,
        meta: {
            ...result.meta,
            timestamp: new Date().toISOString()
        }
    });
};

const getAdmin = async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const admin = await adminService.getAdminById(id);

    sendResponse({
        res,
        statusCode: 200,
        success: true,
        message: 'Admin fetched',
        data: admin
    });
};

const updateAdmin = async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const payload = req.body;

    const updated = await adminService.updateAdmin(id, payload);

    sendResponse({
        res,
        statusCode: 200,
        success: true,
        message: 'Admin updated',
        data: updated
    });
};

const deleteAdmin = async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    await adminService.deleteAdmin(id);

    sendResponse({
        res,
        statusCode: 200,
        success: true,
        message: 'Admin deleted',
        data: null
    });
};

const getAllAdmins = async (req: Request, res: Response) => {
    const admins = await adminService.getAllAdmins();

    sendResponse({
        res,
        statusCode: 200,
        success: true,
        message: 'All admins fetched',
        data: admins
    });
};

const bulkUpdateStatus = async (req: Request, res: Response) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const status = typeof req.body?.status === 'string' ? req.body.status : undefined;

    const count = await adminService.bulkUpdateStatus(ids, status);

    sendResponse({
        res,
        statusCode: 200,
        success: true,
        message: 'Statuses updated',
        data: { updated: count }
    });
};

export const adminController = {
    getAdmins,
    getAdmin,
    updateAdmin,
    deleteAdmin,
    getAllAdmins
    ,bulkUpdateStatus
};
