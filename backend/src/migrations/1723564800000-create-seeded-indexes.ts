import { createSeededIndexes, dropSeededIndexes } from './indexes';
import type { Db } from 'mongodb';

/**
 * Migration: create indexes for the seeded KaBarangayConnect collections.
 * Reuses shared helpers so `up` and `down` stay symmetric.
 */
export const up = async (db: Db): Promise<void> => {
  await createSeededIndexes(db);
};

export const down = async (db: Db): Promise<void> => {
  await dropSeededIndexes(db);
};