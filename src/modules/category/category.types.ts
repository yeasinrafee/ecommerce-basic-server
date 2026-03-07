export type CreateCategoryDto = {
	name: string;
};

export type UpdateCategoryDto = Partial<CreateCategoryDto>;

export type CategoryListQuery = {
	page?: number;
	limit?: number;
	/**
	 * optional term to filter categories by name (case-insensitive, contains)
	 */
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
