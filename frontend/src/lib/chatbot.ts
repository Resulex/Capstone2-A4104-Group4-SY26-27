import { getApi, postApi, deleteApi } from "@/lib/api";

/** A single turn in the resident assistant conversation. */
export interface ChatbotMessage {
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
}

/** Response from POST /chatbot/messages. */
export interface SendChatbotMessageResult {
  reply: string;
  messages: ChatbotMessage[];
}

/** Fetch the caller's assistant conversation (oldest first). */
export function fetchChatbotConversation(): Promise<ChatbotMessage[]> {
  return getApi<ChatbotMessage[]>("chatbot/conversation");
}

/** Send a message and receive the assistant reply + updated history. */
export function sendChatbotMessage(
  message: string,
): Promise<SendChatbotMessageResult> {
  return postApi<SendChatbotMessageResult>("chatbot/messages", { message });
}

/** Clear the caller's assistant conversation. */
export function clearChatbotConversation(): Promise<{ cleared: boolean }> {
  return deleteApi<{ cleared: boolean }>("chatbot/conversation");
}
