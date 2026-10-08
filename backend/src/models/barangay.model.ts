import mongoose, { Schema, type Document, type Model } from 'mongoose';

/** Geographic center of the barangay (WGS84 decimal degrees). */
export interface IBarangayCenter {
  latitude: number;
  longitude: number;
}

/**
 * Axis-aligned box enclosing the barangay. Used to clamp the incident location
 * picker so a resident cannot pan or drop a pin outside the barangay.
 */
export interface IBarangayBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface IBarangay extends Document {
  name: string;
  city: string;
  province: string;
  region: string;
  zipCode?: string;
  /**
   * Barangay hall contact details. Optional because rows seeded before these
   * fields existed carry none; the chatbot simply omits what is absent.
   */
  contactNumber?: string;
  emailAddress?: string;
  officeAddress?: string;
  /** Weekly office hours lines (e.g. "Monday–Friday: 8:00 AM – 5:00 PM"). */
  officeHours?: string[];
  emergencyHotline?: string;
  emergencyMobile?: string;
  /**
   * Barangay hall / town center. Optional because rows created before this
   * field existed carry no coordinates; the UI falls back to a hardcoded
   * barangay area when it is absent.
   */
  center?: IBarangayCenter;
  /** Box used to clamp the map picker to the barangay. */
  bounds?: IBarangayBounds;
  /**
   * The barangay's puroks/sitios. This is the controlled vocabulary an incident
   * report's `purok` is validated against, which is why it lives in data rather
   * than in a constant: the barangay can correct the list without a code change.
   *
   * Optional because rows seeded before this field existed carry no list; the
   * migration `add-barangay-puroks` backfills them.
   */
  puroks?: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const centerSchema = new Schema<IBarangayCenter>(
  {
    latitude: { type: Number, required: true, min: -90, max: 90 },
    longitude: { type: Number, required: true, min: -180, max: 180 },
  },
  { _id: false }
);

const boundsSchema = new Schema<IBarangayBounds>(
  {
    north: { type: Number, required: true, min: -90, max: 90 },
    south: { type: Number, required: true, min: -90, max: 90 },
    east: { type: Number, required: true, min: -180, max: 180 },
    west: { type: Number, required: true, min: -180, max: 180 },
  },
  { _id: false }
);

const barangaySchema = new Schema<IBarangay>(
  {
    name: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    province: { type: String, required: true, trim: true },
    region: { type: String, required: true, trim: true },
    zipCode: { type: String, trim: true },
    // Optional contact details; rows seeded before these existed have none and
    // must still validate/save (same rule as `center`/`bounds`/`puroks`).
    contactNumber: { type: String, trim: true },
    emailAddress: { type: String, trim: true },
    officeAddress: { type: String, trim: true },
    officeHours: { type: [String], default: [] },
    emergencyHotline: { type: String, trim: true },
    emergencyMobile: { type: String, trim: true },
    // Deliberately optional: dev rows seeded before the map picker existed have
    // no coordinates and must still validate on update. The frontend falls back
    // to a hardcoded barangay area in that case.
    center: { type: centerSchema, required: false },
    bounds: { type: boundsSchema, required: false },
    // No `required: true`: rows seeded before the field existed must still save,
    // exactly like `center`/`bounds`. An empty list is handled by the incident
    // handler, which refuses to validate a purok it cannot check.
    puroks: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

barangaySchema.index({ name: 1, city: 1, province: 1 }, { unique: true });

export const Barangay: Model<IBarangay> =
  (mongoose.models.Barangay as Model<IBarangay>) ||
  mongoose.model<IBarangay>('Barangay', barangaySchema);