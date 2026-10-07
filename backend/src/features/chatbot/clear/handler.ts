import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { forbiddenError } from '../../../shared/errors';
import { ChatbotConversation } from '../../../models';
import { getAuthContext } from '../../../shared/authorization';

/**
 * Chatbot — Clear Conversation
 * Use-case: delete the caller's assistant conversation history.
 * DELETE /chatbot/conversation (resident only)
 */
export async function clearConversation(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  if (auth.role !== 'resident') {
    throw forbiddenError('The assistant is available to residents only.');
  }

  await connectToDatabase();

  await ChatbotConversation.deleteOne({ residentId: auth.userId });

  return ok({ cleared: true }, 'Chatbot conversation cleared.');
}

export const handler = withErrorHandling(clearConversation);
