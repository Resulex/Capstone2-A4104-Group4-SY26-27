import 'dotenv/config';
import jwt from 'jsonwebtoken';
import { connectToDatabase, disconnectDatabase } from '../config/db';
import { Admin } from '../models';

/**
 * Dev diagnostic: mint a valid admin JWT (same as the app issues) and POST an
 * announcement through the REAL running backend (serverless-offline) to see
 * the actual HTTP result end-to-end.
 */
async function main(): Promise<void> {
  await connectToDatabase();
  const admin = await Admin.findOne({});
  console.log('sample admin found:', Boolean(admin));
  if (!admin) {
    console.error('No Admin records in DB.');
    process.exit(1);
  }

  const secret = process.env.JWT_SECRET || 'dev-secret-do-not-use-in-prod';
  const token = jwt.sign({ sub: String(admin._id), role: 'admin' }, secret, {
    expiresIn: '1h',
  });

  const url = process.env.BACKEND_TEST_URL || 'http://localhost:3000/dev/announcements';
  console.log('POST', url);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        announcementId: `ann-diag-${Date.now()}`,
        titleText: 'test',
        descriptionContent: 'test',
        priorityLevel: 'low',
        imageUrl:
          'https://s3mediabucket-kabarangayconnect.s3.ap-southeast-1.amazonaws.com/announcements/activities-2.webp-986bab15-bfde-4841-9a8a-c1787adb7071.webp',
        eventDate: '2026-09-16',
        isHidden: false,
      }),
    });
    const text = await res.text();
    console.log('>>> HTTP status:', res.status);
    console.log('>>> HTTP body  :', text);
  } catch (err) {
    const e = err as { message?: string };
    console.log('>>> FETCH ERROR:', e?.message);
  } finally {
    await disconnectDatabase();
  }
}

main();
