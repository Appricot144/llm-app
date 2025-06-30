export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  filePaths?: string[];
  timestamp: Date;
  tokenCount?: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
  totalTokens: number;
}

export interface SendMessageRequest {
  message: string;
  filePaths?: string[];
  sessionId?: string;
  contextFilePath?: string;
}

export interface SendMessageResponse {
  response: string;
  sessionId: string;
  tokenCount: number;
  totalTokens: number;
}

export interface FileAttachment {
  path: string;
  content: string;
  mimeType: string;
  size: number;
}

export class ChatError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'ChatError';
  }
}

export interface ApiProvider {
  sendMessage: (
    messages: ChatMessage[],
    config: any
  ) => Promise<{ content: string; tokenCount: number }>;
}