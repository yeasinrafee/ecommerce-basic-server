import { Response } from 'express';
import { env } from '../../config/env.js';
import { AuthTokens } from './token.js';

const parseDuration = (value: string): number => {
  const match = /^([0-9]+)([smhd])$/.exec(value);
  if (!match) {
    return parseInt(value, 10) || 0;
  }

  const num = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's':
      return num * 1000;
    case 'm':
      return num * 60 * 1000;
    case 'h':
      return num * 60 * 60 * 1000;
    case 'd':
      return num * 24 * 60 * 60 * 1000;
    default:
      return num;
  }
};

export const setAuthCookies = (res: Response, tokens: AuthTokens) => {
  const baseOpts = {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax' as const,
    path: '/'
  };

  res.cookie('accessToken', tokens.accessToken, {
    ...baseOpts,
    maxAge: parseDuration(env.jwtAccessExpires)
  });
  res.cookie('refreshToken', tokens.refreshToken, {
    ...baseOpts,
    maxAge: parseDuration(env.jwtRefreshExpires)
  });
};

export const clearAuthCookies = (res: Response) => {
  const baseOpts = {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax' as const,
    path: '/'
  };

  res.clearCookie('accessToken', baseOpts);
  res.clearCookie('refreshToken', baseOpts);
};
