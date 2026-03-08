import { Router } from 'express';
import { productRoutes } from '../modules/product/product.route.js';
import { authRoutes } from '../modules/auth/auth.route.js';
import { productCategoryRoutes } from '../modules/category/product-category.route.js';
import { blogCategoryRoutes } from '../modules/category/blog-category.route.js';
import { blogRoutes } from '../modules/blog/blog.route.js';
import { uploadRoutes } from '../modules/upload/upload.route.js';
import { productTagRoutes } from '../modules/tag/product-tag.route.js';
import { blogTagRoutes } from '../modules/tag/blog-tag.route.js';
import { brandRoutes } from '../modules/brand/brand.route.js';
import { attributeRoutes } from '../modules/attribute/attribute.route.js';
import { adminRoutes } from '../modules/admin/admin.route.js';

const router = Router();

router.use('/products', productRoutes);
router.use('/auth', authRoutes);
router.use('/product-categories', productCategoryRoutes);
router.use('/blog-categories', blogCategoryRoutes);
router.use('/product-tags', productTagRoutes);
router.use('/blog-tags', blogTagRoutes);
router.use('/blogs', blogRoutes);
router.use('/uploads', uploadRoutes);
router.use('/attributes', attributeRoutes);
router.use('/brands', brandRoutes);
router.use('/admins', adminRoutes);

export const apiRoutes = router;
