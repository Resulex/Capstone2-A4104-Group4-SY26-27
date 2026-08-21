import 'dotenv/config';
import mongoose from 'mongoose';
import { hashPassword } from '../shared/password';
import {
  Barangay,
  Official,
  Admin,
  Resident,
  Announcement,
  DocumentRequest,
  IncidentReport,
  ChatSession,
  Message,
  Notification,
} from '../models';
import {
  BARANGAY,
  ADMINS,
  OFFICIALS,
  RESIDENTS,
  ANNOUNCEMENTS,
  DOCUMENT_REQUESTS,
  INCIDENTS,
  CHAT_SESSIONS,
  MESSAGES,
  NOTIFICATIONS,
} from './seed-data';

const S3_BUCKET = process.env.S3_BUCKET_NAME || 'kabarangayconnect-media';
const S3_REGION = process.env.S3_BUCKET_REGION || 'ap-southeast-1';

function s3Url(key: string): string {
  return `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`;
}

/** Return true if a model already has documents (skip seeding). */
async function isSeeded(model: mongoose.Model<any>): Promise<boolean> {
  const count = await model.estimatedDocumentCount();
  return count > 0;
}

async function connect(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      'MONGODB_URI is not set. Add it to your .env file, then re-run the command.'
    );
  }
  // Use the default connection so the imported global models bind to it.
  await mongoose.connect(uri, { autoCreate: true });
}

async function seedBarangay(): Promise<mongoose.Types.ObjectId> {
  if (await isSeeded(Barangay)) {
    console.log('Barangay: already seeded, skipping.');
    const existing = await Barangay.findOne({}).sort({ createdAt: 1 });
    return existing!._id;
  }
  const doc = await Barangay.create(BARANGAY);
  console.log(`Barangay: seeded 1 record (${doc.name}).`);
  return doc._id;
}

async function seedOfficials(): Promise<void> {
  if (await isSeeded(Official)) {
    console.log('Officials: already seeded, skipping.');
    return;
  }
  const docs = OFFICIALS.map((o) => ({
    officialId: o.officialId,
    fullName: o.fullName,
    designatedPosition: o.designatedPosition,
    contactNumber: o.contactNumber,
    emailAddress: o.emailAddress,
    officeLocation: o.officeLocation,
    coreResponsibilities: o.coreResponsibilities,
    profileImageUrl: o.profileImageUrl || undefined,
    isDeleted: o.isDeleted,
  }));
  await Official.insertMany(docs);
  console.log(`Officials: seeded ${docs.length} records.`);
}

async function seedAdmins(): Promise<Map<string, mongoose.Types.ObjectId>> {
  const idMap = new Map<string, mongoose.Types.ObjectId>();
  if (await isSeeded(Admin)) {
    console.log('Admins: already seeded, skipping.');
    const admins = await Admin.find({});
    for (const a of admins) idMap.set(a.adminId, a._id);
    return idMap;
  }
  const created: Array<{ adminId: string; _id: mongoose.Types.ObjectId }> = [];
  for (const a of ADMINS) {
    const passwordHash = await hashPassword(a.password);
    const doc = await Admin.create({
      adminId: a.adminId,
      firstName: a.firstName,
      lastName: a.lastName,
      middleName: a.middleName || undefined,
      userName: a.userName,
      emailAddress: a.emailAddress,
      passwordHash,
      assignedRole: a.assignedRole,
      accountStatus: a.accountStatus,
      lastLogin: a.lastLogin ? new Date(a.lastLogin) : undefined,
    });
    created.push({ adminId: a.adminId, _id: doc._id });
  }
  for (const c of created) idMap.set(c.adminId, c._id);
  console.log(`Admins: seeded ${created.length} records.`);
  return idMap;
}

async function seedResidents(
  barangayId: mongoose.Types.ObjectId
): Promise<Map<string, mongoose.Types.ObjectId>> {
  const idMap = new Map<string, mongoose.Types.ObjectId>();
  if (await isSeeded(Resident)) {
    console.log('Residents: already seeded, skipping.');
    const residents = await Resident.find({});
    for (const r of residents) idMap.set(r.residentId, r._id);
    return idMap;
  }
  const created: Array<{ residentId: string; _id: mongoose.Types.ObjectId }> = [];
  for (const r of RESIDENTS) {
    const passwordHash = await hashPassword(r.password);
    const doc = await Resident.create({
      residentId: r.residentId,
      firstName: r.firstName,
      lastName: r.lastName,
      middleName: r.middleName || undefined,
      suffix: r.suffix || undefined,
      emailAddress: r.emailAddress,
      contactNumber: r.contactNumber,
      houseUnitNumber: r.houseUnitNumber,
      streetPurokName: r.streetPurokName,
      barangay: barangayId,
      city: BARANGAY.city,
      province: BARANGAY.province,
      zipCode: BARANGAY.zipCode,
      passwordHash,
      profileImageUrl: r.profileImageUrl || undefined,
      accountStatus: r.accountStatus,
    });
    created.push({ residentId: r.residentId, _id: doc._id });
  }
  for (const c of created) idMap.set(c.residentId, c._id);
  console.log(`Residents: seeded ${created.length} records.`);
  return idMap;
}

async function seedAnnouncements(adminMap: Map<string, mongoose.Types.ObjectId>): Promise<void> {
  if (await isSeeded(Announcement)) {
    console.log('Announcements: already seeded, skipping.');
    return;
  }
  const docs = ANNOUNCEMENTS.map((a) => ({
    announcementId: a.announcementId,
    titleText: a.titleText,
    descriptionContent: a.descriptionContent,
    priorityLevel: a.priorityLevel,
    authorId: adminMap.get(a.authorKey)!,
    imageUrl: a.imageUrl ? s3Url(`announcements/${a.announcementId}.jpg`) : undefined,
    eventDate: a.eventDate ? new Date(a.eventDate) : undefined,
    isHidden: a.isHidden,
  }));
  await Announcement.insertMany(docs);
  console.log(`Announcements: seeded ${docs.length} records.`);
}

async function seedIncidents(residentMap: Map<string, mongoose.Types.ObjectId>): Promise<void> {
  if (await isSeeded(IncidentReport)) {
    console.log('Incident Reports: already seeded, skipping.');
    return;
  }
  const docs = INCIDENTS.map((i) => ({
    incidentId: i.incidentId,
    residentId: residentMap.get(i.residentKey)!,
    incidentCategory: i.incidentCategory,
    descriptionText: i.descriptionText,
    locationDetails: i.locationDetails,
    triagePriority: i.triagePriority,
    evidenceMediaUrls: i.evidenceMediaUrls.map((url) => url),
    incidentStatus: i.incidentStatus,
    reportedAt: new Date(i.reportedAt),
  }));
  await IncidentReport.insertMany(docs);
  console.log(`Incident Reports: seeded ${docs.length} records.`);
}

async function seedDocumentRequests(
  residentMap: Map<string, mongoose.Types.ObjectId>,
  adminMap: Map<string, mongoose.Types.ObjectId>
): Promise<void> {
  if (await isSeeded(DocumentRequest)) {
    console.log('Document Requests: already seeded, skipping.');
    return;
  }
  const docs = DOCUMENT_REQUESTS.map((d) => {
    const residentId = residentMap.get(d.residentKey)!;
    const applicant = RESIDENTS.find((r) => r.residentId === d.residentKey)!;
    return {
      requestId: d.requestId,
      residentId,
      applicantDetails: {
        fullName: `${applicant.firstName} ${applicant.middleName ? applicant.middleName + ' ' : ''}${applicant.lastName}${applicant.suffix ? ' ' + applicant.suffix : ''}`,
        contactNumber: applicant.contactNumber,
        emailAddress: applicant.emailAddress,
      },
      documentType: d.documentType,
      purpose: d.purpose,
      verificationIdUrl: d.verificationIdUrl
        ? s3Url(`verification/${d.requestId}-id.jpg`)
        : undefined,
      currentStatus: d.currentStatus,
      expectedCompletionDate: new Date(d.expectedCompletionDate),
      timeline: d.timeline.map((t) => ({ step: t.step, date: new Date(t.date), status: t.status })),
      paymentStatus: d.paymentStatus,
      verifiedBy: d.verifiedByKey ? adminMap.get(d.verifiedByKey) : undefined,
      verifiedAt: d.verifiedAt ? new Date(d.verifiedAt) : undefined,
      officialReceiptNumber: d.officialReceiptNumber || undefined,
      dateRequested: new Date(d.dateRequested),
    };
  });
  await DocumentRequest.insertMany(docs);
  console.log(`Document Requests: seeded ${docs.length} records.`);
}

async function seedChatSessions(
  incidentMap: Map<string, mongoose.Types.ObjectId>,
  residentMap: Map<string, mongoose.Types.ObjectId>,
  adminMap: Map<string, mongoose.Types.ObjectId>
): Promise<Map<string, mongoose.Types.ObjectId>> {
  const idMap = new Map<string, mongoose.Types.ObjectId>();
  if (await isSeeded(ChatSession)) {
    console.log('Chat Sessions: already seeded, skipping.');
    const sessions = await ChatSession.find({});
    for (const s of sessions) idMap.set(s.sessionId, s._id);
    return idMap;
  }
  const docs = CHAT_SESSIONS.map((c) => {
    const incident = INCIDENTS.find((i) => i.incidentId === c.incidentKey)!;
    const sessionId = c.sessionId;
    const incidentId = incidentMap.get(incident.incidentId)!;
    const residentId = residentMap.get(c.residentKey)!;
    const adminId = adminMap.get(c.adminKey)!;
    idMap.set(sessionId, new mongoose.Types.ObjectId());
    return {
      sessionId,
      incidentId,
      residentId,
      adminId,
      isActive: c.isActive,
      deviceInfo: { ...c.deviceInfo },
      ipAddress: c.ipAddress,
      messageCount: c.messageCount,
      startedAt: new Date(c.startedAt),
      lastActivity: new Date(c.lastActivity),
    };
  });
  // Insert with explicit _id mapping so messages can reference session _ids.
  const created = await ChatSession.insertMany(docs.map((d) => ({ ...d, _id: idMap.get(d.sessionId) })));
  console.log(`Chat Sessions: seeded ${created.length} records.`);
  return idMap;
}

async function seedMessages(
  sessionMap: Map<string, mongoose.Types.ObjectId>,
  residentMap: Map<string, mongoose.Types.ObjectId>,
  adminMap: Map<string, mongoose.Types.ObjectId>
): Promise<void> {
  if (await isSeeded(Message)) {
    console.log('Messages: already seeded, skipping.');
    return;
  }
  const sessionByKey = new Map(CHAT_SESSIONS.map((c) => [c.sessionId, c]));
  const docs = MESSAGES.map((m) => {
    const session = sessionByKey.get(m.sessionKey)!;
    // senderId resolves to the resident (isUser) or the admin responder.
    const senderId = m.isUser
      ? residentMap.get(session.residentKey)!
      : adminMap.get(session.adminKey)!;
    return {
      messageId: m.messageId,
      sessionId: sessionMap.get(m.sessionKey)!,
      senderId,
      isUser: m.isUser,
      messageText: m.messageText,
      formattedContent: m.formattedContent,
      urgencyFlag: m.urgencyFlag,
      sentTimestamp: new Date(m.sentTimestamp),
    };
  });
  await Message.insertMany(docs);
  console.log(`Messages: seeded ${docs.length} records.`);
}

async function seedNotifications(
  residentMap: Map<string, mongoose.Types.ObjectId>,
  adminMap: Map<string, mongoose.Types.ObjectId>
): Promise<void> {
  if (await isSeeded(Notification)) {
    console.log('Notifications: already seeded, skipping.');
    return;
  }
  const docs = NOTIFICATIONS.map((n) => {
    let recipientId = adminMap.get(n.recipientKey);
    if (!recipientId) recipientId = residentMap.get(n.recipientKey);
    return {
      notificationId: n.notificationId,
      recipientId,
      notificationCategory: n.notificationCategory,
      titleText: n.titleText,
      messageBody: n.messageBody,
      referenceUrlId: n.referenceUrlId || undefined,
      isRead: n.isRead,
      createdAt: new Date(n.createdAt),
    };
  });
  await Notification.insertMany(docs);
  console.log(`Notifications: seeded ${docs.length} records.`);
}

export async function seedInto(): Promise<void> {
  await connect();
  try {
    console.log('Seeding database...\n');

    const barangayId = await seedBarangay();
    await seedOfficials();
    const adminMap = await seedAdmins();
    const residentMap = await seedResidents(barangayId);
    await seedAnnouncements(adminMap);
    await seedIncidents(residentMap);
    await seedDocumentRequests(residentMap, adminMap);

    // Resolve incident _ids for chat sessions.
    const incidentMap = new Map<string, mongoose.Types.ObjectId>();
    const incidents = await IncidentReport.find({});
    for (const i of incidents) incidentMap.set(i.incidentId, i._id);

    const sessionMap = await seedChatSessions(incidentMap, residentMap, adminMap);
    await seedMessages(sessionMap, residentMap, adminMap);
    await seedNotifications(residentMap, adminMap);

    console.log('\nSeeding complete.');
  } finally {
    await mongoose.disconnect();
  }
}

// CLI entry.
// eslint-disable-next-line @typescript-eslint/no-var-requires
if (require.main === module) {
  seedInto().catch((err) => {
    console.error('[Seed Error]', err);
    process.exitCode = 1;
  });
}