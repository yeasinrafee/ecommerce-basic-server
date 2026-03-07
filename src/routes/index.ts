import { Router } from 'express';
import { productRoutes } from '../modules/product/product.route.js';
import { authRoutes } from '../modules/auth/auth.route.js';
import { productCategoryRoutes } from '../modules/category/product-category.route.js';
import { blogCategoryRoutes } from '../modules/category/blog-category.route.js';
import { productTagRoutes } from '../modules/tag/product-tag.route.js';
import { blogTagRoutes } from '../modules/tag/blog-tag.route.js';

const router = Router();

router.use('/products', productRoutes);
router.use('/auth', authRoutes);
router.use('/product-categories', productCategoryRoutes);
router.use('/blog-categories', blogCategoryRoutes);
router.use('/product-tags', productTagRoutes);
router.use('/blog-tags', blogTagRoutes);

export const apiRoutes = router;
