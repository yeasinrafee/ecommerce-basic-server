import { prisma } from '../../config/prisma.js';
import toSlug from '../../common/utils/slug.js';
import { toUpperUnderscore } from '../../common/utils/format.js';
import { AppError } from '../../common/errors/app-error.js';
import type { CreateTagDto, UpdateTagDto, ServiceListResult, TagListQuery } from './tag.types.js';

const getTags = async ({ page = 1, limit = 10, searchTerm }: TagListQuery = {}): Promise<ServiceListResult<any>> => {
	const skip = (page - 1) * limit;
	const where = searchTerm
		? { name: { contains: searchTerm, mode: 'insensitive' } }
		: {};

	const [data, total] = await Promise.all([
		prisma.tag.findMany({
			where,
			skip,
			take: limit,
			orderBy: { createdAt: 'desc' }
		}),
		prisma.tag.count({ where })
	]);

	return {
		data,
		meta: {
			page,
			limit,
			total,
			totalPages: Math.max(1, Math.ceil(total / limit))
		}
	};
};

const getTagById = async (id: string) => {
	return prisma.tag.findUnique({ where: { id } });
};

const createTag = async ({ name }: CreateTagDto) => {
	const cleanNameKey = toUpperUnderscore(name);
	const slug = toSlug(name);

	const existing = await prisma.tag.findMany({ select: { id: true, name: true } });
	const conflict = existing.find((t) => toUpperUnderscore(t.name) === cleanNameKey);
	if (conflict) {
		throw new AppError(400, 'Tag name already exists', [
			{ message: 'A tag with that name exists', code: 'NAME_CONFLICT' }
		]);
	}

	const created = await prisma.tag.create({ data: { name, slug } });
	return created;
};

const updateTag = async (id: string, payload: UpdateTagDto) => {
	const existing = await prisma.tag.findUnique({ where: { id } });
	if (!existing) {
		throw new AppError(404, 'Tag not found', [
			{ message: 'No tag exists with the provided id', code: 'NOT_FOUND' }
		]);
	}

	if (payload.name) {
		const cleanNameKey = toUpperUnderscore(payload.name);
		const slug = toSlug(payload.name);

		const others = await prisma.tag.findMany({ where: { NOT: { id } }, select: { id: true, name: true } });
		const conflict = others.find((t) => toUpperUnderscore(t.name) === cleanNameKey);
		if (conflict) {
			throw new AppError(400, 'Tag name already exists', [
				{ message: 'Another tag uses this name', code: 'NAME_CONFLICT' }
			]);
		}

		return prisma.tag.update({ where: { id }, data: { name: payload.name, slug } });
	}

	return prisma.tag.update({ where: { id }, data: payload as any });
};

const deleteTag = async (id: string) => {
	await prisma.tag.delete({ where: { id } });
	return true;
};

const getAllTags = async () => {
	return prisma.tag.findMany({ orderBy: { createdAt: 'desc' } });
};

export const tagService = {
	getTags,
	getTagById,
	getAllTags,
	createTag,
	updateTag,
	deleteTag
};
