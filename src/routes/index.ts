import { Router } from 'express';
import { productRoutes } from '../modules/product/product.route.js';
import { authRoutes } from '../modules/auth/auth.route.js';
import { categoryRoutes } from '../modules/category/category.route.js';
import { tagRoutes } from '../modules/tag/tag.route.js';

const router = Router();

router.use('/products', productRoutes);
router.use('/auth', authRoutes);
router.use('/categories', categoryRoutes);
router.use('/tags', tagRoutes);

export const apiRoutes = router;
