import { Request, Response } from 'express';
import { sendResponse } from '../../common/utils/send-response.js';
import { productService } from './product.service.js';

const getProducts = async (req: Request, res: Response) => {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 10);

  const result = await productService.getProducts({ page, limit });

  sendResponse({
    res,
    statusCode: 200,
    success: true,
    message: 'Products fetched successfully',
    data: result.data,
    errors: [],
    meta: {
      ...result.meta,
      timestamp: new Date().toISOString(),
      path: req.originalUrl
    }
  });
};

export const productController = {
  getProducts
};
