import { Router } from 'express';
import { asyncHandler } from '../../common/utils/async-handler.js';
import { tagController } from './tag.controller.js';

const router = Router();

router.get('/get-all-paginated', asyncHandler(tagController.getTags));
router.get('/get-all', asyncHandler(tagController.getAllTags));
router.get('/get/:id', asyncHandler(tagController.getTag));
router.post('/create', asyncHandler(tagController.createTag));
router.patch('/update/:id', asyncHandler(tagController.updateTag));
router.delete('/delete/:id', asyncHandler(tagController.deleteTag));

export const tagRoutes = router;
