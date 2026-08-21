import mongoose, { Schema, type Document, type Model } from 'mongoose';

export interface IDeviceInfo {
  os: string;
  browser: string;
  model?: string;
}

export interface IChatSession extends Document {
  sessionId: string;
  incidentId: mongoose.Types.ObjectId; // ref -> IncidentReport
  residentId: mongoose.Types.ObjectId; // ref -> Resident
  adminId: mongoose.Types.ObjectId; // Responder ref -> Admin
  isActive: boolean;
  deviceInfo: IDeviceInfo;
  ipAddress: string;
  messageCount: number;
  startedAt: Date;
  lastActivity: Date;
}

const deviceInfoSchema = new Schema<IDeviceInfo>(
  {
    os: { type: String, trim: true },
    browser: { type: String, trim: true },
    model: { type: String, trim: true },
  },
  { _id: false }
);

const chatSessionSchema = new Schema<IChatSession>(
  {
    sessionId: { type: String, required: true, unique: true, trim: true },
    incidentId: {
      type: Schema.Types.ObjectId,
      ref: 'IncidentReport',
      required: true,
      index: true,
    },
    residentId: {
      type: Schema.Types.ObjectId,
      ref: 'Resident',
      required: true,
      index: true,
    },
    adminId: {
      type: Schema.Types.ObjectId,
      ref: 'Admin',
      required: true,
      index: true,
    },
    isActive: { type: Boolean, default: true },
    deviceInfo: { type: deviceInfoSchema, required: true },
    ipAddress: { type: String, required: true, trim: true },
    messageCount: { type: Number, default: 0, min: 0 },
    startedAt: { type: Date, required: true, default: Date.now },
    lastActivity: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true }
);

chatSessionSchema.index({ incidentId: 1, isActive: 1 });
chatSessionSchema.index({ lastActivity: -1 });

export const ChatSession: Model<IChatSession> =
  (mongoose.models.ChatSession as Model<IChatSession>) ||
  mongoose.model<IChatSession>('ChatSession', chatSessionSchema);