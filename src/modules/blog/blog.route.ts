import { Router } from 'express';
import { asyncHandler } from '../../common/utils/async-handler.js';
import { blogController } from './blog.controller.js';
import { createUploadMiddleware } from '../../common/utils/file-upload.js';

const router = Router();

const upload = createUploadMiddleware({ maxFileSizeInMB: 5, maxFileCount: 1 });

router.get('/get-all-paginated', asyncHandler(blogController.getBlogs));
router.get('/get-all', asyncHandler(blogController.getAllBlogs));
router.get('/get/:id', asyncHandler(blogController.getBlog));
router.post('/create', upload.fields([{ name: 'image', maxCount: 1 }]), asyncHandler(blogController.createBlog));
router.patch('/update/:id', upload.fields([{ name: 'image', maxCount: 1 }]), asyncHandler(blogController.updateBlog));
router.delete('/delete/:id', asyncHandler(blogController.deleteBlog));

export const blogRoutes = router;
