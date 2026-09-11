import 'dotenv/config';
import mongoose from 'mongoose';
import { SEEDED_INDEXES } from '../migrations/indexes';
import { CHANGELOG, listMigrationFiles } from './migrate';

/**
 * Post-migration verification — the deploy pipeline's "did that actually work?"
 * gate.
 *
 * `migrate.ts up` records a migration in the changelog only AFTER its `up()`
 * resolved, so a green `up` run is not by itself proof that the database is in
 * the shape the handlers expect. This script asserts the things the application
 * actually depends on and exits non-zero with a report if any of them fail:
 *
 *   1. the database is reachable with the deployed `MONGODB_URI`;
 *   2. every migration file on disk is recorded in `schema_migrations`
 *      (i.e. nothing is still pending);
 *   3. every index declared in `SEEDED_INDEXES` exists on its collection —
 *      matched on key + options rather than name, because the Mongoose models
 *      also declare `unique`/`sparse` fields whose auto-generated index names
 *      (e.g. `residentId_1`) can legitimately shadow the migration's name;
 *      name drift is reported as a note instead of failing the run;
 *   4. every populated collection can be queried (a real round-trip).
 *
 * Used by `.github/workflows/deploy.yml`, which reverts the migrations it just
 * applied if this exits non-zero. Run locally with `npm run verify:migrations`.
 */

const failures: string[] = [];
const notes: string[] = [];

/** Collections Mongo has never had a document written to are skipped, not failed. */
function isNamespaceMissing(error: unknown): boolean {
  const code = (error as { code?: number; codeName?: string } | null)?.code;
  const codeName = (error as { codeName?: string } | null)?.codeName;
  return code === 26 || codeName === 'NamespaceNotFound';
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** The subset of an index definition this script compares. */
interface IndexSpec {
  name?: string;
  key: Record<string, unknown>;
  unique?: boolean;
  sparse?: boolean;
}

/** Order-independent signature for an index key pattern. */
function keySignature(key: Record<string, unknown>): string {
  return Object.keys(key)
    .sort()
    .map((field) => `${field}:${String(key[field])}`)
    .join(',');
}

function describeSpec(spec: IndexSpec): string {
  const flags = `${spec.unique ? ' unique' : ''}${spec.sparse ? ' sparse' : ''}`;
  return `${spec.name ?? keySignature(spec.key)} [${keySignature(spec.key)}${flags}]`;
}

/**
 * Two index definitions are the same logical index when their key pattern and
 * uniqueness/sparsity options match. MongoDB treats their names as labels, so
 * `residentId_1` and `unique_residentId` describe the same constraint.
 */
function sameIndex(present: IndexSpec, expected: IndexSpec): boolean {
  return (
    keySignature(present.key) === keySignature(expected.key) &&
    Boolean(present.unique) === Boolean(expected.unique) &&
    Boolean(present.sparse) === Boolean(expected.sparse)
  );
}

async function verify(uri: string): Promise<void> {
  const conn = mongoose.createConnection(uri);
  await conn.asPromise();

  try {
    const db = conn.db;
    if (!db) {
      throw new Error('MongoDB connection has no bound database.');
    }

    // --- 1. Changelog vs migration files on disk ---------------------------
    const files = await listMigrationFiles();
    const appliedDocs = await db
      .collection(CHANGELOG)
      .find({}, { projection: { fileName: 1 } })
      .toArray();
    const applied = new Set(appliedDocs.map((doc) => String(doc.fileName)));

    console.log(`migration files on disk : ${files.length}`);
    console.log(`recorded in changelog    : ${applied.size}`);

    const pending = files.filter((file) => !applied.has(file));
    if (pending.length > 0) {
      failures.push(`pending migrations: ${pending.join(', ')}`);
    }

    const orphaned = [...applied].filter((file) => !files.includes(file));
    if (orphaned.length > 0) {
      notes.push(
        `changelog records files that no longer exist on disk: ${orphaned.join(', ')}`
      );
    }

    // --- 2. Collections, indexes, and a query round-trip -------------------
    console.log('\ncollection         documents   indexes');
    for (const [collection, expected] of Object.entries(SEEDED_INDEXES)) {
      const expectedSpecs = expected as unknown as IndexSpec[];

      let present: IndexSpec[];
      try {
        present = (await db
          .collection(collection)
          .listIndexes()
          .toArray()) as unknown as IndexSpec[];
      } catch (error) {
        if (isNamespaceMissing(error)) {
          notes.push(
            `${collection}: no documents, so the collection does not exist yet — ` +
              `${expectedSpecs.length} index(es) not verified`
          );
          console.log(`${collection.padEnd(18)} ${'-'.padStart(9)}   skipped`);
          continue;
        }
        failures.push(`${collection}: could not list indexes — ${describe(error)}`);
        continue;
      }

      const missing = expectedSpecs.filter((spec) => {
        const found = present.find((doc) => sameIndex(doc, spec));
        if (!found) return true;
        if (spec.name && found.name !== spec.name) {
          notes.push(
            `${collection}: "${spec.name}" exists as "${String(found.name)}" ` +
              '(same key and options — cosmetic name drift)'
          );
        }
        return false;
      });
      if (missing.length > 0) {
        failures.push(
          `${collection}: missing index(es) ${missing.map(describeSpec).join(', ')}`
        );
      }

      let count: number;
      try {
        count = await db.collection(collection).countDocuments({});
      } catch (error) {
        failures.push(`${collection}: query failed — ${describe(error)}`);
        continue;
      }

      console.log(
        `${collection.padEnd(18)} ${String(count).padStart(9)}   ` +
          `${present.length}/${expectedSpecs.length}`
      );
    }
  } finally {
    await conn.close();
  }
}

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      'MONGODB_URI is not set. Set it in the environment (CI) or in backend/.env (local).'
    );
  }

  await verify(uri);

  if (notes.length > 0) {
    console.log('\nNotes (not fatal):');
    for (const note of notes) console.log(`  - ${note}`);
  }

  if (failures.length > 0) {
    console.error('\n\u2716 Migration verification FAILED');
    for (const failure of failures) console.error(`  - ${failure}`);
    console.error(
      '\nThe deploy workflow reverts the migrations applied in this run when this ' +
        'exits non-zero. Investigate before re-running.\n'
    );
    process.exitCode = 1;
    return;
  }

  console.log('\n\u2714 Migration verification passed');
}

main().catch((error: unknown) => {
  console.error('\n\u2716 Migration verification could not run');
  console.error(`  - ${describe(error)}\n`);
  process.exitCode = 1;
});
