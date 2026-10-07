import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parseBody } from '../../../shared/handler';
import { ok } from '../../../shared/responses';
import { badRequestError, forbiddenError, validationError } from '../../../shared/errors';
import { ChatbotConversation } from '../../../models';
import { getAuthContext } from '../../../shared/authorization';
import {
  generateChatReply,
  ChatbotMessage,
  CHATBOT_MAX_MESSAGES,
  CHATBOT_MAX_MESSAGE_LENGTH,
} from '../../../shared/chatbot';

/**
 * Chatbot — Send Message
 * Use-case: append the resident's message, generate an assistant reply, and
 * persist both. Informational Q&A only — this endpoint never changes any
 * business record; the model is instructed accordingly.
 * POST /chatbot/messages (resident only)
 */
export async function sendMessage(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  if (auth.role !== 'resident') {
    throw forbiddenError('The assistant is available to residents only.');
  }

  const body = parseBody(event);
  const rawMessage = typeof body.message === 'string' ? body.message.trim() : '';
  if (!rawMessage) {
    throw badRequestError('A message is required.');
  }
  if (rawMessage.length > CHATBOT_MAX_MESSAGE_LENGTH) {
    throw validationError(
      `Message is too long (max ${CHATBOT_MAX_MESSAGE_LENGTH} characters).`
    );
  }

  await connectToDatabase();

  let conversation = await ChatbotConversation.findOne({
    residentId: auth.userId,
  });
  if (!conversation) {
    conversation = await ChatbotConversation.create({
      residentId: auth.userId,
      messages: [],
    });
  }

  // History handed to the model: previous turns plus the new user message,
  // already capped so the prompt cannot grow unbounded.
  const userTurn: ChatbotMessage = { role: 'user', content: rawMessage };
  const history: ChatbotMessage[] = [
    ...conversation.messages.map(
      ({ role, content }): ChatbotMessage => ({ role, content })
    ),
    userTurn,
  ].slice(-CHATBOT_MAX_MESSAGES);

  const reply = await generateChatReply(history);

  // Persist the new pair, dropping the oldest turns past the cap.
  const updated = [
    ...conversation.messages.map(({ role, content, createdAt }) => ({
      role,
      content,
      createdAt,
    })),
    { role: 'user' as const, content: rawMessage, createdAt: new Date() },
    { role: 'assistant' as const, content: reply, createdAt: new Date() },
  ].slice(-CHATBOT_MAX_MESSAGES);

  conversation.set('messages', updated);
  await conversation.save();

  return ok(
    { reply, messages: updated },
    'Assistant reply generated.'
  );
}

export const handler = withErrorHandling(sendMessage);
