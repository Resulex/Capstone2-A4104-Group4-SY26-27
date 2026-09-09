import 'dotenv/config';
import { connectToDatabase, disconnectDatabase } from '../config/db';
import { Announcement, Admin } from '../models';

/**
 * Dev diagnostic: replicate the POST /announcements create path (minus auth)
 * against the configured Mongo DB to surface the real error behind the 500.
 */
async function main(): Promise<void> {
  const annId = `ann-diag-${Date.now()}`;
  await connectToDatabase();

  const admin = await Admin.findOne({});
  console.log('sample admin found:', Boolean(admin), admin?._id?.toString());
  if (!admin) {
    console.error('No Admin records in DB.');
    process.exit(1);
  }

  try {
    const doc = await Announcement.create({
      announcementId: annId,
      titleText: 'test',
      descriptionContent: 'test',
      priorityLevel: 'low',
      authorId: admin._id,
      imageUrl:
        'https://s3mediabucket-kabarangayconnect.s3.ap-southeast-1.amazonaws.com/announcements/activities-2.webp-986bab15-bfde-4841-9a8a-c1787adb7071.webp',
      eventDate: new Date('2026-09-16'),
      isHidden: false,
    });
    console.log('>>> CREATED ok:', doc._id.toString());
    await Announcement.deleteOne({ announcementId: annId });
    console.log('>>> cleaned up test record');
  } catch (err) {
    const e = err as { name?: string; message?: string; stack?: string };
    console.log('>>> ERROR name   :', e?.name);
    console.log('>>> ERROR message:', e?.message);
    console.log('>>> STACK:', e?.stack);
  } finally {
    await disconnectDatabase();
  }
}

main();
