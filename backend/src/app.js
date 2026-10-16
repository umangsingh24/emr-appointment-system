import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import { apiLimiter } from './middlewares/rateLimiter.js';
import apiRoutes from './routes/index.js';
import { sendSuccess } from './utils/apiResponse.js';

export const corsOptions = {
  origin: env.CORS_ORIGINS,
  credentials: true, // needed for the httpOnly refresh-token cookie
};

export function createApp() {
  const app = express();

  // Behind one reverse proxy/load balancer in production, so req.ip is the real client IP.
  if (env.isProduction) app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(cors(corsOptions));
  app.use(compression());
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  if (!env.isTest) app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/health' } }));

  app.get('/health', (_req, res) =>
    sendSuccess(res, {
      message: 'OK',
      data: { uptime: process.uptime(), database: mongoose.connection.readyState === 1 ? 'up' : 'down' },
    }),
  );

  app.use('/api/v1', apiLimiter, apiRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
