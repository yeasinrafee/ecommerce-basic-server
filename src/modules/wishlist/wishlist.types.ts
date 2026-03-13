export type WishlistQuery = {
    page?: number;
    limit?: number;
};

export type UpdateWishlistDto = {
    productIds?: string | string[];
    addedToCart?: boolean;
};

export type AddToCartWishlistDto = {
    productIds: string | string[];
};
