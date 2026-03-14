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
  corsOrigins: parseCorsOrigins(process.env.CORS_ORIGINS ?? 'http://localhost:3000'),
  cloudinaryCloudName: required(process.env.CLOUDINARY_CLOUD_NAME, 'CLOUDINARY_CLOUD_NAME'),
  cloudinaryApiKey: required(process.env.CLOUDINARY_API_KEY, 'CLOUDINARY_API_KEY'),
  cloudinaryApiSecret: required(process.env.CLOUDINARY_API_SECRET, 'CLOUDINARY_API_SECRET'),
  uploadsParentFolder: required(process.env.UPLOADS_PARENT_FOLDER, 'UPLOADS_PARENT_FOLDER'),
  jwtAccessSecret: required(process.env.JWT_ACCESS_SECRET, 'JWT_ACCESS_SECRET'),
  jwtRefreshSecret: required(process.env.JWT_REFRESH_SECRET, 'JWT_REFRESH_SECRET'),
  jwtAccessExpires: required(process.env.JWT_ACCESS_EXPIRES, 'JWT_ACCESS_EXPIRES'),
  jwtRefreshExpires: required(process.env.JWT_REFRESH_EXPIRES, 'JWT_REFRESH_EXPIRES'),
  mailHost: required(process.env.MAIL_HOST, 'MAIL_HOST'),
  mailUser: required(process.env.MAIL_USER, 'MAIL_USER'),
  mailPass: required(process.env.MAIL_PASS, 'MAIL_PASS'),
  mailFrom: required(process.env.MAIL_FROM, 'MAIL_FROM')
};
