export interface AddToCartDto {
    productId?: string;
    productIds?: string[];
}

export interface UpdateCartDto {
    productId?: string;
    productIds?: string[];
    addedToCart: boolean;
}

export interface RemoveFromCartDto {
    productId?: string;
    productIds?: string[];
}
