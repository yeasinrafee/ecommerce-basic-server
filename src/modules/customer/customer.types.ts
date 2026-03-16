import { Status } from "@prisma/client";

export interface CustomerListQuery {
    page?: number;
    limit?: number;
    searchTerm?: string;
    status?: Status;
}

export interface UpdateCustomerDto {
    image?: string;
    phone?: string;
}

export interface BulkUpdateStatusDto {
    ids: string[];
    status: Status;
}
