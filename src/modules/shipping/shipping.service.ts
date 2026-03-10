import { prisma } from '../../config/prisma.js';
import { AppError } from '../../common/errors/app-error.js';
import type { CreateShippingDto, UpdateShippingDto } from './shipping.types.js';

const getShipping = async () => {
  return prisma.shipping.findFirst();
};

const getShippingById = async (id: string) => {
  const s = await prisma.shipping.findUnique({ where: { id } });
  if (!s) {
    throw new AppError(404, 'Shipping not found', [
      { message: 'No shipping exists with the provided id', code: 'NOT_FOUND' }
    ]);
  }
  return s;
};

const createShipping = async (dto: CreateShippingDto) => {
  const count = await prisma.shipping.count();
  if (count > 0) {
    throw new AppError(400, 'Shipping record already exists', [
      { message: 'Only one shipping record is allowed', code: 'ALREADY_EXISTS' }
    ]);
  }

  const created = await prisma.shipping.create({
    data: {
      minimumFreeShippingAmount: dto.minimumFreeShippingAmount,
      tax: dto.tax,
      defaultShippingCharge: dto.defaultShippingCharge,
      maximumWeight: dto.maximumWeight ?? null,
      maximumVolume: dto.maximumVolume ?? null,
      chargePerWeight: dto.chargePerWeight ?? null,
      chargePerVolume: dto.chargePerVolume ?? null
    }
  });

  return created;
};

const updateShipping = async (id: string, payload: UpdateShippingDto) => {
  const existing = await prisma.shipping.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError(404, 'Shipping not found', [
      { message: 'No shipping exists with the provided id', code: 'NOT_FOUND' }
    ]);
  }

  const updated = await prisma.shipping.update({ where: { id }, data: payload as any });
  return updated;
};

const deleteShipping = async (id: string) => {
  const existing = await prisma.shipping.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError(404, 'Shipping not found', [
      { message: 'No shipping exists with the provided id', code: 'NOT_FOUND' }
    ]);
  }

  await prisma.shipping.delete({ where: { id } });
  return true;
};

export const shippingService = {
  getShipping,
  getShippingById,
  createShipping,
  updateShipping,
  deleteShipping
};
