import { prisma } from '../../config/prisma.js';
import { AppError } from '../../common/errors/app-error.js';
import { DiscountType } from '@prisma/client';
import type { CreateOrderDto } from './order.types.js';
import type { PrismaClient } from '@prisma/client';
import { emailService, emailQueue } from '../../common/services/email.service.js';
import { orderEmailTemplates } from './order.email-templates.js';

export const createOrderService = async (
  userId: string,
  data: CreateOrderDto
) => {
  const result = await prisma.$transaction(async (tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$use' | '$extends'>) => {
    let customer = await tx.customer.findUnique({
      where: { userId },
    });

    if (!customer) {
      throw new AppError(404, 'Customer not found for this user');
    }

    let finalAddressId = data.addressId;
    let zoneId = '';

    if (finalAddressId) {
      const existingAddress = await tx.address.findUnique({
        where: { id: finalAddressId, customerId: customer.id },
      });
      if (!existingAddress) {
        throw new AppError(404, 'Provided address not found or does not belong to the customer');
      }
      zoneId = existingAddress.zoneId;
    } else if (data.address) {
      const newAddress = await tx.address.create({
        data: {
          customerId: customer.id,
          zoneId: data.address.zoneId,
          postCode: data.address.postCode,
          streetAddress: data.address.streetAddress,
          flatNumber: data.address.flatNumber,
        },
      });
      finalAddressId = newAddress.id;
      zoneId = data.address.zoneId;
    } else {
      throw new AppError(400, 'Either addressId or address must be provided');
    }

    if (data.promoId) {
      const promo = await tx.promo.findUnique({ where: { id: data.promoId } });
      if (!promo) {
        throw new AppError(400, 'Invalid promo code');
      }

      const currentDate = new Date();
      if (currentDate < promo.startDate || currentDate > promo.endDate) {
        throw new AppError(400, 'Promo code is expired or not yet active');
      }

      const pastUsages = await tx.order.count({
        where: { customerId: customer.id, promoId: data.promoId },
      });

      if (pastUsages >= promo.numberOfUses) {
        throw new AppError(400, 'Promo code usage limit exceeded for this customer');
      }
    }

    let baseAmount = 0;
    let totalWeight = 0;
    let totalVolume = 0;
    const orderItemsData = [];

    for (const item of data.products) {
      const product = await tx.product.findUnique({
        where: { id: item.productId },
        include: {
          productVariations: {
            where: {
              id: { in: item.variationIds || [] },
            },
          },
        },
      });

      if (!product) {
        throw new AppError(404, `Product with id ${item.productId} not found`);
      }

      if (product.stock < item.quantity) {
        throw new AppError(400, `Not enough stock for product ${product.name}`);
      }

      let basePriceToUse = product.Baseprice;
      let finalPriceToUse = product.Baseprice; 
      let appliedDiscountType: DiscountType = product.discountType || DiscountType.NONE;
      let appliedDiscountValue = product.discountValue || 0;

      if (
        product.discountType &&
        product.discountValue &&
        product.discountStartDate &&
        product.discountEndDate
      ) {
        const now = new Date();
        if (now >= product.discountStartDate && now <= product.discountEndDate) {
          if (product.discountType === DiscountType.FLAT_DISCOUNT) {
            finalPriceToUse -= product.discountValue;
          } else if (product.discountType === DiscountType.PERCENTAGE_DISCOUNT) {
            finalPriceToUse -= (product.Baseprice * product.discountValue) / 100;
          }
        } else {
          appliedDiscountType = DiscountType.NONE;
          appliedDiscountValue = 0;
          finalPriceToUse = product.Baseprice;
        }
      } else {
        appliedDiscountType = DiscountType.NONE;
        appliedDiscountValue = 0;
      }

      if (item.variationIds && item.variationIds.length > 0) {
        for (const variation of product.productVariations) {
          if (variation.basePrice > basePriceToUse) {
            basePriceToUse = variation.basePrice;
          }
          if (variation.finalPrice > finalPriceToUse) {
            finalPriceToUse = variation.finalPrice;
          }
        }
      }

      if (finalPriceToUse < 0) finalPriceToUse = 0;
      baseAmount += finalPriceToUse * item.quantity;

      if (product.weight) {
        totalWeight += product.weight * item.quantity;
      } else if (product.volume) {
        totalVolume += product.volume * item.quantity;
      }

      orderItemsData.push({
        productId: product.id,
        quantity: item.quantity,
        Baseprice: basePriceToUse,
        finalPrice: finalPriceToUse,
        discountType: appliedDiscountType,
        discountValue: appliedDiscountValue,
        variations: {
          create: (item.variationIds || []).map((vId) => ({
            productVariationId: vId,
          })),
        },
      });

      const updateResult = await tx.product.updateMany({
        where: {
          id: product.id,
          stock: {
            gte: item.quantity,
          },
        },
        data: {
          stock: {
            decrement: item.quantity,
          },
        },
      });

      if (updateResult.count === 0) {
        throw new AppError(400, `Concurrency Error: Product ${product.name} does not have enough stock.`);
      }
    }

    let orderDiscountValue = 0;
    let orderDiscountType: DiscountType = DiscountType.NONE;

    if (data.promoId) {
      const promo = await tx.promo.findUnique({ where: { id: data.promoId } });
      if (promo) {
        orderDiscountType = promo.discountType;
        if (promo.discountType === DiscountType.FLAT_DISCOUNT) {
          orderDiscountValue = promo.discountValue;
        } else if (promo.discountType === DiscountType.PERCENTAGE_DISCOUNT) {
          orderDiscountValue = (baseAmount * promo.discountValue) / 100;
        }
      }
    }

    const amountAfterPromo = Math.max(0, baseAmount - orderDiscountValue);
    const zonePolicyLink = await tx.zonePoliciesOnZones.findFirst({
      where: { zoneId },
      include: { zonePolicy: true },
    });

    if (!zonePolicyLink || !zonePolicyLink.zonePolicy) {
      throw new AppError(400, 'Shipping not available for the selected zone');
    }

    const baseShippingCharge = zonePolicyLink.zonePolicy.shippingCost;
    const deliveryTime = zonePolicyLink.zonePolicy.deliveryTime;

    const shippingSettings = await tx.shipping.findFirst();
    let extraShippingCharge = 0;
    let taxPercent = 0;
    let chargePerWeight = null;
    let chargePerVolume = null;
    let weightUnit = null;
    let volumeUnit = null;

    if (shippingSettings) {
      taxPercent = shippingSettings.tax || 0;
      chargePerWeight = shippingSettings.chargePerWeight;
      chargePerVolume = shippingSettings.chargePerVolume;
      weightUnit = shippingSettings.weightUnit;
      volumeUnit = shippingSettings.volumeUnit;

      if (totalWeight > 0 && chargePerWeight && weightUnit && weightUnit > 0) {
        extraShippingCharge += Math.ceil(totalWeight / weightUnit) * chargePerWeight;
      }
      if (totalVolume > 0 && chargePerVolume && volumeUnit && volumeUnit > 0) {
        extraShippingCharge += Math.ceil(totalVolume / volumeUnit) * chargePerVolume;
      }
    }

    const finalShippingCharge = baseShippingCharge + extraShippingCharge;
    const taxAmount = (amountAfterPromo * taxPercent) / 100;
    const finalAmount = amountAfterPromo + finalShippingCharge + taxAmount;

    const expectedDeliveryDate = new Date();
    expectedDeliveryDate.setDate(expectedDeliveryDate.getDate() + Math.ceil(deliveryTime || 0));

    let discountValueForOrder = 0;
    if (data.promoId) {
      const promoEntity = await tx.promo.findUnique({ where: { id: data.promoId } });
      if (promoEntity) {
        discountValueForOrder = promoEntity.discountValue;
      }
    }

    const order = await tx.order.create({
      data: {
        customerId: customer.id,
        customerName: data.customerName,
        customerEmail: data.customerEmail,
        customerPhone: data.customerPhone,
        addressId: finalAddressId,
        baseAmount,
        promoId: data.promoId || null,
        discountType: orderDiscountType,
        discountValue: discountValueForOrder,
        discountAmount: orderDiscountValue,
        finalAmount,
        baseShippingCharge: baseShippingCharge,
        extraShippingCharge: extraShippingCharge,
        finalShippingCharge: finalShippingCharge,
        tax: taxAmount,
        totalWeight,
        totalVolume,
        chargePerWeight,
        chargePerVolume,
        weightUnit,
        volumeUnit,
        deliveryTime,
        expectedDeliveryDate,
        orderItems: {
          create: orderItemsData,
        },
      },
      include: {
        customer: true,
        promo: true,
        address: {
          include: {
            zone: {
              include: {
                zonePolicies: {
                  include: { zonePolicy: true },
                },
              },
            },
          },
        },
        orderItems: {
          include: {
            product: true,
            variations: {
              include: {
                productVariation: true,
              },
            },
          },
        },
      },
    });

    // attach the chosen zone policy details used for shipping
    const zonePolicy = zonePolicyLink?.zonePolicy ?? null;

    return { ...order, zonePolicy };
  });

  void emailService.sendEmail({
    to: result.customerEmail || '',
    subject: `Order Placed Successfully`,
    html: orderEmailTemplates.orderPlaced(result.customerName, result.finalAmount),
  });

  return result;
};

export const getAllOrdersService = async (
  page: number,
  limit: number,
  searchTerm?: string
) => {
  const skip = (page - 1) * limit;

  const where: any = {};

  if (searchTerm) {
    where.OR = [
      { customerName: { contains: searchTerm, mode: 'insensitive' } },
      { customerEmail: { contains: searchTerm, mode: 'insensitive' } },
      { customerPhone: { contains: searchTerm, mode: 'insensitive' } },
    ];
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: true,
        promo: true,
        address: {
          include: {
            zone: true,
          },
        },
        orderItems: {
          include: {
            product: true,
          },
        },
      },
    }),
    prisma.order.count({ where }),
  ]);

  return {
    orders,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getOrdersByCustomerService = async (userId: string) => {
  const customer = await prisma.customer.findUnique({
    where: { userId },
  });

  if (!customer) {
    throw new AppError(404, 'Customer not found');
  }

  return prisma.order.findMany({
    where: { customerId: customer.id },
    orderBy: { createdAt: 'desc' },
    include: {
      promo: true,
      address: {
        include: { zone: true },
      },
      orderItems: {
        include: {
          product: true,
        },
      },
    },
  });
};

export const getOrderByIdService = async (orderId: string, userId?: string, roles?: string[]) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: true,
      promo: true,
      address: {
        include: {
          zone: {
            include: {
              zonePolicies: {
                include: { zonePolicy: true },
              },
            },
          },
        },
      },
      orderItems: {
        include: {
          product: true,
          variations: {
            include: { productVariation: true },
          },
        },
      },
    },
  });

  if (!order) {
    throw new AppError(404, 'Order not found');
  }

  if (userId && roles) {
    const isAdmin = roles.includes('ADMIN') || roles.includes('SUPER_ADMIN');
    if (!isAdmin) {
      const customer = await prisma.customer.findUnique({ where: { userId } });
      if (!customer || order.customerId !== customer.id) {
        throw new AppError(403, 'Unauthorized access to this order');
      }
    }
  }

  // compute a fallback expected delivery date from order.createdAt + zone policy deliveryTime (days)
  let expected = order.expectedDeliveryDate ?? null;
  const deliveryTimeDays = order.address?.zone?.zonePolicies?.[0]?.zonePolicy?.deliveryTime;
  if (!expected && deliveryTimeDays && order.createdAt) {
    const d = new Date(order.createdAt);
    d.setDate(d.getDate() + Math.ceil(deliveryTimeDays || 0));
    expected = d;
  }

  return { ...order, expectedDeliveryDate: expected };
};

export const updateOrderStatusService = async (orderId: string, status: any) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: {
        include: {
          user: true
        }
      }
    },
  });

  if (!order) {
    throw new AppError(404, 'Order not found');
  }

  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: { orderStatus: status },
  });

  // Background email processing using BullMQ via emailQueue.add
  await emailQueue.add('sendEmail', {
    to: order.customerEmail || order.customer.user.email,
    subject: `Order Status Update: ${status}`,
    html: orderEmailTemplates.statusUpdate(order, status),
  });

  return updatedOrder;
};

export const cancelOrderService = async (orderId: string, userId: string) => {
  const customer = await prisma.customer.findUnique({
    where: { userId },
  });

  if (!customer) {
    throw new AppError(404, 'Customer not found');
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: {
        include: {
          user: true,
        },
      },
    },
  });

  if (!order) {
    throw new AppError(404, 'Order not found');
  }

  if (order.customerId !== customer.id) {
    throw new AppError(403, 'You are not authorized to cancel this order');
  }

  if (order.orderStatus === 'CANCELLED') {
    throw new AppError(400, 'Order is already cancelled');
  }

  // Optional: Check if order is already shipped/delivered and prevent cancellation
  if (['SHIPPED', 'DELIVERED'].includes(order.orderStatus)) {
    throw new AppError(400, `Cannot cancel an order that is already ${order.orderStatus.toLowerCase()}`);
  }

  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: { orderStatus: 'CANCELLED' },
  });

  // Background email for cancellation
  await emailQueue.add('sendEmail', {
    to: order.customerEmail || order.customer.user.email,
    subject: 'Order Cancelled',
    html: orderEmailTemplates.orderCancelled(order.customerName),
  });

  return updatedOrder;
};
