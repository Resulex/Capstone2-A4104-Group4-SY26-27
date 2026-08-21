import mongoose, { Schema, type Document, type Model } from 'mongoose';

export type ResidentAccountStatus = 'active' | 'suspended';

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
  // Google SSO identity (used for resident login via Google)
  googleSub?: string; // Google account unique identifier
  googleEmail?: string; // verified Google email
  isProvisioned: boolean; // true once the resident completes first-time onboarding
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
      enum: ['active', 'suspended'],
      default: 'active',
    },
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
  },
  { timestamps: true }
);

residentSchema.index({ lastName: 1, firstName: 1 });
residentSchema.index({ streetPurokName: 1 });

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