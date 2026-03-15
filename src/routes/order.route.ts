import { Router } from 'express';
import { createOrder } from '../modules/order/order.controller';
import { authenticateUser, authorizeRoles } from '../common/middlewares/auth'; // Assumptions based on standard setup
import { Role } from '@prisma/client';

const router = Router();

router.post('/', authenticateUser, authorizeRoles(Role.CUSTOMER), createOrder);

export default router;
