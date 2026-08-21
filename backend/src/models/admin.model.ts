import mongoose, { Schema, type Document, type Model } from 'mongoose';

export type AdminRole = 'Admin' | 'Moderator' | 'Content Admin';
export type AdminAccountStatus = 'active' | 'suspended' | 'deactivated';

export interface IAdmin extends Document {
  adminId: string;
  firstName: string;
  lastName: string;
  middleName?: string; // Optional
  userName: string;
  emailAddress: string;
  passwordHash: string;
  assignedRole: AdminRole;
  accountStatus: AdminAccountStatus;
  // TOTP (Google Authenticator) MFA
  totpSecret?: string; // AES-256-GCM encrypted at rest, select: false
  totpVerified: boolean;
  backupCodes?: string[]; // bcrypt-hashed recovery codes, select: false
  createdAt: Date;
  lastLogin?: Date;
  toPublicJSON(): Record<string, unknown>;
}

const adminSchema = new Schema<IAdmin>(
  {
    adminId: { type: String, required: true, unique: true, trim: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    middleName: { type: String, trim: true },
    userName: { type: String, required: true, unique: true, trim: true },
    emailAddress: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true, select: false },
    assignedRole: {
      type: String,
      enum: ['Admin', 'Moderator', 'Content Admin'],
      default: 'Moderator',
    },
    accountStatus: {
      type: String,
      enum: ['active', 'suspended', 'deactivated'],
      default: 'active',
    },
    // TOTP MFA secret, encrypted at rest. Never selected by default.
    totpSecret: { type: String, select: false },
    totpVerified: { type: Boolean, default: false },
    // Recovery codes hashed with bcrypt; never selected by default.
    backupCodes: { type: [String], select: false },
    lastLogin: { type: Date },
  },
  { timestamps: true }
);

/** Returns a plain object without sensitive fields. */
adminSchema.methods.toPublicJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.totpSecret;
  delete obj.backupCodes;
  return obj;
};

export const Admin: Model<IAdmin> =
  (mongoose.models.Admin as Model<IAdmin>) ||
  mongoose.model<IAdmin>('Admin', adminSchema);