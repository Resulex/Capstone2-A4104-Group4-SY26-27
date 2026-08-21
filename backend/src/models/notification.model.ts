import mongoose, { Schema, type Document, type Model } from 'mongoose';

export type NotificationCategory =
  | 'incidentAlert'
  | 'documentUpdate'
  | 'systemMessage';

export interface INotification extends Document {
  notificationId: string;
  recipientId: mongoose.Types.ObjectId; // ref -> Admin or Resident
  notificationCategory: NotificationCategory;
  titleText: string;
  messageBody: string;
  referenceUrlId?: string; // Specific incidentId or requestId for deep-linking
  isRead: boolean;
  createdAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    notificationId: { type: String, required: true, unique: true, trim: true },
    recipientId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    notificationCategory: {
      type: String,
      enum: ['incidentAlert', 'documentUpdate', 'systemMessage'],
      required: true,
    },
    titleText: { type: String, required: true, trim: true },
    messageBody: { type: String, required: true },
    referenceUrlId: { type: String, trim: true },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.index({ recipientId: 1, isRead: 1 });
notificationSchema.index({ createdAt: -1 });

export const Notification: Model<INotification> =
  (mongoose.models.Notification as Model<INotification>) ||
  mongoose.model<INotification>('Notification', notificationSchema);