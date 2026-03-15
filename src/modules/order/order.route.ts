import { Router } from 'express';
import { asyncHandler } from '../../common/utils/async-handler.js';
import { orderController } from './order.controller.js';
import { authenticate, authorizeRoles } from '../../common/middlewares/auth.middleware.js';
import { Role } from '@prisma/client';

const router = Router();

router.post('/', authenticate, authorizeRoles(Role.CUSTOMER), asyncHandler(orderController.createOrder));

export const orderRoutes = router;
