export type CreateBrandDto = {
	name: string;
};

export type UpdateBrandDto = Partial<CreateBrandDto>;

export type BrandListQuery = {
	page?: number;
	limit?: number;
	searchTerm?: string;
};

export type ServiceListResult<T> = {
	data: T[];
	meta: {
		page: number;
		limit: number;
		total: number;
		totalPages: number;
	};
};

