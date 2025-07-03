import { v4 as uuidv4 } from "uuid";
import * as fs from "fs";
import * as path from "path";
import { configManager } from "../config/appConfig";
import { ClaudeProvider } from "./claudeProvider";
import {
  ChatMessage,
  ChatSession,
  SendMessageRequest,
  SendMessageResponse,
  ChatError,
} from "./types";

export class ChatService {
  private claudeProvider: ClaudeProvider | null = null;
  private sessions: Map<string, ChatSession> = new Map();

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders(): void {
    const config = configManager.getConfig();

    if (config.claude.anthropicApiKey) {
      this.claudeProvider = new ClaudeProvider(config.claude);
    }
  }

  public updateConfig(): void {
    this.initializeProviders();
  }

  private createNewSession(title?: string): ChatSession {
    const sessionId = uuidv4();
    const session: ChatSession = {
      id: sessionId,
      title: title || "New Chat",
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      totalTokens: 0,
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  private generateSessionTitle(message: string): string {
    const maxLength = 50;
    const cleanMessage = message.replace(/\s+/g, " ").trim();

    if (cleanMessage.length <= maxLength) {
      return cleanMessage;
    }

    return cleanMessage.substring(0, maxLength - 3) + "...";
  }

  private async loadContextFile(contextFilePath?: string): Promise<string> {
    if (!contextFilePath) {
      return "";
    }

    try {
      if (fs.existsSync(contextFilePath)) {
        const contextContent = fs.readFileSync(contextFilePath, "utf-8");
        return `プロジェクトコンテキスト:\n${contextContent}\n\n`;
      }
    } catch (error) {
      console.warn("コンテキストファイルの読み込みに失敗しました:", error);
    }

    return "";
  }

  private async processMessage(
    userMessage: string,
    filePaths: string[] = [],
    contextFilePath?: string
  ): Promise<string> {
    let processedMessage = userMessage;

    const contextContent = await this.loadContextFile(contextFilePath);
    if (contextContent) {
      processedMessage = contextContent + processedMessage;
    }

    if (filePaths.length > 0) {
      const fileContents: string[] = [];

      for (const filePath of filePaths) {
        try {
          if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, "utf-8");
            const fileName = path.basename(filePath);
            fileContents.push(
              `ファイル: ${fileName}\n\`\`\`\n${content}\n\`\`\``
            );
          }
        } catch (error) {
          console.warn(`ファイル読み込みエラー: ${filePath}`, error);
        }
      }

      if (fileContents.length > 0) {
        processedMessage += "\n\n" + fileContents.join("\n\n");
      }
    }

    return processedMessage;
  }

  public async sendMessage(
    request: SendMessageRequest
  ): Promise<SendMessageResponse> {
    if (!this.claudeProvider) {
      throw new ChatError(
        "Claude APIが設定されていません",
        "PROVIDER_NOT_CONFIGURED"
      );
    }

    try {
      let session: ChatSession;

      if (request.sessionId) {
        session = this.sessions.get(request.sessionId);
        if (!session) {
          throw new ChatError(
            "セッションが見つかりません",
            "SESSION_NOT_FOUND"
          );
        }
      } else {
        const title = this.generateSessionTitle(request.message);
        session = this.createNewSession(title);
      }

      const processedMessage = await this.processMessage(
        request.message,
        request.filePaths,
        request.contextFilePath
      );

      const userMessage: ChatMessage = {
        role: "user",
        content: processedMessage,
        filePaths: request.filePaths,
        timestamp: new Date(),
      };

      const messages = [...session.messages, userMessage];

      const response = await this.claudeProvider.sendMessage(messages);

      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: response.content,
        timestamp: new Date(),
        tokenCount: response.tokenCount,
      };

      session.messages.push(userMessage, assistantMessage);
      session.updatedAt = new Date();
      session.totalTokens += response.tokenCount;

      return {
        response: response.content,
        sessionId: session.id,
        tokenCount: response.tokenCount,
        totalTokens: session.totalTokens,
      };
    } catch (error) {
      if (error instanceof ChatError) {
        throw error;
      }
      throw new ChatError(
        `メッセージ送信に失敗しました: ${
          error instanceof Error ? error.message : String(error)
        }`,
        "SEND_MESSAGE_FAILED"
      );
    }
  }

  public getSession(sessionId: string): ChatSession | undefined {
    return this.sessions.get(sessionId);
  }

  public getAllSessions(): ChatSession[] {
    return Array.from(this.sessions.values()).sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
    );
  }

  public deleteSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  public clearAllSessions(): void {
    this.sessions.clear();
  }

  public getSessionCount(): number {
    return this.sessions.size;
  }
}

export const chatService = new ChatService();
