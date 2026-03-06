import { Request, Response } from 'express';
import { sendResponse } from '../../common/utils/send-response.js';
import { normalizeUploadedFiles } from '../../common/utils/file-upload.js';
import { authService } from './auth.service.js';
import { validateCreateAdminPayload } from './auth.types.js';

const createAdmin = async (req: Request, res: Response) => {
	const payload = validateCreateAdminPayload(req.body);
	const files = normalizeUploadedFiles(req.files);

	const result = await authService.createAdmin(payload, files);

	sendResponse({
		res,
		statusCode: 201,
		success: true,
		message: 'Admin created successfully',
		data: result,
		errors: [],
		meta: {
			timestamp: new Date().toISOString(),
			path: req.originalUrl
		}
	});
};

export const authController = {
	createAdmin
};

