import { Router } from 'express';
import { productRoutes } from '../modules/product/product.route.js';
import { authRoutes } from '../modules/auth/auth.route.js';

const router = Router();

router.use('/products', productRoutes);
router.use('/auth', authRoutes);

export const apiRoutes = router;
