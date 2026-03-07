import { Request, Response } from 'express';
import { sendResponse } from '../../common/utils/send-response.js';
import { brandService } from './brand.service.js';

const createBrand = async (req: Request, res: Response) => {
	const { name } = req.body;
	const created = await brandService.createBrand({ name });

	sendResponse({
		res,
		statusCode: 201,
		success: true,
		message: 'Brand created',
		data: created
	});
};

const updateBrand = async (req: Request, res: Response) => {
	const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
	const payload = req.body;

	const updated = await brandService.updateBrand(id, payload);

	sendResponse({
		res,
		statusCode: 200,
		success: true,
		message: 'Brand updated',
		data: updated
	});
};

const getBrands = async (req: Request, res: Response) => {
	const page = Number(req.query.page ?? 1);
	const limit = Number(req.query.limit ?? 10);
	const searchTerm = typeof req.query.searchTerm === 'string' ? req.query.searchTerm : undefined;

	const result = await brandService.getBrands({ page, limit, searchTerm });

	sendResponse({
		res,
		statusCode: 200,
		success: true,
		message: 'Brands fetched',
		data: result.data,
		meta: {
			...result.meta,
			timestamp: new Date().toISOString()
		}
	});
};

const getBrand = async (req: Request, res: Response) => {
	const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
	const b = await brandService.getBrandById(id);

	sendResponse({
		res,
		statusCode: 200,
		success: true,
		message: 'Brand fetched',
		data: b
	});
};

const getAllBrands = async (req: Request, res: Response) => {
	const bs = await brandService.getAllBrands();

	sendResponse({
		res,
		statusCode: 200,
		success: true,
		message: 'All brands fetched',
		data: bs
	});
};

const deleteBrand = async (req: Request, res: Response) => {
	const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
	await brandService.deleteBrand(id);

	sendResponse({
		res,
		statusCode: 200,
		success: true,
		message: 'Brand deleted',
		data: null
	});
};

export const brandController = {
	createBrand,
	updateBrand,
	getBrands,
	getBrand,
	getAllBrands,
	deleteBrand
};

