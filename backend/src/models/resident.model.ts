import mongoose, { Schema, type Document, type Model } from 'mongoose';

export type ResidentAccountStatus = 'active' | 'suspended' | 'deactivated';

/**
 * Days a resident-initiated account deletion stays recoverable. During the
 * window the resident keeps their sign-in but their pre-existing records are
 * hidden and locked; afterwards the deletion is permanent.
 */
export const RESIDENT_DELETION_GRACE_DAYS = 30;

export interface IResident extends Document {
  residentId: string;
  firstName: string;
  lastName: string;
  middleName?: string; // Optional
  suffix?: string; // e.g., Jr., Sr.
  emailAddress: string;
  contactNumber?: string;
  houseUnitNumber?: string;
  streetPurokName?: string;
  barangay?: mongoose.Types.ObjectId; // ref -> Barangay
  city?: string; // Read-only / Default (denormalized from Barangay)
  province?: string; // Read-only / Default
  zipCode?: string; // Read-only / Default (denormalized from Barangay)
  passwordHash?: string; // optional for Google SSO residents
  profileImageUrl?: string;
  accountStatus: ResidentAccountStatus;
  /**
   * Reason an admin supplied for the latest account action (suspend,
   * deactivate, reactivate, delete). Scalar mirror of the latest action, like
   * the `remarks` field records keep alongside their timeline.
   */
  statusReason?: string;
  // Google SSO identity (used for resident login via Google)
  googleSub?: string; // Google account unique identifier
  googleEmail?: string; // verified Google email
  isProvisioned: boolean; // true once the resident completes first-time onboarding
  /** Soft-delete flag: hidden from the Residents list, kept for history. */
  isDeleted: boolean;
  deletedAt?: Date; // set when the account is soft-deleted
  /** Admin `_id` of the super admin who archived the account (audit only). */
  archivedBy?: string;
  /** Optional note recorded when the account was archived. */
  archivedReason?: string;
  /**
   * Resident-INITIATED deletion request. Deliberately separate from
   * `isDeleted` (which is the admin soft-delete and blocks sign-in): this one
   * keeps the resident signed in, keeps the row visible to admins, and only
   * hides the resident's PRE-EXISTING records from their own portal.
   *
   * A record counts as "frozen" for the resident while
   * `record.createdAt <= deletionRequestedAt` — see
   * `assertResidentRecordWritable` in `shared/authorization.ts`.
   */
  deletionRequestedAt?: Date; // when the resident asked for deletion
  deletionScheduledFor?: Date; // when the grace window closes (requestedAt + 30d)
  deletionFinalizedAt?: Date; // set once the deletion became permanent
  deletionReason?: string; // optional free-text reason the resident gave
  termsAcceptedAt?: Date; // set when the resident agrees to Terms + Data Privacy
  termsVersion?: string; // version of the terms/privacy policy the resident accepted
  createdAt: Date;
  updatedAt: Date;
  toPublicJSON(): Record<string, unknown>;
}

const residentSchema = new Schema<IResident>(
  {
    residentId: { type: String, unique: true, sparse: true, trim: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    middleName: { type: String, trim: true },
    suffix: { type: String, trim: true },
    emailAddress: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    contactNumber: { type: String, trim: true },
    houseUnitNumber: { type: String, trim: true },
    streetPurokName: { type: String, trim: true },
    barangay: {
      type: Schema.Types.ObjectId,
      ref: 'Barangay',
      index: true,
    },
    city: { type: String, trim: true },
    province: { type: String, trim: true },
    zipCode: { type: String, trim: true },
    passwordHash: { type: String, select: false },
    profileImageUrl: { type: String, trim: true },
    accountStatus: {
      type: String,
      enum: ['active', 'suspended', 'deactivated'],
      default: 'active',
    },
    statusReason: { type: String, trim: true },
    // Google SSO identity — unique but sparse so manually-created residents
    // without a Google account are unaffected.
    googleSub: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      index: true,
    },
    googleEmail: { type: String, lowercase: true, trim: true },
    isProvisioned: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    archivedBy: { type: String, trim: true },
    archivedReason: { type: String, trim: true },
    // Resident-initiated deletion. All optional, so existing records read as
    // "not deleted" without a backfill migration.
    deletionRequestedAt: { type: Date },
    deletionScheduledFor: { type: Date },
    deletionFinalizedAt: { type: Date },
    deletionReason: { type: String, trim: true },
    termsAcceptedAt: { type: Date },
    termsVersion: { type: String, trim: true },
  },
  { timestamps: true }
);

residentSchema.index({ lastName: 1, firstName: 1 });
residentSchema.index({ streetPurokName: 1 });
// Sparse so the (default-empty) majority of residents are not indexed; used by
// the daily finalization sweep.
residentSchema.index({ deletionScheduledFor: 1 }, { sparse: true });

/** Returns a plain object without sensitive fields. */
residentSchema.methods.toPublicJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.googleSub;
  return obj;
};

export const Resident: Model<IResident> =
  (mongoose.models.Resident as Model<IResident>) ||
  mongoose.model<IResident>('Resident', residentSchema);