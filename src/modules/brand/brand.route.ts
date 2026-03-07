import { Router } from 'express';
import { asyncHandler } from '../../common/utils/async-handler.js';
import { brandController } from './brand.controller.js';

const router = Router();

router.get('/get-all-paginated', asyncHandler(brandController.getBrands));
router.get('/get-all', asyncHandler(brandController.getAllBrands));
router.get('/get/:id', asyncHandler(brandController.getBrand));
router.post('/create', asyncHandler(brandController.createBrand));
router.patch('/update/:id', asyncHandler(brandController.updateBrand));
router.delete('/delete/:id', asyncHandler(brandController.deleteBrand));

export const brandRoutes = router;

