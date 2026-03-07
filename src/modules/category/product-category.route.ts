import { Router } from 'express';
import { asyncHandler } from '../../common/utils/async-handler.js';
import { productCategoryController } from './product-category.controller.js';

const router = Router();

router.get('/get-all-paginated', asyncHandler(productCategoryController.getCategories));
router.get('/get-all', asyncHandler(productCategoryController.getAllCategories));
router.get('/get/:id', asyncHandler(productCategoryController.getCategory));
router.post('/create', asyncHandler(productCategoryController.createCategory));
router.patch('/update/:id', asyncHandler(productCategoryController.updateCategory));
router.delete('/delete/:id', asyncHandler(productCategoryController.deleteCategory));

export const productCategoryRoutes = router;
