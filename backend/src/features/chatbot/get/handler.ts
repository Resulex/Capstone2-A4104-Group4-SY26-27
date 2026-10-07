import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { forbiddenError } from '../../../shared/errors';
import { ChatbotConversation } from '../../../models';
import { getAuthContext } from '../../../shared/authorization';

/**
 * Chatbot — Get Conversation
 * Use-case: list the caller's own assistant conversation, oldest first.
 * GET /chatbot/conversation (resident only)
 */
export async function getConversation(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  if (auth.role !== 'resident') {
    throw forbiddenError('The assistant is available to residents only.');
  }

  await connectToDatabase();

  const conversation = await ChatbotConversation.findOne({
    residentId: auth.userId,
  }).lean();

  return ok(conversation?.messages ?? [], 'Chatbot conversation fetched.');
}

export const handler = withErrorHandling(getConversation);
