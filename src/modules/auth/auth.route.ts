import { Router } from 'express';
import { asyncHandler } from '../../common/utils/async-handler.js';
import { authController } from './auth.controller.js';
import { createUploadMiddleware } from '../../common/utils/file-upload.js';

const router = Router();
const upload = createUploadMiddleware({
	maxFileSizeInMB: 10,
	maxFileCount: 5
});

router.post(
	'/admin/create',
	upload.fields([
		{ name: 'image', maxCount: 1 },
		{ name: 'images', maxCount: 5 }
	]),
	asyncHandler(authController.createAdmin)
);

export const authRoutes = router;

