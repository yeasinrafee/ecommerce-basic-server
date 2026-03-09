import { Router } from 'express';
import { asyncHandler } from '../../common/utils/async-handler.js';
import { shippingController } from './shipping.controller.js';

const router = Router();

router.post('/create', asyncHandler(shippingController.createShipping));
router.patch('/update/:id', asyncHandler(shippingController.updateShipping));
router.get('/get', asyncHandler(shippingController.getShipping));
router.get('/get/:id', asyncHandler(shippingController.getShippingById));
router.delete('/delete/:id', asyncHandler(shippingController.deleteShipping));

export const shippingRoutes = router;
