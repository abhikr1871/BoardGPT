import mongoose from 'mongoose';
import { env } from './env.js';

/**
 * Connects to MongoDB using MONGODB_URI. The variable is validated in env.ts,
 * so by the time we get here it is guaranteed to be a non-empty string; the
 * extra guard below keeps the failure message obvious if this module is ever
 * used in isolation.
 */
export async function connectDb(): Promise<typeof mongoose> {
  if (!env.MONGODB_URI) {
    throw new Error(
      'MONGODB_URI is not set. Provide a MongoDB connection string (e.g. a ' +
        'MongoDB Atlas URI) in your environment before starting the server.',
    );
  }

  // Fail fast on a bad/unreachable URI instead of buffering commands forever.
  mongoose.set('strictQuery', true);

  await mongoose.connect(env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10_000,
  });

  return mongoose;
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}
