import mongoose, { Schema, type Document, type Model } from 'mongoose';

export type AnnouncementPriorityLevel = 'high' | 'medium' | 'low';

export interface IAnnouncement extends Document {
  announcementId: string;
  titleText: string;
  descriptionContent: string;
  priorityLevel: AnnouncementPriorityLevel; // e.g., high, medium, low
  authorId: mongoose.Types.ObjectId; // ref -> Admin
  imageUrl?: string; // AWS S3 link for announcement banners/photos
  eventDate?: Date;
  isHidden: boolean; // Soft-hide toggles visibility
  createdAt: Date;
  updatedAt: Date;
}

const announcementSchema = new Schema<IAnnouncement>(
  {
    announcementId: { type: String, required: true, unique: true, trim: true },
    titleText: { type: String, required: true, trim: true },
    descriptionContent: { type: String, required: true },
    priorityLevel: {
      type: String,
      enum: ['high', 'medium', 'low'],
      default: 'low',
    },
    authorId: {
      type: Schema.Types.ObjectId,
      ref: 'Admin',
      required: true,
      index: true,
    },
    imageUrl: { type: String, trim: true },
    eventDate: { type: Date },
    isHidden: { type: Boolean, default: false },
  },
  { timestamps: true }
);

announcementSchema.index({ priorityLevel: 1, createdAt: -1 });

export const Announcement: Model<IAnnouncement> =
  (mongoose.models.Announcement as Model<IAnnouncement>) ||
  mongoose.model<IAnnouncement>('Announcement', announcementSchema);