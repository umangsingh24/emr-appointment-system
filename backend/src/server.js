import http from 'node:http';
import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { initSocket } from './sockets/index.js';

async function start() {
  await connectDatabase();

  const app = createApp();
  const server = http.createServer(app);
  const io = initSocket(server);

  server.listen(env.PORT, () => logger.info(`API listening on port ${env.PORT} (${env.NODE_ENV})`));

  const shutdown = async (signal) => {
    logger.info(`${signal} received, shutting down gracefully`);
    io.close();
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
    // Force exit if connections refuse to drain.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'Unhandled promise rejection');
  process.exit(1);
});

start().catch((err) => {
  logger.fatal({ err }, 'Failed to start server');
  process.exit(1);
});
