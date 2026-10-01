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
  /**
   * Soft-archive flag (SUPER_ADMIN only). Deliberately separate from
   * `isHidden`: hidden = unpublished draft, archived = retired content. An
   * archived announcement leaves every public and admin list and is retrievable
   * only from the admin Archived view.
   */
  isArchived: boolean;
  archivedAt?: Date;
  /** Admin `_id` of the super admin who archived the announcement. */
  archivedBy?: string;
  /** Optional note recorded when the announcement was archived. */
  archivedReason?: string;
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
    // Soft-archive (SUPER_ADMIN only) — see the interface for why this is not
    // the same thing as `isHidden`.
    isArchived: { type: Boolean, default: false },
    archivedAt: { type: Date },
    archivedBy: { type: String, trim: true },
    archivedReason: { type: String, trim: true },
  },
  { timestamps: true }
);

announcementSchema.index({ priorityLevel: 1, createdAt: -1 });

export const Announcement: Model<IAnnouncement> =
  (mongoose.models.Announcement as Model<IAnnouncement>) ||
  mongoose.model<IAnnouncement>('Announcement', announcementSchema);