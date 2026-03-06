import { z } from 'zod';
import { Role } from '@prisma/client';
import { AppError } from '../../common/errors/app-error.js';

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

export const validateCreateAdminPayload = (payload: unknown): CreateAdminInput => {
	const parsed = createAdminSchema.safeParse(payload);

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

export type CreateAdminResult = {
	admin: {
		id: string;
		userId: string;
		name: string;
		image: string | null;
		createdAt: Date;
		updatedAt: Date;
	};
	user: {
		id: string;
		email: string;
		role: Role;
		name: string;
		image: string | null;
	};
	tokens: {
		accessToken: string;
		refreshToken: string;
	};
};

export const refreshTokenSchema = z.object({
	refreshToken: z.string().min(1, 'Refresh token is required')
});

export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;

export type RefreshTokenResult = {
	user: {
		id: string;
		email: string;
		role: Role;
		name: string;
		image: string | null;
	};
	tokens: {
		accessToken: string;
		refreshToken: string;
	};
};

