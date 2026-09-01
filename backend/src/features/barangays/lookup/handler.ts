import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { Barangay } from '../../../models';

/**
 * Barangays — Public Lookup
 * Use-case: lightweight, public lookup of active barangays for the resident
 * sign-up flow (auto-fills the read-only address fields). No auth required.
 * GET /barangays/lookup (public)
 */
export async function lookupBarangays(
  _event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  await connectToDatabase();

  const barangays = await Barangay.find({ isActive: true })
    .sort({ name: 1 })
    .select('name city province zipCode')
    .lean();

  return ok(barangays, 'Barangays fetched.');
}

export const handler = withErrorHandling(lookupBarangays);
