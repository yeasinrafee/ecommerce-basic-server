import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../common/errors/app-error.js";
import {
  generateAuthTokens,
  verifyRefreshToken,
} from "../../common/utils/token.js";
import {
  deleteCloudinaryAsset,
  uploadMultipleFilesToCloudinary,
} from "../../common/utils/file-upload.js";
import {
  CreateAdminInput,
  CreateAdminResult,
  LoginInput,
  AuthResult,
} from "./auth.types.js";

const createAdmin = async (
  payload: CreateAdminInput,
  files: Express.Multer.File[],
): Promise<CreateAdminResult> => {
  const existingUser = await prisma.user.findUnique({
    where: {
      email: payload.email,
    },
  });

  if (existingUser) {
    throw new AppError(409, "Email is already registered", [
      {
        field: "email",
        message: "A user with this email already exists",
        code: "EMAIL_ALREADY_EXISTS",
      },
    ]);
  }

  const hashedPassword = await bcrypt.hash(payload.password, 12);
  const generatedUserId = crypto.randomUUID();

  let profileImage: string | null = null;
  let uploadedImagePublicId: string | null = null;

  if (files.length > 0) {
    const uploadedFiles = await uploadMultipleFilesToCloudinary(files, {
      projectFolder: "admins",
      entityId: generatedUserId,
      fileNamePrefix: "admin",
    });

    profileImage = uploadedFiles[0]?.secureUrl ?? null;
    uploadedImagePublicId = uploadedFiles[0]?.publicId ?? null;
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          id: generatedUserId,
          email: payload.email,
          password: hashedPassword,
          role: Role.ADMIN,
        },
      });

      const admin = await tx.admin.create({
        data: {
          userId: user.id,
          name: payload.name,
          image: profileImage,
        },
      });

      return {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          name: admin.name,
          image: admin.image,
          status: admin.status,
        },
      };
    });
  } catch (err) {
    if (uploadedImagePublicId) {
      try {
        await deleteCloudinaryAsset(uploadedImagePublicId);
      } catch (cleanupErr) {
        console.warn("Failed to cleanup uploaded admin image after tx failure", {
          uploadedImagePublicId,
          err: (cleanupErr as Error).message,
        });
      }
    }

    throw err;
  }
};

const login = async (payload: LoginInput): Promise<AuthResult> => {
  const user = await prisma.user.findUnique({
    where: {
      email: payload.email,
    },
  });

  if (!user) {
    throw new AppError(404, "User not found", [
      {
        field: "email",
        message: "No user corresponds to the provided email",
        code: "USER_NOT_FOUND",
      },
    ]);
  }

  const isPasswordValid = await bcrypt.compare(payload.password, user.password);

  if (!isPasswordValid) {
    throw new AppError(401, "Invalid password", [
      {
        field: "password",
        message: "The provided password is incorrect",
        code: "INVALID_PASSWORD",
      },
    ]);
  }

  const admin = await prisma.admin.findUnique({
    where: {
      userId: user.id,
    },
  });

  if (!admin) {
    throw new AppError(404, "Admin profile not found", [
      {
        message: "The user does not have an admin profile",
        code: "ADMIN_PROFILE_NOT_FOUND",
      },
    ]);
  }

  const tokens = generateAuthTokens({
    id: user.id,
    email: user.email,
    name: admin.name,
    role: user.role,
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      name: admin.name,
      image: admin.image,
      status: admin.status,
    },
    tokens,
  };
};

const refreshTokens = async (refreshToken: string) => {
  const payload = verifyRefreshToken(refreshToken);

  const user = await prisma.user.findUnique({
    where: {
      id: payload.id,
    },
  });

  if (!user) {
    throw new AppError(401, "User not found", [
      {
        message: "No user corresponds to the provided refresh token",
        code: "USER_NOT_FOUND",
      },
    ]);
  }

  const admin = await prisma.admin.findUnique({
    where: {
      userId: user.id,
    },
  });

  const name = admin?.name ?? payload.name;

  return generateAuthTokens({
    id: user.id,
    email: user.email,
    name,
    role: user.role,
  });
};

export const authService = {
  createAdmin,
  login,
  refreshTokens,
};
