import mongoose, { Schema, type Document, type Model } from 'mongoose';

export type IncidentCategory =
  | 'Fire'
  | 'Flood'
  | 'Medical Emergency'
  | 'Criminal Activity'
  | 'Road Accident'
  | 'Domestic Dispute'
  | 'Infrastructure Damage'
  | 'Public Disturbance'
  | 'Other';

export type TriagePriority = 'Critical' | 'High' | 'Medium' | 'Low';

export type IncidentStatus =
  | 'Pending'
  | 'Responding'
  | 'Resolved'
  | 'Closed'
  | 'Duplicate';

/** The admin/official who made a status change (name captured at change time). */
export interface IIncidentChangeActor {
  userId: string;
  fullName: string;
}

/**
 * One entry per status change. `remarks` is the admin note recorded with the
 * transition, and `duplicateOfIncidentId` is set when the report was marked as
 * a duplicate of another report.
 */
export interface IIncidentTimeline {
  step: string;
  date: Date;
  status: string;
  remarks?: string;
  changedBy?: IIncidentChangeActor;
  duplicateOfIncidentId?: string;
}

export interface IIncidentReport extends Document {
  incidentId: string;
  residentId: mongoose.Types.ObjectId; // Reporter ref -> Resident
  incidentCategory: IncidentCategory;
  descriptionText: string;
  locationDetails: string;
  triagePriority: TriagePriority; // Automated by Rule-Based Prioritization engine
  evidenceMediaUrls: string[]; // AWS S3 links for photos/videos
  incidentStatus: IncidentStatus;
  /** Latest status-change remark (kept in sync with the newest timeline entry). */
  remarks?: string;
  /** Full status-change history (oldest first). */
  timeline: IIncidentTimeline[];
  /** Original report this one duplicates (`INC-...`), while status is Duplicate. */
  duplicateOfIncidentId?: string;
  reportedAt: Date;
  updatedAt: Date;
}

const changeActorSchema = new Schema<IIncidentChangeActor>(
  {
    userId: { type: String, required: true, trim: true },
    fullName: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const timelineSchema = new Schema<IIncidentTimeline>(
  {
    step: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    status: { type: String, required: true, trim: true },
    remarks: { type: String, trim: true },
    changedBy: { type: changeActorSchema, required: false },
    duplicateOfIncidentId: { type: String, trim: true },
  },
  { _id: false }
);

const incidentReportSchema = new Schema<IIncidentReport>(
  {
    incidentId: { type: String, required: true, unique: true, trim: true },
    residentId: {
      type: Schema.Types.ObjectId,
      ref: 'Resident',
      required: true,
      index: true,
    },
    incidentCategory: {
      type: String,
      enum: [
        'Fire',
        'Flood',
        'Medical Emergency',
        'Criminal Activity',
        'Road Accident',
        'Domestic Dispute',
        'Infrastructure Damage',
        'Public Disturbance',
        'Other',
      ],
      required: true,
    },
    descriptionText: { type: String, required: true },
    locationDetails: { type: String, required: true, trim: true },
    triagePriority: {
      type: String,
      enum: ['Critical', 'High', 'Medium', 'Low'],
      default: 'Low',
    },
    evidenceMediaUrls: { type: [String], default: [] },
    incidentStatus: {
      type: String,
      enum: ['Pending', 'Responding', 'Resolved', 'Closed', 'Duplicate'],
      default: 'Pending',
    },
    remarks: { type: String, trim: true },
    timeline: { type: [timelineSchema], default: [] },
    duplicateOfIncidentId: {
      type: String,
      trim: true,
      index: true,
      sparse: true,
    },
    reportedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true }
);

incidentReportSchema.index({ incidentStatus: 1, triagePriority: 1 });
incidentReportSchema.index({ incidentCategory: 1 });
incidentReportSchema.index({ reportedAt: -1 });

export const IncidentReport: Model<IIncidentReport> =
  (mongoose.models.IncidentReport as Model<IIncidentReport>) ||
  mongoose.model<IIncidentReport>('IncidentReport', incidentReportSchema);