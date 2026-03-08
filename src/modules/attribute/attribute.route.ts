import { Router } from 'express';
import { asyncHandler } from '../../common/utils/async-handler.js';
import { attributeController } from './attribute.controller.js';

const router = Router();

router.get('/get-all-paginated', asyncHandler(attributeController.getAttributes));
router.get('/get-all', asyncHandler(attributeController.getAllAttributes));
router.get('/get/:id', asyncHandler(attributeController.getAttribute));
router.post('/create', asyncHandler(attributeController.createAttribute));
router.patch('/update/:id', asyncHandler(attributeController.updateAttribute));
router.delete('/delete/:id', asyncHandler(attributeController.deleteAttribute));

export const attributeRoutes = router;
