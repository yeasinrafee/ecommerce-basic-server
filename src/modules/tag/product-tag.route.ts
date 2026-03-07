import { Router } from 'express';
import { asyncHandler } from '../../common/utils/async-handler.js';
import { productTagController } from './product-tag.controller.js';

const router = Router();

router.get('/get-all-paginated', asyncHandler(productTagController.getTags));
router.get('/get-all', asyncHandler(productTagController.getAllTags));
router.get('/get/:id', asyncHandler(productTagController.getTag));
router.post('/create', asyncHandler(productTagController.createTag));
router.patch('/update/:id', asyncHandler(productTagController.updateTag));
router.delete('/delete/:id', asyncHandler(productTagController.deleteTag));

export const productTagRoutes = router;
