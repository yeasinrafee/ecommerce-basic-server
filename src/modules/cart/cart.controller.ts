import { Request, Response } from 'express';
import { sendResponse } from '../../common/utils/send-response.js';
import { cartService } from './cart.service.js';
import { AppError } from '../../common/errors/app-error.js';

const getCartItems = async (req: Request, res: Response) => {
    const data = await cartService.getCartItems(req.user!.id);
    
    sendResponse({
        res,
        statusCode: 200,
        success: true,
        message: 'Cart items fetched',
        data
    });
};

const addToCart = async (req: Request, res: Response) => {
    const productIds = req.body.productIds || (req.body.productId ? [req.body.productId] : null);
    
    if (!productIds || (Array.isArray(productIds) && productIds.length === 0)) {
        throw new AppError(400, 'Product IDs are required', [{ message: 'Missing product ID(s)', code: 'MISSING_DATA' }]);
    }

    const data = await cartService.addToCart(req.user!.id, productIds);
    
    sendResponse({
        res,
        statusCode: 200,
        success: true,
        message: 'Added to cart successfully',
        data
    });
};

const updateCartItems = async (req: Request, res: Response) => {
    const productIds = req.body.productIds || (req.body.productId ? [req.body.productId] : null);
    const addedToCart = req.body.addedToCart;

    if (!productIds || (Array.isArray(productIds) && productIds.length === 0)) {
        throw new AppError(400, 'Product IDs are required', [{ message: 'Missing product ID(s)', code: 'MISSING_DATA' }]);
    }

    if (addedToCart === undefined) {
        throw new AppError(400, 'addedToCart field is required', [{ message: 'Missing status', code: 'MISSING_DATA' }]);
    }

    const data = await cartService.updateCartItems(req.user!.id, productIds, addedToCart);
    
    sendResponse({
        res,
        statusCode: 200,
        success: true,
        message: 'Cart updated successfully',
        data
    });
};

const removeItemsFromCart = async (req: Request, res: Response) => {
    const productIds = req.body.productIds || (req.body.productId ? [req.body.productId] : null);

    if (!productIds || (Array.isArray(productIds) && productIds.length === 0)) {
        throw new AppError(400, 'Product IDs are required', [{ message: 'Missing product ID(s)', code: 'MISSING_DATA' }]);
    }

    await cartService.removeItemsFromCart(req.user!.id, productIds);
    
    sendResponse({
        res,
        statusCode: 200,
        success: true,
        message: 'Items removed from cart',
        data: null
    });
};

export const cartController = {
    getCartItems,
    addToCart,
    updateCartItems,
    removeItemsFromCart
};
