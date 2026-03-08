import { Request, Response } from 'express';
import { AppError } from '../../common/errors/app-error.js';
import { sendResponse } from '../../common/utils/send-response.js';
import { normalizeUploadedFiles } from '../../common/utils/file-upload.js';
import { setAuthCookies, clearAuthCookies } from '../../common/utils/cookie.js';
import { authService } from './auth.service.js';
import { validateCreateAdminPayload, validateLoginPayload } from './auth.types.js';

const createAdmin = async (req: Request, res: Response) => {
	const payload = validateCreateAdminPayload(req.body);
	const files = normalizeUploadedFiles(req.files);

	const result = await authService.createAdmin(payload, files);

	sendResponse({
		res,
		statusCode: 201,
		success: true,
		message: 'Admin created successfully',
		errors: [],
		meta: {
			timestamp: new Date().toISOString()
		}
	});
};

const login = async (req: Request, res: Response) => {
	const payload = validateLoginPayload(req.body);

	const result = await authService.login(payload);

	setAuthCookies(res, result.tokens);

	sendResponse({
		res,
		statusCode: 200,
		success: true,
		message: 'Logged in successfully',
		data: result,
		errors: [],
		meta: {
			timestamp: new Date().toISOString()
		}
	});
};

const refreshToken = async (req: Request, res: Response) => {
	const token = typeof req.body?.refreshToken === 'string' ? req.body.refreshToken.trim() : '';

	if (!token) {
		throw new AppError(400, 'Refresh token is required', [
			{
				message: 'Provide a valid refresh token in the request body',
				code: 'REFRESH_TOKEN_REQUIRED'
			}
		]);
	}

	const tokens = await authService.refreshTokens(token);

	setAuthCookies(res, tokens);

	sendResponse({
		res,
		statusCode: 200,
		success: true,
		message: 'Tokens refreshed successfully',
		data: tokens,
		errors: [],
		meta: {
			timestamp: new Date().toISOString()
		}
	});
};

const logout = async (_req: Request, res: Response) => {
	clearAuthCookies(res);
	sendResponse({
		res,
		statusCode: 200,
		success: true,
		message: 'Logged out successfully',
		data: null,
		errors: [],
		meta: {
			timestamp: new Date().toISOString()
		}
	});
};

export const authController = {
	createAdmin,
	login,
	refreshToken,
	logout
};
