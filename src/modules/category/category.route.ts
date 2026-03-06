import { Router } from 'express';
import { asyncHandler } from '../../common/utils/async-handler.js';
import { categoryController } from './category.controller.js';

const router = Router();

router.get('/get-all', asyncHandler(categoryController.getCategories));
router.get('/get/:id', asyncHandler(categoryController.getCategory));
router.post('/create', asyncHandler(categoryController.createCategory));
router.patch('/update/:id', asyncHandler(categoryController.updateCategory));
router.delete('/delete/:id', asyncHandler(categoryController.deleteCategory));

export const categoryRoutes = router;
