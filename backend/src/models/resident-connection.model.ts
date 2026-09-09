import mongoose, { Schema, type Document, type Model } from 'mongoose';

export interface IResidentConnection extends Document {
  connectionId: string;
  residentId: mongoose.Types.ObjectId; // ref -> Resident
  connectedAt: Date;
}

const residentConnectionSchema = new Schema<IResidentConnection>(
  {
    connectionId: { type: String, required: true, unique: true, trim: true },
    residentId: {
      type: Schema.Types.ObjectId,
      ref: 'Resident',
      required: true,
      index: true,
    },
    connectedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

residentConnectionSchema.index({ residentId: 1 });

export const ResidentConnection: Model<IResidentConnection> =
  (mongoose.models.ResidentConnection as Model<IResidentConnection>) ||
  mongoose.model<IResidentConnection>('ResidentConnection', residentConnectionSchema);
