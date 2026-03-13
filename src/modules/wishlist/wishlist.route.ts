import { Router } from 'express';
import { asyncHandler } from '../../common/utils/async-handler.js';
import { wishlistController } from './wishlist.controller.js';
import { authenticate, authorizeRoles } from '../../common/middlewares/auth.middleware.js';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticate, authorizeRoles(Role.CUSTOMER));

router.get('/get-all-paginated', asyncHandler(wishlistController.getWishlistsPaginated));
router.get('/get-all', asyncHandler(wishlistController.getAllWishlists));
router.get('/get/:id', asyncHandler(wishlistController.getWishlist));
router.patch('/update/:id?', asyncHandler(wishlistController.updateWishlist));
router.patch('/add-to-cart/:id?', asyncHandler(wishlistController.addToCart));
router.delete('/delete-batch', asyncHandler(wishlistController.deleteWishlist));
router.delete('/delete/:id', asyncHandler(wishlistController.deleteWishlistByParamId));

export const wishlistRoutes = router;
