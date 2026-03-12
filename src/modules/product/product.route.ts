import { Router } from 'express';
import { asyncHandler } from '../../common/utils/async-handler.js';
import { createUploadMiddleware } from '../../common/utils/file-upload.js';
import { productController } from './product.controller.js';

const router = Router();

const upload = createUploadMiddleware({ maxFileSizeInMB: 5, maxFileCount: 11 });

router.post(
	'/create',
	upload.fields([
		{ name: 'mainImage', maxCount: 1 },
		{ name: 'galleryImages', maxCount: 10 }
	]),
	asyncHandler(productController.createProduct)
);

export const productRoutes = router;
