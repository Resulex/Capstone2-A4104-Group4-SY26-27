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
  /**
   * Contact number the reporter supplied for this incident (digits only, at
   * most 11 — see `shared/contact-number.ts`). Optional: the create handler
   * falls back to the reporting resident's stored number, and reports filed
   * before this field existed simply have none.
   */
  contactNumber?: string;
  /**
   * LEGACY free-text address. New reports no longer write it: the write path
   * takes a validated `purok` plus an optional free-text `landmark`, so the
   * location can be checked against the barangay's own vocabulary.
   *
   * The column is kept rather than removed for two reasons: records filed before
   * the purok field existed must keep rendering, and dropping it from the schema
   * would make responses disagree — `list` reads raw documents (`.lean()`),
   * which still returns the value, while `get`/`create`/`update` use
   * `.toObject()`, which strips fields absent from the schema.
   */
  locationDetails?: string;
  /** Validated purok the incident is in. Required on the write path. */
  purok?: string;
  /** Free-text landmark/house note supplementing `purok`. Never validated. */
  landmark?: string;
  /**
   * Pinned location from the incident map picker (WGS84 decimal degrees).
   * Optional: reports filed before the picker existed carry only
   * `locationDetails`, so the UI must render without a pin for those.
   */
  latitude?: number;
  longitude?: number;
  triagePriority: TriagePriority; // Automated by Rule-Based Prioritization engine
  evidenceMediaUrls: string[]; // AWS S3 links for photos/videos
  incidentStatus: IncidentStatus;
  /** Latest status-change remark (kept in sync with the newest timeline entry). */
  remarks?: string;
  /** Full status-change history (oldest first). */
  timeline: IIncidentTimeline[];
  /** Original report this one duplicates (`INC-...`), while status is Duplicate. */
  duplicateOfIncidentId?: string;
  /**
   * Soft-archive flag. Archiving is a SUPER_ADMIN-only governance action: the
   * report leaves every normal queue (including the reporter's own list) and is
   * retrievable only from the admin Archived view. Distinct from
   * `incidentStatus`, which tracks operational progress and is never rewritten
   * by archiving — the history stays intact.
   */
  isArchived: boolean;
  archivedAt?: Date;
  /** Admin `_id` of the super admin who archived the report. */
  archivedBy?: string;
  /** Optional note recorded when the report was archived. */
  archivedReason?: string;
  reportedAt: Date;
  /** Set by the schema's `timestamps` option. */
  createdAt: Date;
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
    descriptionText: { type: String, default: '' },
    // Optional reporter contact snapshot. Deliberately not `required`: legacy
    // records have no value, and the create handler is what validates and
    // normalizes whatever the client supplies.
    contactNumber: { type: String, trim: true },
    // Legacy column — see the interface. Optional because new reports no longer
    // write it, and `required: true` would make `create()` fail validation.
    locationDetails: { type: String, trim: true },
    // Optional in the schema but required by the create handler: a
    // `required: true` field here would make `save()` throw on the pre-existing
    // records the backfill migration cannot match.
    purok: { type: String, trim: true },
    landmark: { type: String, trim: true },
    // Optional map pin. The two are validated as a pair in the request handlers
    // (`shared/coordinates.ts`) so bad input is a 400, not a Mongoose 500.
    latitude: { type: Number, min: -90, max: 90 },
    longitude: { type: Number, min: -180, max: 180 },
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
    // Soft-archive (SUPER_ADMIN only). `default: false` means new records always
    // carry the flag; the `-archive-flags` migration backfills the older ones so
    // the active-scope query never has to tolerate a missing field.
    isArchived: { type: Boolean, default: false },
    archivedAt: { type: Date },
    archivedBy: { type: String, trim: true },
    archivedReason: { type: String, trim: true },
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