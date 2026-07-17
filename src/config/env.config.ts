import dotenv from 'dotenv';

dotenv.config();

export const env = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || '',
  jwtSecret: process.env.JWT_SECRET || 'supersecret',
  dburl: process.env.DB_URL || "mongodb://127.0.0.1:27017/mydatabase",
  logDbUrl: process.env.LOG_DB_URL || "mongodb://localhost:27017/fmd-logs",
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'no-reply@fms.local',
  },
};
