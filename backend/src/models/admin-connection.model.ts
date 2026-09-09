import mongoose, { Schema, type Document, type Model } from 'mongoose';

/**
 * Tracks a live API Gateway WebSocket connection for an admin, so the backend
 * can push real-time notifications to the right admin's socket(s).
 */
export interface IAdminConnection extends Document {
  connectionId: string;
  adminId: mongoose.Types.ObjectId; // ref -> Admin
  connectedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const adminConnectionSchema = new Schema<IAdminConnection>(
  {
    connectionId: { type: String, required: true, unique: true, trim: true },
    adminId: {
      type: Schema.Types.ObjectId,
      ref: 'Admin',
      required: true,
      index: true,
    },
    connectedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

adminConnectionSchema.index({ adminId: 1 });

export const AdminConnection: Model<IAdminConnection> =
  (mongoose.models.AdminConnection as Model<IAdminConnection>) ||
  mongoose.model<IAdminConnection>('AdminConnection', adminConnectionSchema);
