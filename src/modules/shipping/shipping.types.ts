export type CreateShippingDto = {
  minimumFreeShippingAmount: number;
  tax: number;
  defaultShippingCharge: number;
  maximumWeight?: number | null;
  maximumVolume?: number | null;
  length?: number | null;
  width?: number | null;
  height?: number | null;
  chargePerWeight?: number | null;
  chargePerVolume?: number | null;
};

export type UpdateShippingDto = Partial<CreateShippingDto>;
