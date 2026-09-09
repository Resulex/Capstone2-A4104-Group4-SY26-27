import { User, Resident } from '../models';

/**
 * Resolves the Resident that owns a self-service record for the JWT `sub`,
 * provisioning one on demand when only a User exists.
 *
 * Resident-owned collections reference the Resident by `_id`. Google-SSO and
 * self-registered residents already have a Resident whose `_id`/`residentId`
 * is the JWT `sub`, so they are returned as-is. Accounts created via the
 * admin `POST /users` endpoint get a User but no linked Resident, which made
 * self-service creates (incident reports, document requests) fail with
 * `Invalid residentId`; those get a minimal Resident (linked by `_id`)
 * provisioned on demand.
 *
 * Returns the Resident document, or null when no Resident exists and the user
 * is not a resident/official (or cannot be found).
 */
export async function ensureResidentForUser(
  userId: string
): Promise<InstanceType<typeof Resident> | null> {
  // Google-SSO and self-registered residents already have a Resident whose
  // `_id`/`residentId` is the JWT `sub` (they may have no User record), so
  // return it as-is before falling back to User-based provisioning.
  const existing = await Resident.findOne({
    $or: [{ _id: userId }, { residentId: userId }],
  });
  if (existing) return existing;

  // Admin-created user accounts have a User but no linked Resident. Provision
  // a minimal Resident (linked by `_id`) so resident/official users can file
  // self-service records.
  const user = await User.findById(userId);
  if (!user || (user.role !== 'resident' && user.role !== 'official')) return null;

  // Idempotent upsert so concurrent creates cannot throw a duplicate-key error.
  return Resident.findOneAndUpdate(
    { _id: user._id },
    {
      $setOnInsert: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        middleName: user.middleName || undefined,
        suffix: user.suffix || undefined,
        emailAddress: user.email.toLowerCase(),
        contactNumber: user.contactNumber || user.phone || undefined,
        houseUnitNumber: user.houseUnitNumber || undefined,
        streetPurokName: user.streetPurokName || undefined,
        barangay: user.barangay,
        city: user.city,
        province: user.province,
        zipCode: user.zipCode,
        accountStatus: 'active',
        isProvisioned: true,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}
