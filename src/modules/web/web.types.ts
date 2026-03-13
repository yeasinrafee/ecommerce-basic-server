export type CreateWebDto = {
    email?: string;
    address?: string;
    phone?: string;
    shortDescription?: string;
    workingHours?: string;
    logo?: string | null;
};

export type UpdateWebDto = Partial<CreateWebDto>;

export type CreateCompanyInformationDto = {
    termsOfService?: string;
    termsAndConditions?: string;
    privacyPolicy?: string;
    refundPolicy?: string;
    shippingPolicy?: string;
    sizeChart?: string;
};

export type UpdateCompanyInformationDto = Partial<CreateCompanyInformationDto>;

export type CreateFaqDto = {
    question: string;
    answer: string;
};
export type UpdateFaqDto = Partial<CreateFaqDto> & { id: string; };

export type CreateSocialMediaLinkDto = {
    name: string;
    link: string;
};
export type UpdateSocialMediaLinkDto = Partial<CreateSocialMediaLinkDto> & { id: string; };

export type CreateSliderDto = {
    image: string;
    link?: string | null;
};
export type UpdateSliderDto = Partial<CreateSliderDto> & { id: string; };

export type CreateTestimonialDto = {
    name: string;
    designation: string;
    rating: number;
    comment: string;
    image?: string | null;
};
export type UpdateTestimonialDto = Partial<CreateTestimonialDto> & { id: string; };
