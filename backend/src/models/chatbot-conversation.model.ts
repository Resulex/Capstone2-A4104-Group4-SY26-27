import mongoose, { Schema, type Document, type Model } from 'mongoose';

export type ChatbotMessageRole = 'user' | 'assistant';

/** A single turn in a resident's assistant conversation. */
export interface IChatbotMessage {
  role: ChatbotMessageRole;
  content: string;
  createdAt: Date;
}

export interface IChatbotConversation extends Document {
  /** The resident this conversation belongs to (JWT sub == Resident._id). */
  residentId: mongoose.Types.ObjectId;
  /** Ordered message log (oldest first). */
  messages: IChatbotMessage[];
  /** Set by the schema's `timestamps` option. */
  createdAt: Date;
  updatedAt: Date;
}

const chatbotMessageSchema = new Schema<IChatbotMessage>(
  {
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true, trim: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const chatbotConversationSchema = new Schema<IChatbotConversation>(
  {
    residentId: {
      type: Schema.Types.ObjectId,
      ref: 'Resident',
      required: true,
      unique: true,
      index: true,
    },
    messages: { type: [chatbotMessageSchema], default: [] },
  },
  { timestamps: true }
);

export const ChatbotConversation: Model<IChatbotConversation> =
  (mongoose.models.ChatbotConversation as Model<IChatbotConversation>) ||
  mongoose.model<IChatbotConversation>(
    'ChatbotConversation',
    chatbotConversationSchema
  );
