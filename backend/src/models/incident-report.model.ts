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

export type IncidentStatus = 'Pending' | 'Responding' | 'Resolved' | 'Closed';

export interface IIncidentReport extends Document {
  incidentId: string;
  residentId: mongoose.Types.ObjectId; // Reporter ref -> Resident
  incidentCategory: IncidentCategory;
  descriptionText: string;
  locationDetails: string;
  triagePriority: TriagePriority; // Automated by Rule-Based Prioritization engine
  evidenceMediaUrls: string[]; // AWS S3 links for photos/videos
  incidentStatus: IncidentStatus;
  reportedAt: Date;
  updatedAt: Date;
}

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
      enum: ['Pending', 'Responding', 'Resolved', 'Closed'],
      default: 'Pending',
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