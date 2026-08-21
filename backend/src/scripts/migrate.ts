import 'dotenv/config';
import mongoose from 'mongoose';
import fs from 'fs/promises';
import path from 'path';

// Each migration module exports `{ up, down }` operating on a MongoDb.Db.
// This runner executes them in filename order (lexicographic) and records
// them in the `schema_migrations` changelog so they run exactly once.

const MIGRATIONS_DIR = path.resolve(process.cwd(), 'src', 'migrations');
const CHANGELOG = 'schema_migrations';
const SAMPLE_NAME = 'sample-migration.ts';

type MigrationFn = (db: unknown) => Promise<void>;
interface MigrationModule {
  up: MigrationFn;
  down: MigrationFn;
}

/** Returns the bound native DB, throwing if the connection has not resolved. */
function getDb(conn: mongoose.Connection): NonNullable<typeof conn.db> {
  if (!conn.db) {
    throw new Error('MongoDB connection has no bound database.');
  }
  return conn.db;
}

async function connect(): Promise<mongoose.Connection> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      'MONGODB_URI is not set. Add it to your .env file, then re-run the command.'
    );
  }
  const conn = mongoose.createConnection(uri);
  // Wait for the connection to be fully established (binds the native DB).
  await conn.asPromise();
  return conn;
}

function isMigrationFile(name: string): boolean {
  return (
    name.endsWith('.ts') &&
    !name.startsWith('indexes') &&
    name !== SAMPLE_NAME
  );
}

async function getApplied(conn: mongoose.Connection): Promise<string[]> {
  const collection = getDb(conn).collection(CHANGELOG);
  const docs = await collection.find({}, { projection: { fileName: 1 } }).toArray();
  return docs.map((d) => d.fileName as string).sort();
}

async function recordApplied(conn: mongoose.Connection, fileName: string): Promise<void> {
  await getDb(conn).collection(CHANGELOG).insertOne({
    fileName,
    appliedAt: new Date(),
    migrationBlock: Date.now(),
  });
}

async function removeApplied(conn: mongoose.Connection, fileName: string): Promise<void> {
  await getDb(conn).collection(CHANGELOG).deleteOne({ fileName });
}

async function loadMigration(fileName: string): Promise<MigrationModule> {
  const fullPath = path.join(MIGRATIONS_DIR, fileName);
  // Use require so ts-node's CommonJS hook transpiles the .ts migration on load.
  const mod = require(fullPath) as MigrationModule;
  return mod;
}

export async function runUp(): Promise<string[]> {
  const conn = await connect();
  try {
    const files = (await fs.readdir(MIGRATIONS_DIR)).filter(isMigrationFile).sort();
    const applied = new Set(await getApplied(conn));
    const migrated: string[] = [];

    for (const file of files) {
      if (applied.has(file)) continue;
      const mod = await loadMigration(file);
      await mod.up(conn.db);
      await recordApplied(conn, file);
      migrated.push(file);
      console.log(`MIGRATED UP: ${file}`);
    }

    if (migrated.length === 0) console.log('No pending migrations.');
    return migrated;
  } finally {
    await conn.close();
  }
}

export async function runDown(steps = 1): Promise<string[]> {
  const conn = await connect();
  try {
    const files = (await fs.readdir(MIGRATIONS_DIR)).filter(isMigrationFile).sort().reverse();
    const applied = new Set(await getApplied(conn));
    const reverted: string[] = [];
    let count = 0;

    for (const file of files) {
      if (count >= steps) break;
      if (!applied.has(file)) continue;
      const mod = await loadMigration(file);
      await mod.down(conn.db);
      await removeApplied(conn, file);
      reverted.push(file);
      count++;
      console.log(`MIGRATED DOWN: ${file}`);
    }

    if (reverted.length === 0) console.log('No migrations to revert.');
    return reverted;
  } finally {
    await conn.close();
  }
}

export async function runStatus(): Promise<void> {
  const conn = await connect();
  try {
    const files = (await fs.readdir(MIGRATIONS_DIR)).filter(isMigrationFile).sort();
    const applied = new Set(await getApplied(conn));

    console.log('Filename | Applied At');
    for (const file of files) {
      console.log(`${file} | ${applied.has(file) ? 'applied' : 'PENDING'}`);
    }
  } finally {
    await conn.close();
  }
}

// CLI dispatch when run directly via ts-node.
const [, , command, arg] = process.argv;
async function main(): Promise<void> {
  if (command === 'up') {
    await runUp();
  } else if (command === 'down') {
    const steps = Number(arg || '1');
    await runDown(steps);
  } else if (command === 'status') {
    await runStatus();
  } else {
    console.log('Usage: ts-node src/scripts/migrate.ts <up|down [steps]|status>');
  }
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}