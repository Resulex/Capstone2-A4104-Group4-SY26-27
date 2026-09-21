export function detectMessageUrgency(messageText: string): boolean {
    return /\b(emergency|urgent|critical|fire|flood|help|immediately)\b/i.test(messageText);
  }