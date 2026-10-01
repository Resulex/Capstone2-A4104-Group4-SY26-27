import 'dotenv/config';
import jwt from 'jsonwebtoken';
import { connectToDatabase, disconnectDatabase } from '../config/db';
import { Admin, Announcement } from '../models';

/**
 * Dev diagnostic: exercise the SUPER_ADMIN-only archive / restore surface
 * through the REAL running backend (serverless-offline).
 *
 * What it proves, in order:
 *   1. a non-super admin is refused the archived scope AND every archive route;
 *   2. an unknown `scope` value is a 400, not a silent fallback to active;
 *   3. a Super Admin can archive a record, and it leaves the active list;
 *   4. the same record is retrievable from the archived list;
 *   5. restore puts it back exactly where it was, with history appended;
 *   6. the old hard-DELETE announcement route archives instead of destroying;
 *   7. the generic PATCH routes can no longer archive a record.
 *
 * Run:
 *   npm run offline            # in another terminal
 *   npx ts-node src/scripts/check-archive.ts
 *
 * NOTE: it temporarily changes `assignedRole` on two admin records so both roles
 * exist regardless of what the seed left behind, and always restores the
 * originals in `finally`.
 */

const BASE = process.env.BACKEND_TEST_URL || 'http://localhost:3000/dev';
const secret = process.env.JWT_SECRET || 'dev-secret-do-not-use-in-prod';

const failures: string[] = [];

function check(label: string, actual: unknown, expected: unknown): void {
  const pass = String(actual) === String(expected);
  console.log(
    `${pass ? 'PASS' : 'FAIL'}  ${label} (got ${String(actual)}, want ${String(expected)})`
  );
  if (!pass) failures.push(label);
}

function tokenFor(id: string): string {
  return jwt.sign({ sub: id, role: 'admin' }, secret, { expiresIn: '1h' });
}

interface Result {
  status: number;
  body: Record<string, any> | null;
}

async function call(
  token: string,
  method: string,
  path: string,
  body?: unknown
): Promise<Result> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let parsed: Record<string, any> | null = null;
  try {
    parsed = (await res.json()) as Record<string, any>;
  } catch {
    parsed = null;
  }
  return { status: res.status, body: parsed };
}

/** Collect one field from a list response (`data` is always an array). */
function ids(result: Result, field: string): string[] {
  const rows = Array.isArray(result.body?.data) ? result.body!.data : [];
  return rows.map((row: Record<string, unknown>) => String(row[field]));
}

async function main(): Promise<void> {
  await connectToDatabase();

  const admins = await Admin.find({}).lean();
  if (admins.length < 2) {
    console.error('Need at least two Admin records to test both roles.');
    process.exit(1);
  }
  const active = admins.filter((a) => a.accountStatus === 'active');
  const pool = active.length >= 2 ? active : admins;

  const superDoc = pool[0];
  const clerkDoc = pool.find((a) => String(a._id) !== String(superDoc._id))!;

  const originalRoles = [
    { id: superDoc._id, role: superDoc.assignedRole },
    { id: clerkDoc._id, role: clerkDoc.assignedRole },
  ];

  try {
    // Guarantee the two roles exist, whatever the seed left behind.
    await Admin.updateOne({ _id: superDoc._id }, { assignedRole: 'SUPER_ADMIN' });
    await Admin.updateOne({ _id: clerkDoc._id }, { assignedRole: 'OPERATIONS_CLERK' });

    const superToken = tokenFor(String(superDoc._id));
    const clerkToken = tokenFor(String(clerkDoc._id));
    console.log(
      `\nacting as SUPER_ADMIN=${String(superDoc._id)}  CLERK=${String(clerkDoc._id)}\n`
    );

    // --- 1. role gating -----------------------------------------------------
    const clerkArchived = await call(clerkToken, 'GET', '/incident-reports?scope=archived');
    check('clerk asking for the archived scope gets 403', clerkArchived.status, 403);

    const clerkActive = await call(clerkToken, 'GET', '/incident-reports?scope=active');
    check('clerk asking for the active scope gets 200', clerkActive.status, 200);

    // --- 2. strict scope parsing --------------------------------------------
    const badScope = await call(superToken, 'GET', '/incident-reports?scope=banana');
    check('unknown scope value is 400', badScope.status, 400);

    // --- 3. archiving -------------------------------------------------------
    const before = await call(superToken, 'GET', '/incident-reports?scope=active');
    const target = ids(before, 'incidentId')[0];
    if (!target) {
      console.error('No incident reports in the dev database to test with.');
      process.exit(1);
    }
    console.log(`\ntarget incident: ${target}\n`);

    const clerkArchive = await call(clerkToken, 'POST', `/incident-reports/${target}/archive`);
    check('clerk calling the archive route gets 403', clerkArchive.status, 403);

    const archived = await call(superToken, 'POST', `/incident-reports/${target}/archive`, {
      reason: 'smoke test',
    });
    check('super admin archive returns 200', archived.status, 200);
    check('archive stored the reason', archived.body?.data?.archivedReason, 'smoke test');
    check('archive set isArchived', archived.body?.data?.isArchived, true);
    check(
      'archive was attributed to an admin',
      Boolean(archived.body?.data?.archivedBy),
      true
    );

    const afterArchive = await call(superToken, 'GET', '/incident-reports?scope=active');
    check(
      'archived record left the active list',
      ids(afterArchive, 'incidentId').includes(target),
      false
    );

    const inArchive = await call(superToken, 'GET', '/incident-reports?scope=archived');
    check(
      'archived record is retrievable from the archived list',
      ids(inArchive, 'incidentId').includes(target),
      true
    );

    // --- 4. restoring -------------------------------------------------------
    const restored = await call(superToken, 'POST', `/incident-reports/${target}/restore`);
    check('super admin restore returns 200', restored.status, 200);
    check('restore cleared the flag', restored.body?.data?.isArchived, false);

    const afterRestore = await call(superToken, 'GET', '/incident-reports?scope=active');
    check(
      'restored record is back in the active list',
      ids(afterRestore, 'incidentId').includes(target),
      true
    );

    const timeline = Array.isArray(restored.body?.data?.timeline)
      ? restored.body!.data.timeline.map((t: Record<string, unknown>) => t.status)
      : [];
    check('archive appended a history entry', timeline.includes('Archived'), true);
    check('restore appended a history entry', timeline.includes('Restored'), true);

    // --- 5. announcements, including the legacy DELETE alias ----------------
    const annBefore = await call(superToken, 'GET', '/announcements?scope=active');
    const annId = ids(annBefore, 'announcementId')[0];
    if (!annId) {
      console.log('SKIP  no announcements in the dev database');
    } else {
      const annArchived = await call(superToken, 'POST', `/announcements/${annId}/archive`);
      check('announcement archive returns 200', annArchived.status, 200);

      const annList = await call(superToken, 'GET', '/announcements?scope=active');
      check(
        'archived announcement left the active feed',
        ids(annList, 'announcementId').includes(annId),
        false
      );

      // The old hard-delete route must now archive, never destroy.
      const viaDelete = await call(superToken, 'DELETE', `/announcements/${annId}`);
      check('legacy DELETE route still answers 200', viaDelete.status, 200);

      const stillThere = await Announcement.findOne({ announcementId: annId }).lean();
      check('legacy DELETE did NOT destroy the record', Boolean(stillThere), true);

      const annRestored = await call(superToken, 'POST', `/announcements/${annId}/restore`);
      check('announcement restore returns 200', annRestored.status, 200);
    }

    // --- 6. the generic PATCH write path is closed --------------------------
    const officials = await call(superToken, 'GET', '/officials');
    const officialId = ids(officials, 'officialId')[0];
    if (!officialId) {
      console.log('SKIP  no officials in the dev database');
    } else {
      const blocked = await call(superToken, 'PATCH', `/officials/${officialId}`, {
        isDeleted: true,
      });
      check('generic PATCH can no longer archive an official', blocked.status, 400);

      const untouched = await call(superToken, 'GET', '/officials');
      check(
        'the official is still listed after the rejected PATCH',
        ids(untouched, 'officialId').includes(officialId),
        true
      );
    }
  } finally {
    for (const original of originalRoles) {
      await Admin.updateOne({ _id: original.id }, { assignedRole: original.role });
    }
    await disconnectDatabase();
    console.log(
      failures.length === 0
        ? '\nAll archive checks passed.'
        : `\n${failures.length} FAILED: ${failures.join(', ')}`
    );
    process.exitCode = failures.length === 0 ? 0 : 1;
  }
}

main();
