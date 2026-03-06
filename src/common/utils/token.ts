import jwt, { SignOptions } from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { env } from '../../config/env.js';
import { AppError } from '../errors/app-error.js';

export type AuthTokenPayload = {
  id: string;
  email: string;
  name: string;
  role: Role;
  image?: string | null;
};

const signToken = (
  payload: AuthTokenPayload,
  secret: string,
  expiresIn: string
): string => {
  return jwt.sign(payload, secret, {
    expiresIn: expiresIn as SignOptions['expiresIn']
  });
};

export const generateAuthTokens = (payload: AuthTokenPayload) => {
  // include image if present
  const accessToken = signToken(payload, env.jwtAccessSecret, env.jwtAccessExpires);
  const refreshToken = signToken(payload, env.jwtRefreshSecret, env.jwtRefreshExpires);

  return {
    accessToken,
    refreshToken
  };
};

export const verifyAccessToken = (token: string): AuthTokenPayload => {
  try {
    const decoded = jwt.verify(token, env.jwtAccessSecret);

    if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) {
      throw new Error('Access token payload is invalid');
    }

    return decoded as AuthTokenPayload;
  } catch (error) {
    throw new AppError(401, 'Invalid access token', [
      {
        message: (error as Error).message,
        code: 'INVALID_TOKEN'
      }
    ]);
  }
};

export const verifyRefreshToken = (token: string): AuthTokenPayload => {
  try {
    const decoded = jwt.verify(token, env.jwtRefreshSecret);

    if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) {
      throw new Error('Refresh token payload is invalid');
    }

    return decoded as AuthTokenPayload;
  } catch (error) {
    throw new AppError(401, 'Invalid refresh token', [
      {
        message: (error as Error).message,
        code: 'INVALID_TOKEN'
      }
    ]);
  }
};
