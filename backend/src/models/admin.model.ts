import mongoose, { Schema, type Document, type Model } from 'mongoose';

export type AdminRole = 'SUPER_ADMIN' | 'OPERATIONS_CLERK' | 'INFO_OFFICER';
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
  // AWS Cognito link (hybrid auth: pool owns password + software-token TOTP
  // MFA). phoneNumber is an optional contact field — NOT used by MFA.
  phoneNumber?: string;
  cognitoSub?: string; // Cognito User Pool sub — internal, never exposed
  /** True once the admin has enrolled a software-token TOTP device. */
  mfaEnrolled?: boolean;
  // Deprecated: legacy custom otplib TOTP. Kept for rollback only; admin MFA
  // is now handled by AWS Cognito software-token MFA.
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
      enum: ['SUPER_ADMIN', 'OPERATIONS_CLERK', 'INFO_OFFICER'],
      default: 'OPERATIONS_CLERK',
    },
    accountStatus: {
      type: String,
      enum: ['active', 'suspended', 'deactivated'],
      default: 'active',
    },
    // AWS Cognito link (hybrid auth: pool owns password + software-token TOTP
    // MFA). phoneNumber is an optional contact field — NOT used by MFA.
    phoneNumber: { type: String, trim: true },
    cognitoSub: { type: String, index: true, sparse: true },
    // True once the admin has enrolled software-token MFA (Cognito or offline).
    mfaEnrolled: { type: Boolean, default: false },
    // Deprecated: legacy custom otplib TOTP (rollback only).
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
  delete obj.cognitoSub; // internal AWS link — never expose to clients
  delete obj.mfaEnrolled; // internal MFA state — never expose to clients
  delete obj.totpSecret;
  delete obj.backupCodes;
  return obj;
};

export const Admin: Model<IAdmin> =
  (mongoose.models.Admin as Model<IAdmin>) ||
  mongoose.model<IAdmin>('Admin', adminSchema);