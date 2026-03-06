import jwt, { SignOptions } from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { env } from '../../config/env.js';

export type AuthTokenPayload = {
  id: string;
  email: string;
  name: string;
  role: Role;
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
  const accessToken = signToken(payload, env.jwtAccessSecret, env.jwtAccessExpires);
  const refreshToken = signToken(payload, env.jwtRefreshSecret, env.jwtRefreshExpires);

  return {
    accessToken,
    refreshToken
  };
};
