import { Router } from 'express';
import { productRoutes } from '../modules/product/product.route.js';

const router = Router();

router.use('/products', productRoutes);

export const apiRoutes = router;
