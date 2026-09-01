import { getApi, postApi } from "@/lib/api";

/**
 * Types + API helpers for the resident sign-up flow (`/signup`).
 *
 * Both endpoints are PUBLIC on the backend, so they work through the generic
 * `/api/backend/*` proxy even without a `kbc_token` cookie.
 */

/** A public, active barangay returned by `GET /barangays/lookup`. */
export interface SignupBarangay {
  _id: string;
  name: string;
  city: string;
  province: string;
  zipCode?: string;
}

/** Payload sent to `POST /auth/register`. */
export interface SignupPayload {
  firstName: string;
  lastName: string;
  middleName?: string;
  suffix?: string;
  email: string;
  contactNumber: string;
  password: string;
  barangayId: string;
  houseUnitNumber: string;
  streetPurokName: string;
}

/** The created account's public shape (from `User.toPublicJSON()`). */
export interface SignupResult {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  isActive: boolean;
}

/**
 * Fetch the active barangays used to auto-fill the read-only address fields
 * on the Residential Address step.
 */
export function fetchSignupBarangay(): Promise<SignupBarangay[]> {
  return getApi<SignupBarangay[]>("/barangays/lookup");
}

/** Create a new account via the public `POST /auth/register` endpoint. */
export function registerResident(payload: SignupPayload): Promise<SignupResult> {
  return postApi<SignupResult>("/auth/register", payload);
}
