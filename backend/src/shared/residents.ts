import { User, Resident } from '../models';

/**
 * Ensures a Resident record exists for a resident-role User (the JWT `sub`).
 *
 * Resident-owned collections reference the Resident by `_id`, and for
 * self-registered residents the Resident shares the User's `_id`. Accounts
 * created via the admin `POST /users` endpoint get a User but no linked
 * Resident, which made self-service creates (incident reports, document
 * requests) fail with `Invalid residentId`. This provisions a minimal
 * Resident (linked by `_id`) on demand so resident users can always file
 * records; it is a no-op when a Resident already exists.
 *
 * Returns the Resident document, or null when the user is not a resident or
 * cannot be found.
 */
export async function ensureResidentForUser(
  userId: string
): Promise<InstanceType<typeof Resident> | null> {
  const user = await User.findById(userId);
  if (!user || user.role !== 'resident') return null;

  const existing = await Resident.findOne({
    $or: [{ _id: userId }, { residentId: userId }],
  });
  if (existing) return existing;

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
