/**
 * Builds/updates indexes declared in the Mongoose schemas and drops ones no longer declared.
 * Production runs this as a deploy step instead of relying on autoIndex at boot.
 * Usage: npm run db:indexes
 */
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { logger } from '../config/logger.js';
import '../models/index.js';

async function run() {
  await connectDatabase();
  for (const model of Object.values(mongoose.models)) {
    const dropped = await model.syncIndexes();
    logger.info({ model: model.modelName, dropped }, 'Indexes synced');
  }
}

run()
  .catch((err) => {
    logger.error({ err }, 'Index sync failed');
    process.exitCode = 1;
  })
  .finally(disconnectDatabase);
