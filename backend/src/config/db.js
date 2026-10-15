import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from './logger.js';

mongoose.set('strictQuery', true);

export async function connectDatabase(uri = env.MONGO_URI) {
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
  mongoose.connection.on('reconnected', () => logger.info('MongoDB reconnected'));

  await mongoose.connect(uri, {
    // Building indexes on boot blocks writes on large collections, so production syncs them explicitly (`npm run db:indexes`).
    autoIndex: !env.isProduction,
    serverSelectionTimeoutMS: 10_000,
  });
  logger.info({ host: mongoose.connection.host, db: mongoose.connection.name }, 'MongoDB connected');
}

export async function disconnectDatabase() {
  mongoose.connection.removeAllListeners('disconnected'); // intentional shutdown is not a warning
  await mongoose.disconnect();
}
