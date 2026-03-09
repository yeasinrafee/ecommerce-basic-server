export type CreateShippingDto = {
  minimumFreeShippingAmount: number;
  tax: number;
  defaultShippingCharge: number;
  maximumWeight?: number | null;
  maximumVolume?: number | null;
  chargePerWeight?: number | null;
  chargePerVolume?: number | null;
};

export type UpdateShippingDto = Partial<CreateShippingDto>;
