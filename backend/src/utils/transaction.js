import mongoose from 'mongoose';
import { logger } from '../config/logger.js';

let transactionsSupported;

/** Transactions need a replica set or sharded cluster (Atlas always is; a bare local `mongod` is not). */
async function supportsTransactions() {
  if (transactionsSupported === undefined) {
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    transactionsSupported = Boolean(hello.setName || hello.msg === 'isdbgrid');
    if (!transactionsSupported) {
      logger.warn('MongoDB is a standalone server: multi-document writes run without a transaction');
    }
  }
  return transactionsSupported;
}

/**
 * Runs `work(session)` inside a transaction when the deployment supports it.
 * On a standalone server `session` is undefined and callers must stay correct without
 * atomicity across documents (the slot unique index still guarantees no double booking).
 */
export async function withTransaction(work) {
  if (!(await supportsTransactions())) return work(undefined);

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}
