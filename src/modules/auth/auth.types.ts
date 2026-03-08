import { z } from 'zod';
import { Role } from '@prisma/client';
import { AppError } from '../../common/errors/app-error.js';
import { AuthTokens } from '../../common/utils/token.js';

const parsePayload = <Schema extends z.ZodTypeAny>(schema: Schema, payload: unknown): z.infer<Schema> => {
	const parsed = schema.safeParse(payload);

	if (!parsed.success) {
		throw new AppError(
			400,
			'Validation failed',
			parsed.error.issues.map((issue) => ({
				field: issue.path.join('.') || undefined,
				message: issue.message,
				code: 'VALIDATION_ERROR'
			}))
		);
	}

	return parsed.data;
};

export const createAdminSchema = z.object({
	name: z
		.string()
		.trim()
		.min(1, 'Name is required')
		.min(2, 'Name must be at least 2 characters'),
	email: z
		.string()
		.trim()
		.min(1, 'Email is required')
		.email('A valid email address is required'),
	password: z
		.string()
		.min(1, 'Password is required')
		.min(8, 'Password must be at least 8 characters')
		.max(100, 'Password cannot be longer than 100 characters')
});

export type CreateAdminInput = z.infer<typeof createAdminSchema>;

export const validateCreateAdminPayload = (payload: unknown): CreateAdminInput =>
	parsePayload(createAdminSchema, payload);

export const loginSchema = z.object({
	email: z
		.string()
		.trim()
		.min(1, 'Email is required')
		.email('A valid email address is required'),
	password: z
		.string()
		.min(1, 'Password is required')
		.min(8, 'Password must be at least 8 characters')
		.max(100, 'Password cannot be longer than 100 characters')
});

export type LoginInput = z.infer<typeof loginSchema>;

export const validateLoginPayload = (payload: unknown): LoginInput =>
	parsePayload(loginSchema, payload);

export type CreateAdminResult = {
	user: {
		id: string;
		email: string;
		role: Role;
		name: string;
		image: string | null;
		status: 'ACTIVE' | 'INACTIVE';
	};
	tokens: AuthTokens;
};

