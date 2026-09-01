import mongoose, { Schema, type Document, type Model } from 'mongoose';

export interface IUser extends Document {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  middleName?: string;
  suffix?: string;
  contactNumber?: string;
  houseUnitNumber?: string;
  streetPurokName?: string;
  city?: string;
  province?: string;
  zipCode?: string;
  passwordHash: string;
  role: 'resident' | 'official' | 'admin';
  barangay: mongoose.Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  toPublicJSON(): Record<string, unknown>;
}

const userSchema = new Schema<IUser>(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    phone: { type: String, trim: true },
    middleName: { type: String, trim: true },
    suffix: { type: String, trim: true },
    contactNumber: { type: String, trim: true },
    houseUnitNumber: { type: String, trim: true },
    streetPurokName: { type: String, trim: true },
    city: { type: String, trim: true },
    province: { type: String, trim: true },
    zipCode: { type: String, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ['resident', 'official', 'admin'],
      default: 'resident',
    },
    barangay: {
      type: Schema.Types.ObjectId,
      ref: 'Barangay',
      required: true,
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

/**
 * Returns a plain object without sensitive fields.
 * Useful when returning the user to a client.
 */
userSchema.methods.toPublicJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  return obj;
};

export const User: Model<IUser> =
  (mongoose.models.User as Model<IUser>) || mongoose.model<IUser>('User', userSchema);
