import { MongoMemoryReplSet } from 'mongodb-memory-server';

/** A single-node replica set, so transactions behave exactly as on Atlas. */
export default async function globalSetup({ provide }) {
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  provide('mongoUri', replSet.getUri());

  return async () => {
    await replSet.stop();
  };
}
