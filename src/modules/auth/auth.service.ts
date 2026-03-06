import bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../common/errors/app-error.js';
import {
	generateAuthTokens,
	verifyRefreshToken
} from '../../common/utils/token.js';
import { uploadMultipleFilesToCloudinary } from '../../common/utils/file-upload.js';
import { CreateAdminInput, CreateAdminResult } from './auth.types.js';

const createAdmin = async (
	payload: CreateAdminInput,
	files: Express.Multer.File[]
): Promise<CreateAdminResult> => {
	const existingUser = await prisma.user.findUnique({
		where: {
			email: payload.email
		}
	});

	if (existingUser) {
		throw new AppError(409, 'Email is already registered', [
			{
				field: 'email',
				message: 'A user with this email already exists',
				code: 'EMAIL_ALREADY_EXISTS'
			}
		]);
	}

	const hashedPassword = await bcrypt.hash(payload.password, 12);

	return prisma.$transaction(async (tx) => {
		const user = await tx.user.create({
			data: {
				email: payload.email,
				password: hashedPassword,
				role: Role.ADMIN
			}
		});

		const uploadedFiles = await uploadMultipleFilesToCloudinary(files, {
			projectFolder: 'admins',
			entityId: user.id,
			subFolder: user.id,
			fileNamePrefix: 'admin'
		});

		const profileImage = uploadedFiles[0]?.secureUrl ?? null;

		const admin = await tx.admin.create({
			data: {
				userId: user.id,
				name: payload.name,
				image: profileImage
			}
		});

		const tokens = generateAuthTokens({
			id: user.id,
			email: user.email,
			name: admin.name,
			role: user.role
		});

		return {
			admin,
			user: {
				id: user.id,
				email: user.email,
				role: user.role,
				name: admin.name,
				image: admin.image
			},
			tokens
		};
	});
};

	const refreshTokens = async (refreshToken: string) => {
		const payload = verifyRefreshToken(refreshToken);

		const user = await prisma.user.findUnique({
			where: {
				id: payload.id
			}
		});

		if (!user) {
			throw new AppError(401, 'User not found', [
				{
					message: 'No user corresponds to the provided refresh token',
					code: 'USER_NOT_FOUND'
				}
			]);
		}

		const admin = await prisma.admin.findUnique({
			where: {
				userId: user.id
			}
		});

		const name = admin?.name ?? payload.name;

		return generateAuthTokens({
			id: user.id,
			email: user.email,
			name,
			role: user.role
		});
	};

export const authService = {
	createAdmin,
	refreshTokens
};

