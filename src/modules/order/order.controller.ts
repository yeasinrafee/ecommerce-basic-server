import { Request, Response, NextFunction } from 'express';
import { createOrderService } from './order.service.js';

export const createOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id; 
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const data = req.body;
    const order = await createOrderService(userId, data);
    res.status(201).json({ success: true, data: order });
    return;
  } catch (error: any) {
    next(error);
  }
};

export const orderController = {
  createOrder
};
