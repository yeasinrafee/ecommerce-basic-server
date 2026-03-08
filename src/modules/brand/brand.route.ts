import { Router } from 'express';
import { asyncHandler } from '../../common/utils/async-handler.js';
import { brandController } from './brand.controller.js';
import { createUploadMiddleware } from '../../common/utils/file-upload.js';


const router = Router();

const upload = createUploadMiddleware({ maxFileSizeInMB: 5, maxFileCount: 1 });

router.get('/get-all-paginated', asyncHandler(brandController.getBrands));
router.get('/get-all', asyncHandler(brandController.getAllBrands));
router.get('/get/:id', asyncHandler(brandController.getBrand));
router.post('/create', upload.fields([{ name: 'image', maxCount: 1 }]), asyncHandler(brandController.createBrand));
router.patch('/update/:id', upload.fields([{ name: 'image', maxCount: 1 }]), asyncHandler(brandController.updateBrand));
router.delete('/delete/:id', asyncHandler(brandController.deleteBrand));

export const brandRoutes = router;

