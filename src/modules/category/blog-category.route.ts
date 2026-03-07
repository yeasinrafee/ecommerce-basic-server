import { Router } from 'express';
import { asyncHandler } from '../../common/utils/async-handler.js';
import { blogCategoryController } from './blog-category.controller.js';

const router = Router();

router.get('/get-all-paginated', asyncHandler(blogCategoryController.getCategories));
router.get('/get-all', asyncHandler(blogCategoryController.getAllCategories));
router.get('/get/:id', asyncHandler(blogCategoryController.getCategory));
router.post('/create', asyncHandler(blogCategoryController.createCategory));
router.patch('/update/:id', asyncHandler(blogCategoryController.updateCategory));
router.delete('/delete/:id', asyncHandler(blogCategoryController.deleteCategory));

export const blogCategoryRoutes = router;
