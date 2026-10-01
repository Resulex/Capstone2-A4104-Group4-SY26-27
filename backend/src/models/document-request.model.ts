import mongoose, { Schema, type Document, type Model } from 'mongoose';

export type DocumentCurrentStatus =
  | 'Submitted'
  | 'Processing'
  | 'Ready for Pickup'
  | 'Released'
  | 'Rejected';

export interface IApplicantDetails {
  fullName: string;
  contactNumber: string;
  emailAddress: string;
}

/** The admin/official who made a status change (name captured at change time). */
export interface IDocumentChangeActor {
  userId: string;
  fullName: string;
}

export interface IDocumentTimeline {
  step: string;
  date: Date;
  status: string;
  /** Admin note recorded with this transition. */
  remarks?: string;
  changedBy?: IDocumentChangeActor;
}

export interface IDocumentRequest extends Document {
  requestId: string;
  residentId: mongoose.Types.ObjectId; // ref -> Resident
  applicantDetails: IApplicantDetails; // Embedded snapshot at time of request
  documentType: string; // e.g., Barangay Clearance
  purpose: string;
  verificationIdUrl?: string; // AWS S3 link to uploaded valid ID
  currentStatus: DocumentCurrentStatus;
  expectedCompletionDate: Date;
  timeline: IDocumentTimeline[];
  remarks?: string; // Latest admin note (mirrors the newest timeline entry)
  /**
   * Soft-archive flag. Archiving is a SUPER_ADMIN-only governance action: the
   * request leaves every normal queue (including the applicant's own list) and
   * is retrievable only from the admin Archived view. `currentStatus` is left
   * untouched so the processing history stays truthful.
   */
  isArchived: boolean;
  archivedAt?: Date;
  /** Admin `_id` of the super admin who archived the request. */
  archivedBy?: string;
  /** Optional note recorded when the request was archived. */
  archivedReason?: string;
  dateRequested: Date;
  /** Set by the schema's `timestamps` option. */
  createdAt: Date;
  updatedAt: Date;
}

const applicantDetailsSchema = new Schema<IApplicantDetails>(
  {
    fullName: { type: String, required: true, trim: true },
    contactNumber: { type: String, required: true, trim: true },
    emailAddress: { type: String, required: true, trim: true, lowercase: true },
  },
  { _id: false }
);

const changeActorSchema = new Schema<IDocumentChangeActor>(
  {
    userId: { type: String, required: true, trim: true },
    fullName: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const timelineSchema = new Schema<IDocumentTimeline>(
  {
    step: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    status: { type: String, required: true, trim: true },
    remarks: { type: String, trim: true },
    changedBy: { type: changeActorSchema, required: false },
  },
  { _id: false }
);

const documentRequestSchema = new Schema<IDocumentRequest>(
  {
    requestId: { type: String, required: true, unique: true, trim: true },
    residentId: {
      type: Schema.Types.ObjectId,
      ref: 'Resident',
      required: true,
      index: true,
    },
    applicantDetails: { type: applicantDetailsSchema, required: true },
    documentType: { type: String, required: true, trim: true },
    purpose: { type: String, required: true, trim: true },
    verificationIdUrl: { type: String, trim: true },
    currentStatus: {
      type: String,
      enum: ['Submitted', 'Processing', 'Ready for Pickup', 'Released', 'Rejected'],
      default: 'Submitted',
    },
    expectedCompletionDate: { type: Date, required: true },
    timeline: { type: [timelineSchema], default: [] },
    remarks: { type: String, trim: true },
    // Soft-archive (SUPER_ADMIN only) — see the interface for why this is
    // separate from `currentStatus`.
    isArchived: { type: Boolean, default: false },
    archivedAt: { type: Date },
    archivedBy: { type: String, trim: true },
    archivedReason: { type: String, trim: true },
    dateRequested: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true }
);

documentRequestSchema.index({ currentStatus: 1 });
documentRequestSchema.index({ documentType: 1, dateRequested: -1 });

export const DocumentRequest: Model<IDocumentRequest> =
  (mongoose.models.DocumentRequest as Model<IDocumentRequest>) ||
  mongoose.model<IDocumentRequest>('DocumentRequest', documentRequestSchema);