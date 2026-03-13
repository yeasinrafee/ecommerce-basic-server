import { Router } from 'express';
import { asyncHandler } from '../../common/utils/async-handler.js';
import { promoController } from './promo.controller.js';
import { authenticate, authorizeRoles } from '../../common/middlewares/auth.middleware.js';
import { Role } from '@prisma/client';

const router = Router();

router.get('/get-all-paginated', authenticate, authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN), asyncHandler(promoController.getPromos));
router.get('/get-all', authenticate, authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN), asyncHandler(promoController.getAllPromos));
router.get('/get/:id', authenticate, authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN), asyncHandler(promoController.getPromo));
router.post('/create', authenticate, authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN), asyncHandler(promoController.createPromo));
router.patch('/update/:id', authenticate, authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN), asyncHandler(promoController.updatePromo));
router.delete('/delete/:id', authenticate, authorizeRoles(Role.SUPER_ADMIN, Role.ADMIN), asyncHandler(promoController.deletePromo));

export const promoRoutes = router;
