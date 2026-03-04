import dotenv from 'dotenv';

dotenv.config();

const parseCorsOrigins = (value: string): string[] => {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

const required = (value: string | undefined, key: string): string => {
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
};

const nodeEnv = process.env.NODE_ENV ?? 'development';

export const env = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  port: Number(process.env.PORT ?? 5000),
  databaseUrl: required(process.env.DATABASE_URL, 'DATABASE_URL'),
  corsOrigins: parseCorsOrigins(process.env.CORS_ORIGINS ?? 'http://localhost:3000')
};
