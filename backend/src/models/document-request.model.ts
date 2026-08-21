import mongoose, { Schema, type Document, type Model } from 'mongoose';

export type DocumentCurrentStatus =
  | 'Submitted'
  | 'Processing'
  | 'Ready for Pickup'
  | 'Released'
  | 'Rejected';

export type DocumentPaymentStatus = 'Unpaid' | 'Paid Offline';

export interface IApplicantDetails {
  fullName: string;
  contactNumber: string;
  emailAddress: string;
}

export interface IDocumentTimeline {
  step: string;
  date: Date;
  status: string;
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
  paymentStatus: DocumentPaymentStatus;
  verifiedBy?: mongoose.Types.ObjectId; // ref -> Admin (offline payment verifier)
  verifiedAt?: Date;
  officialReceiptNumber?: string; // Manual OR tracking
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

const timelineSchema = new Schema<IDocumentTimeline>(
  {
    step: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    status: { type: String, required: true, trim: true },
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
    paymentStatus: {
      type: String,
      enum: ['Unpaid', 'Paid Offline'],
      default: 'Unpaid',
    },
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'Admin' },
    verifiedAt: { type: Date },
    officialReceiptNumber: { type: String, trim: true },
    dateRequested: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true }
);

documentRequestSchema.index({ currentStatus: 1 });
documentRequestSchema.index({ documentType: 1, dateRequested: -1 });
documentRequestSchema.index({ verifiedBy: 1 });

export const DocumentRequest: Model<IDocumentRequest> =
  (mongoose.models.DocumentRequest as Model<IDocumentRequest>) ||
  mongoose.model<IDocumentRequest>('DocumentRequest', documentRequestSchema);