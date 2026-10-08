import type { Db } from 'mongodb';

/**
 * Backfills the barangay contact details added for the resident chatbot.
 *
 * `seedBarangay()` skips a collection that is already seeded, so an existing
 * database never receives the new fields from the seed path. This migration
 * reaches those rows instead, and only fills fields that are absent so any
 * value an admin already curated is left untouched.
 */
const DEFAULTS = {
  contactNumber: '(049) 1234 567',
  emailAddress: 'barangayhall.labuin@kabarangayconnect.gov.ph',
  officeAddress: 'Barangay Hall, Purok 2, Labuin, Pila, Laguna',
  officeHours: [
    'Monday–Friday: 8:00 AM – 5:00 PM',
    'Saturday: 8:00 AM – 12:00 PM',
    'Sunday: Closed',
  ],
  emergencyHotline: '(049) 123-4567',
  emergencyMobile: '+63 912 123 4567',
} as const;

export async function up(db: Db): Promise<void> {
  const barangays = db.collection('barangays');

  for (const [field, value] of Object.entries(DEFAULTS)) {
    await barangays.updateMany(
      { $or: [{ [field]: { $exists: false } }, { [field]: null }] },
      { $set: { [field]: value } }
    );
  }
}

export async function down(db: Db): Promise<void> {
  const barangays = db.collection('barangays');
  const unset: Record<string, ''> = {};
  for (const field of Object.keys(DEFAULTS)) unset[field] = '';
  await barangays.updateMany({}, { $unset: unset });
}
