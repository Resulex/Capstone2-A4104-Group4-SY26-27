import mongoose, { Schema, type Document, type Model } from 'mongoose';

export interface IBarangay extends Document {
  name: string;
  city: string;
  province: string;
  region: string;
  zipCode?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const barangaySchema = new Schema<IBarangay>(
  {
    name: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    province: { type: String, required: true, trim: true },
    region: { type: String, required: true, trim: true },
    zipCode: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

barangaySchema.index({ name: 1, city: 1, province: 1 }, { unique: true });

export const Barangay: Model<IBarangay> =
  (mongoose.models.Barangay as Model<IBarangay>) ||
  mongoose.model<IBarangay>('Barangay', barangaySchema);