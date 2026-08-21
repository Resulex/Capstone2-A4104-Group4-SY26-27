import mongoose, { Schema, type Document, type Model } from 'mongoose';

export interface IMessage extends Document {
  messageId: string;
  sessionId: mongoose.Types.ObjectId; // ref -> ChatSession
  senderId: mongoose.Types.ObjectId; // ref -> Admin or Resident
  isUser: boolean; // true when sent by the resident
  messageText: string;
  formattedContent?: string;
  urgencyFlag: boolean; // System-detected urgency based on keyword rules
  sentTimestamp: Date;
}

const messageSchema = new Schema<IMessage>(
  {
    messageId: { type: String, required: true, unique: true, trim: true },
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: 'ChatSession',
      required: true,
      index: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    isUser: { type: Boolean, required: true },
    messageText: { type: String, required: true },
    formattedContent: { type: String, trim: true },
    urgencyFlag: { type: Boolean, default: false },
    sentTimestamp: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true }
);

messageSchema.index({ sessionId: 1, sentTimestamp: 1 });
messageSchema.index({ urgencyFlag: 1 });

export const Message: Model<IMessage> =
  (mongoose.models.Message as Model<IMessage>) ||
  mongoose.model<IMessage>('Message', messageSchema);