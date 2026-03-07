import { Router } from 'express';
import { asyncHandler } from '../../common/utils/async-handler.js';
import { blogTagController } from './blog-tag.controller.js';

const router = Router();

router.get('/get-all-paginated', asyncHandler(blogTagController.getTags));
router.get('/get-all', asyncHandler(blogTagController.getAllTags));
router.get('/get/:id', asyncHandler(blogTagController.getTag));
router.post('/create', asyncHandler(blogTagController.createTag));
router.patch('/update/:id', asyncHandler(blogTagController.updateTag));
router.delete('/delete/:id', asyncHandler(blogTagController.deleteTag));

export const blogTagRoutes = router;
