import { Router } from 'express';
import { asyncHandler } from '../../common/utils/async-handler.js';
import { productController } from './product.controller.js';

const router = Router();

router.get('/', asyncHandler(productController.getProducts));

export const productRoutes = router;
