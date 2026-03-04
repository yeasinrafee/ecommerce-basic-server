import { prisma } from '../../config/prisma.js';
import { ProductListQuery } from './product.types.js';

const getProducts = async ({ page, limit }: ProductListQuery) => {
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    prisma.product.findMany({
      skip,
      take: limit,
      orderBy: {
        createdAt: 'desc'
      }
    }),
    prisma.product.count()
  ]);

  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
};

export const productService = {
  getProducts
};
