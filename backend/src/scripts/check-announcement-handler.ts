import 'dotenv/config';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { connectToDatabase, disconnectDatabase } from '../config/db';
import { Admin } from '../models';
import { createAnnouncement } from '../features/announcements/create/handler';

/**
 * Dev diagnostic: call the real POST /announcements handler with a fabricated
 * admin authorizer context to see whether the handler itself throws.
 */
async function main(): Promise<void> {
  await connectToDatabase();
  const admin = await Admin.findOne({});
  console.log('sample admin found:', Boolean(admin));
  if (!admin) {
    console.error('No Admin records in DB.');
    process.exit(1);
  }

  const event = {
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
    requestContext: {
      authorizer: { userId: String(admin._id), role: 'admin' },
    },
    headers: {},
  } as unknown as APIGatewayProxyEvent;

  try {
    const res = await createAnnouncement(event, {} as never);
    console.log('>>> HANDLER RESPONSE status:', res.statusCode);
    console.log('>>> HANDLER RESPONSE body  :', res.body);
  } catch (err) {
    const e = err as { name?: string; message?: string; stack?: string };
    console.log('>>> HANDLER THREW name    :', e?.name);
    console.log('>>> HANDLER THREW message :', e?.message);
    console.log('>>> STACK:', e?.stack);
  } finally {
    await disconnectDatabase();
  }
}

main();
