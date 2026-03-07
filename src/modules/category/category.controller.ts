import { Request, Response } from 'express';
import { sendResponse } from '../../common/utils/send-response.js';
import { categoryService } from './category.service.js';

const createCategory = async (req: Request, res: Response) => {
	const { name } = req.body;
	const created = await categoryService.createCategory({ name });

	sendResponse({
		res,
		statusCode: 201,
		success: true,
		message: 'Category created',
		data: created
	});
};

const updateCategory = async (req: Request, res: Response) => {
	const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
	const payload = req.body;

	const updated = await categoryService.updateCategory(id, payload);

	sendResponse({
		res,
		statusCode: 200,
		success: true,
		message: 'Category updated',
		data: updated
	});
};

const getCategories = async (req: Request, res: Response) => {
	const page = Number(req.query.page ?? 1);
	const limit = Number(req.query.limit ?? 10);
	const searchTerm = typeof req.query.searchTerm === 'string' ? req.query.searchTerm : undefined;

	const result = await categoryService.getCategories({ page, limit, searchTerm });

	sendResponse({
		res,
		statusCode: 200,
		success: true,
		message: 'Categories fetched',
		data: result.data,
		meta: {
			...result.meta,
			timestamp: new Date().toISOString()
		}
	});
};

const getCategory = async (req: Request, res: Response) => {
	const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
	const cat = await categoryService.getCategoryById(id);

	sendResponse({
		res,
		statusCode: 200,
		success: true,
		message: 'Category fetched',
		data: cat
	});
};

const getAllCategories = async (req: Request, res: Response) => {
	const cats = await categoryService.getAllCategories();

	sendResponse({
		res,
		statusCode: 200,
		success: true,
		message: 'All categories fetched',
		data: cats
	});
};

const deleteCategory = async (req: Request, res: Response) => {
	const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
	await categoryService.deleteCategory(id);

	sendResponse({
		res,
		statusCode: 200,
		success: true,
		message: 'Category deleted',
		data: null
	});
};

export const categoryController = {
	createCategory,
	updateCategory,
	getCategories,
	getCategory,
	getAllCategories,
	deleteCategory
};

