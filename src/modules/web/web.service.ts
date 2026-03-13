import { prisma } from '../../config/prisma.js';
import { AppError } from '../../common/errors/app-error.js';
import type { 
    CreateWebDto, UpdateWebDto, CreateCompanyInformationDto, UpdateCompanyInformationDto, 
    CreateFaqDto, UpdateFaqDto, CreateSocialMediaLinkDto, UpdateSocialMediaLinkDto, 
    CreateSliderDto, UpdateSliderDto, CreateTestimonialDto, UpdateTestimonialDto 
} from './web.types.js';
import { deleteCloudinaryAsset, getPublicIdFromUrl } from '../../common/utils/file-upload.js';

// --- Web ---
const getWeb = async () => {
    return prisma.web.findFirst();
};

const createOrUpdateWeb = async (payload: CreateWebDto, newlyUploadedPublicId?: string | null) => {
    const existing = await prisma.web.findFirst();

    if (existing) {
        if (payload.logo && existing.logo) {
            const previousPublicId = getPublicIdFromUrl(existing.logo);
            if (previousPublicId && previousPublicId !== newlyUploadedPublicId) {
                try {
                    await deleteCloudinaryAsset(previousPublicId);
                } catch (err) {
                    console.warn('Failed to delete old web logo asset', { previousPublicId, err: (err as Error).message });
                }
            }
        }
        return prisma.web.update({
            where: { id: existing.id },
            data: payload
        });
    }

    return prisma.web.create({ data: payload });
};

const updateWeb = async (payload: UpdateWebDto, newlyUploadedPublicId?: string | null) => {
    const existing = await prisma.web.findFirst();
    if (!existing) {
        throw new AppError(404, 'Web data not found', [{ message: 'No web data exists to update', code: 'NOT_FOUND' }]);
    }

    if (payload.logo && existing.logo) {
        const previousPublicId = getPublicIdFromUrl(existing.logo);
        if (previousPublicId && previousPublicId !== newlyUploadedPublicId) {
            try {
                await deleteCloudinaryAsset(previousPublicId);
            } catch (err) {
                console.warn('Failed to delete old web logo asset', { previousPublicId, err: (err as Error).message });
            }
        }
    }

    return prisma.web.update({
        where: { id: existing.id },
        data: payload
    });
};

const deleteWeb = async () => {
    const existing = await prisma.web.findFirst();
    if (!existing) {
        throw new AppError(404, 'Web data not found', [{ message: 'No web data exists', code: 'NOT_FOUND' }]);
    }

    if (existing.logo) {
        const previousPublicId = getPublicIdFromUrl(existing.logo);
        if (previousPublicId) {
            try {
                await deleteCloudinaryAsset(previousPublicId);
            } catch (err) {
                console.warn('Failed to delete cloud asset before web removal', { previousPublicId, err: (err as Error).message });
            }
        }
    }

    await prisma.web.delete({ where: { id: existing.id } });
    return true;
};

// --- Company Information ---
const getCompanyInformation = async () => {
    return prisma.companyInformation.findFirst();
};

const createOrUpdateCompanyInformation = async (payload: CreateCompanyInformationDto) => {
    const existing = await prisma.companyInformation.findFirst();
    if (existing) {
        return prisma.companyInformation.update({
            where: { id: existing.id },
            data: payload
        });
    }
    return prisma.companyInformation.create({ data: payload });
};

const updateCompanyInformation = async (payload: UpdateCompanyInformationDto) => {
    const existing = await prisma.companyInformation.findFirst();
    if (!existing) {
        throw new AppError(404, 'Company information not found', [{ message: 'No company info exists to update', code: 'NOT_FOUND' }]);
    }
    return prisma.companyInformation.update({
        where: { id: existing.id },
        data: payload
    });
};

const deleteCompanyInformation = async () => {
    const existing = await prisma.companyInformation.findFirst();
    if (!existing) {
        throw new AppError(404, 'Company information not found', [{ message: 'No company info exists', code: 'NOT_FOUND' }]);
    }
    await prisma.companyInformation.delete({ where: { id: existing.id } });
    return true;
};

// --- Faq ---
const getFaqs = async () => prisma.faq.findMany({ orderBy: { createdAt: 'desc' } });
const getFaq = async (id: string) => prisma.faq.findUnique({ where: { id } });
const createFaq = async (payload: CreateFaqDto | CreateFaqDto[]) => {
    if (Array.isArray(payload)) {
        return prisma.$transaction(payload.map(data => prisma.faq.create({ data })));
    }
    return prisma.faq.create({ data: payload });
};
const updateFaq = async (payload: UpdateFaqDto | UpdateFaqDto[]) => {
    if (Array.isArray(payload)) {
        return prisma.$transaction(payload.map(data => prisma.faq.update({ where: { id: data.id }, data })));
    }
    return prisma.faq.update({ where: { id: payload.id }, data: payload });
};
const deleteFaq = async (ids: string | string[]) => {
    const idArray = Array.isArray(ids) ? ids : [ids];
    return prisma.faq.deleteMany({ where: { id: { in: idArray } } });
};

// --- SocialMediaLink ---
const getSocialMediaLinks = async () => prisma.socialMediaLink.findMany({ orderBy: { createdAt: 'desc' } });
const getSocialMediaLink = async (id: string) => prisma.socialMediaLink.findUnique({ where: { id } });
const createSocialMediaLink = async (payload: CreateSocialMediaLinkDto | CreateSocialMediaLinkDto[]) => {
    if (Array.isArray(payload)) {
        return prisma.$transaction(payload.map(data => prisma.socialMediaLink.create({ data })));
    }
    return prisma.socialMediaLink.create({ data: payload });
};
const updateSocialMediaLink = async (payload: UpdateSocialMediaLinkDto | UpdateSocialMediaLinkDto[]) => {
    if (Array.isArray(payload)) {
        return prisma.$transaction(payload.map(data => prisma.socialMediaLink.update({ where: { id: data.id }, data })));
    }
    return prisma.socialMediaLink.update({ where: { id: payload.id }, data: payload });
};
const deleteSocialMediaLink = async (ids: string | string[]) => {
    const idArray = Array.isArray(ids) ? ids : [ids];
    return prisma.socialMediaLink.deleteMany({ where: { id: { in: idArray } } });
};

// --- Slider ---
const getSliders = async () => prisma.slider.findMany({ orderBy: { createdAt: 'desc' } });
const getSlider = async (id: string) => prisma.slider.findUnique({ where: { id } });
const getSlidersByIds = async (ids: string[]) => prisma.slider.findMany({ where: { id: { in: ids } } });
const createSlider = async (payload: CreateSliderDto | CreateSliderDto[]) => {
    if (Array.isArray(payload)) {
        return prisma.$transaction(payload.map(data => prisma.slider.create({ data })));
    }
    return prisma.slider.create({ data: payload });
};
const updateSlider = async (payload: UpdateSliderDto | UpdateSliderDto[]) => {
    if (Array.isArray(payload)) {
        return prisma.$transaction(payload.map(data => prisma.slider.update({ where: { id: data.id }, data })));
    }
    return prisma.slider.update({ where: { id: payload.id }, data: payload });
};
const deleteSlider = async (ids: string | string[]) => {
    const idArray = Array.isArray(ids) ? ids : [ids];
    const existing = await prisma.slider.findMany({ where: { id: { in: idArray } } });
    const deleted = await prisma.slider.deleteMany({ where: { id: { in: idArray } } });
    for (const item of existing) {
        if (item.image) {
            const pubId = getPublicIdFromUrl(item.image);
            if (pubId) await deleteCloudinaryAsset(pubId).catch(() => {});
        }
    }
    return deleted;
};

// --- Testimonial ---
const getTestimonials = async () => prisma.testimonial.findMany({ orderBy: { createdAt: 'desc' } });
const getTestimonial = async (id: string) => prisma.testimonial.findUnique({ where: { id } });
const getTestimonialsByIds = async (ids: string[]) => prisma.testimonial.findMany({ where: { id: { in: ids } } });
const createTestimonial = async (payload: CreateTestimonialDto | CreateTestimonialDto[]) => {
    if (Array.isArray(payload)) {
        return prisma.$transaction(payload.map(data => prisma.testimonial.create({ data })));
    }
    return prisma.testimonial.create({ data: payload });
};
const updateTestimonial = async (payload: UpdateTestimonialDto | UpdateTestimonialDto[]) => {
    if (Array.isArray(payload)) {
        return prisma.$transaction(payload.map(data => prisma.testimonial.update({ where: { id: data.id }, data })));
    }
    return prisma.testimonial.update({ where: { id: payload.id }, data: payload });
};
const deleteTestimonial = async (ids: string | string[]) => {
    const idArray = Array.isArray(ids) ? ids : [ids];
    const existing = await prisma.testimonial.findMany({ where: { id: { in: idArray } } });
    const deleted = await prisma.testimonial.deleteMany({ where: { id: { in: idArray } } });
    for (const item of existing) {
        if (item.image) {
            const pubId = getPublicIdFromUrl(item.image);
            if (pubId) await deleteCloudinaryAsset(pubId).catch(() => {});
        }
    }
    return deleted;
};

export const webService = {
    getWeb,
    createOrUpdateWeb,
    updateWeb,
    deleteWeb,
    getCompanyInformation,
    createOrUpdateCompanyInformation,
    updateCompanyInformation,
    deleteCompanyInformation,
    getFaqs, getFaq, createFaq, updateFaq, deleteFaq,
    getSocialMediaLinks, getSocialMediaLink, createSocialMediaLink, updateSocialMediaLink, deleteSocialMediaLink,
    getSliders, getSlider, getSlidersByIds, createSlider, updateSlider, deleteSlider,
    getTestimonials, getTestimonial, getTestimonialsByIds, createTestimonial, updateTestimonial, deleteTestimonial
};
