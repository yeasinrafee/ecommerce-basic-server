import { prisma } from '../../config/prisma.js';
import { AppError } from '../../common/errors/app-error.js';
import type { CreateZonePolicyDto, UpdateZonePolicyDto, ZonePolicyListQuery, ServiceListResult } from './zone-policy.types.js';
import type { Prisma } from '@prisma/client';

const getZonePolicies = async ({ page = 1, limit = 10, searchTerm }: ZonePolicyListQuery = {}): Promise<ServiceListResult<any>> => {
  const skip = (page - 1) * limit;
  const where: Prisma.ZonePolicyWhereInput = searchTerm ? { policyName: { contains: searchTerm, mode: 'insensitive' } } : {};

  const [data, total] = await Promise.all([
    prisma.zonePolicy.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
    prisma.zonePolicy.count({ where })
  ]);

  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit))
    }
  };
};

const getAllZonePolicies = async () => {
  return prisma.zonePolicy.findMany({ orderBy: { createdAt: 'desc' } });
};

const getZonePolicyById = async (id: string) => {
  const p = await prisma.zonePolicy.findUnique({ where: { id } });
  if (!p) {
    throw new AppError(404, 'ZonePolicy not found', [{ message: 'No zone policy exists with the provided id', code: 'NOT_FOUND' }]);
  }
  return p;
};

const createZonePolicy = async (dto: CreateZonePolicyDto) => {
  const created = await prisma.zonePolicy.create({ data: { policyName: dto.policyName, deliveryTime: dto.deliveryTime, shippingCost: dto.shippingCost, status: dto.status ?? undefined } });
  return created;
};

const updateZonePolicy = async (id: string, payload: UpdateZonePolicyDto) => {
  const existing = await prisma.zonePolicy.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError(404, 'ZonePolicy not found', [{ message: 'No zone policy exists with the provided id', code: 'NOT_FOUND' }]);
  }

  const updated = await prisma.zonePolicy.update({ where: { id }, data: payload as any });
  return updated;
};

const deleteZonePolicy = async (id: string) => {
  const existing = await prisma.zonePolicy.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError(404, 'ZonePolicy not found', [{ message: 'No zone policy exists with the provided id', code: 'NOT_FOUND' }]);
  }

  await prisma.zonePolicy.delete({ where: { id } });
  return true;
};

export const zonePolicyService = {
  getZonePolicies,
  getAllZonePolicies,
  getZonePolicyById,
  createZonePolicy,
  updateZonePolicy,
  deleteZonePolicy
};
