import { prisma } from "../../config/prisma.js";
import { Prisma, Status } from "@prisma/client";
import { AppError } from "../../common/errors/app-error.js";
import { CustomerListQuery, UpdateCustomerDto, BulkUpdateStatusDto } from "./customer.types.js";

const getCustomers = async (query: CustomerListQuery) => {
    const { page = 1, limit = 20, searchTerm, status } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.CustomerWhereInput = {};

    if (searchTerm) {
        where.OR = [
            { phone: { contains: searchTerm, mode: 'insensitive' } },
            { user: { email: { contains: searchTerm, mode: 'insensitive' } } }
        ];
    }

    if (status) {
        where.status = status;
    }

    const [data, total] = await Promise.all([
        prisma.customer.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        role: true,
                        verified: true
                    }
                }
            }
        }),
        prisma.customer.count({ where })
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

const updateCustomer = async (id: string, _userId: string, payload: UpdateCustomerDto) => {
    return prisma.customer.update({
        where: { id },
        data: payload
    });
};

const getCustomerById = async (id: string) => {
    return prisma.customer.findUnique({
        where: { id }
    });
};

const getCustomerAddressesByUserId = async (userId: string) => {
    const customer = await prisma.customer.findUnique({
        where: { userId },
        select: {
            id: true
        }
    });

    if (!customer) {
        throw new AppError(404, "Customer not found");
    }

    return prisma.address.findMany({
        where: {
            customerId: customer.id
        },
        orderBy: {
            createdAt: "desc"
        },
        include: {
            zone: true
        }
    });
};

const bulkUpdateStatus = async (payload: BulkUpdateStatusDto) => {
    return prisma.customer.updateMany({
        where: {
            id: { in: payload.ids }
        },
        data: {
            status: payload.status
        }
    });
};

export const customerService = {
    getCustomers,
    updateCustomer,
    getCustomerById,
    getCustomerAddressesByUserId,
    bulkUpdateStatus
};
