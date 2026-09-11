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
  dateRequested: Date;
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
    dateRequested: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true }
);

documentRequestSchema.index({ currentStatus: 1 });
documentRequestSchema.index({ documentType: 1, dateRequested: -1 });

export const DocumentRequest: Model<IDocumentRequest> =
  (mongoose.models.DocumentRequest as Model<IDocumentRequest>) ||
  mongoose.model<IDocumentRequest>('DocumentRequest', documentRequestSchema);