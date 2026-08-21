import fs from 'fs';
import path from 'path';

/**
 * Scaffolds a new migration file in src/migrations with a timestamp prefix,
 * e.g. src/migrations/1723564800000-my-migration.ts
 */
const MIGRATIONS_DIR = path.resolve(process.cwd(), 'src', 'migrations');

async function main(): Promise<void> {
  const description = process.argv[2]?.trim().replace(/\s+/g, '-')?.toLowerCase();
  if (!description) {
    console.error('Usage: ts-node src/scripts/migrate-create.ts <description>');
    process.exit(1);
  }

  const timestamp = Date.now();
  const fileName = `${timestamp}-${description}.ts`;
  const fullPath = path.join(MIGRATIONS_DIR, fileName);

  const now = new Date().toISOString();
  const template = `import type { Db } from 'mongodb';

/**
 * Migration: ${description.replace(/-/g, ' ')} (${now})
 */
export const up = async (db: Db): Promise<void> => {
  // TODO write your migration here.
};

export const down = async (db: Db): Promise<void> => {
  // TODO write statements to rollback your migration (if possible).
};
`;

  fs.writeFileSync(fullPath, template, 'utf8');
  console.log('Created migration:', fullPath);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});