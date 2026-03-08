import { NextFunction, Request, Response } from 'express';
import { Role } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../errors/app-error.js';
import { verifyAccessToken } from '../utils/token.js';

const extractBearerToken = (req: Request): string => {
  const header = req.headers.authorization;

  if (!header || !header.toLowerCase().startsWith('bearer ')) {
    throw new AppError(401, 'Bearer token missing in Authorization header', [
      {
        message: 'Authorization header must start with Bearer',
        code: 'TOKEN_MISSING'
      }
    ]);
  }

  const token = header.split(' ')[1]?.trim();

  if (!token) {
    throw new AppError(401, 'Access token missing', [
      {
        message: 'Bearer token is required',
        code: 'TOKEN_MISSING'
      }
    ]);
  }

  return token;
};

export const authenticate = async (req: Request, _res: Response, next: NextFunction) => {
  const token = extractBearerToken(req);
  const payload = verifyAccessToken(token);

  const user = await prisma.user.findUnique({
    where: {
      id: payload.id
    }
  });

  if (!user) {
    throw new AppError(401, 'User not found', [
      {
        message: 'No user corresponds to the provided token',
        code: 'USER_NOT_FOUND'
      }
    ]);
  }

  console.log(user);

  req.user = {
    id: user.id,
    email: user.email,
    role: user.role,
    name: payload.name
  };

  next();
};

export const authorizeRoles = (...allowedRoles: Role[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AppError(401, 'Authentication required', [
        {
          message: 'Login required to access this route',
          code: 'AUTH_REQUIRED'
        }
      ]);
    }

    console.log("req:",req.user);

    if (allowedRoles.length === 0 || allowedRoles.includes(req.user.role)) {
      next();
      return;
    }

    throw new AppError(403, 'Access denied', [
      {
        message: 'Insufficient permissions for this operation',
        code: 'INSUFFICIENT_ROLE'
      }
    ]);
  };
};