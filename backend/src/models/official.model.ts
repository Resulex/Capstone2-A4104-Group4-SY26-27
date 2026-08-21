import mongoose, { Schema, type Document, type Model } from 'mongoose';

export interface IOfficial extends Document {
  officialId: string;
  fullName: string;
  designatedPosition: string;
  contactNumber: string;
  emailAddress: string;
  officeLocation: string;
  coreResponsibilities: string[];
  profileImageUrl?: string;
  isDeleted: boolean; // Soft-delete flag for historical archiving
  updatedAt: Date;
}

const officialSchema = new Schema<IOfficial>(
  {
    officialId: { type: String, required: true, unique: true, trim: true },
    fullName: { type: String, required: true, trim: true },
    designatedPosition: { type: String, required: true, trim: true },
    contactNumber: { type: String, required: true, trim: true },
    emailAddress: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    officeLocation: { type: String, required: true, trim: true },
    coreResponsibilities: { type: [String], default: [] },
    profileImageUrl: { type: String, trim: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

officialSchema.index({ designatedPosition: 1 });
officialSchema.index({ isDeleted: 1 });

export const Official: Model<IOfficial> =
  (mongoose.models.Official as Model<IOfficial>) ||
  mongoose.model<IOfficial>('Official', officialSchema);