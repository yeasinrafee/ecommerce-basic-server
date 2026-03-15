import { prisma } from '../../config/prisma.js';
import { AppError } from '../../common/errors/app-error.js';
import { DiscountType } from '@prisma/client';
import type { CreateOrderDto } from './order.types.js';
import type { PrismaClient } from '@prisma/client';
import { emailService } from '../../common/services/email.service.js';

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
      });

      if (!product) {
        throw new AppError(404, `Product with id ${item.productId} not found`);
      }

      if (product.stock < item.quantity) {
        throw new AppError(400, `Not enough stock for product ${product.name}`);
      }

      let finalPrice = product.Baseprice;
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
            finalPrice -= product.discountValue;
          } else if (product.discountType === DiscountType.PERCENTAGE_DISCOUNT) {
            finalPrice -= (product.Baseprice * product.discountValue) / 100;
          }
        } else {
          appliedDiscountType = DiscountType.NONE;
          appliedDiscountValue = 0;
          finalPrice = product.Baseprice;
        }
      } else {
        appliedDiscountType = DiscountType.NONE;
        appliedDiscountValue = 0;
      }

      if (finalPrice < 0) finalPrice = 0;
      baseAmount += finalPrice * item.quantity;

      if (product.weight) {
        totalWeight += product.weight * item.quantity;
      } else if (product.volume) {
        totalVolume += product.volume * item.quantity;
      }

      orderItemsData.push({
        productId: product.id,
        quantity: item.quantity,
        Baseprice: product.Baseprice,
        finalPrice: finalPrice,
        discountType: appliedDiscountType,
        discountValue: appliedDiscountValue,
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
    expectedDeliveryDate.setHours(expectedDeliveryDate.getHours() + deliveryTime);

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
        orderItems: true,
      },
    });

    return order;
  });

  void emailService.queueEmail({
    to: data.customerEmail || '',
    subject: `Order Confirmation`,
    html: `
      <h2>Thank you for your order!</h2>
      <p>Dear ${data.customerName},</p>
      <p>Your order has been placed successfully.</p>
      <p>We will notify you once it's on the way.</p>
    `,
  });

  return result;
};
