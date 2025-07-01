import Anthropic from "@anthropic-ai/sdk";
import { ChatMessage, ApiProvider, ChatError } from "./types";
import { ClaudeConfig } from "../config/types";
import * as fs from "fs";
import * as path from "path";

export class ClaudeProvider implements ApiProvider {
  private client: Anthropic | null = null;

  constructor(private config: ClaudeConfig) {
    this.initializeClient();
  }

  private initializeClient(): void {
    if (!this.config.anthropicApiKey) {
      throw new ChatError(
        "Anthropic APIキーが設定されていません",
        "API_KEY_MISSING"
      );
    }

    this.client = new Anthropic({
      apiKey: this.config.anthropicApiKey,
    });
  }

  public updateConfig(config: ClaudeConfig): void {
    this.config = config;
    this.initializeClient();
  }

  private async processFileAttachments(
    filePaths: string[]
  ): Promise<Array<{ type: string; source: any }>> {
    const attachments: Array<{ type: string; source: any }> = [];

    for (const filePath of filePaths) {
      try {
        if (!fs.existsSync(filePath)) {
          console.warn(`ファイルが見つかりません: ${filePath}`);
          continue;
        }

        const stats = fs.statSync(filePath);
        if (stats.size > 10 * 1024 * 1024) {
          console.warn(`ファイルサイズが大きすぎます: ${filePath}`);
          continue;
        }

        const ext = path.extname(filePath).toLowerCase();
        const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"];

        if (imageExtensions.includes(ext)) {
          const imageData = fs.readFileSync(filePath);
          const base64Data = imageData.toString("base64");
          const mimeType = this.getMimeType(ext);

          attachments.push({
            type: "image",
            source: {
              type: "base64",
              media_type: mimeType,
              data: base64Data,
            },
          });
        } else {
          const textContent = fs.readFileSync(filePath, "utf-8");
          attachments.push({
            type: "text",
            source: {
              type: "text",
              text: `ファイル: ${path.basename(
                filePath
              )}\n\`\`\`\n${textContent}\n\`\`\``,
            },
          });
        }
      } catch (error) {
        console.error(`ファイル処理エラー: ${filePath}`, error);
      }
    }

    return attachments;
  }

  private getMimeType(extension: string): string {
    const mimeTypes: { [key: string]: string } = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
    };
    return mimeTypes[extension] || "application/octet-stream";
  }

  public async sendMessage(
    messages: ChatMessage[]
  ): Promise<{ content: string; tokenCount: number }> {
    if (!this.client) {
      throw new ChatError(
        "Claudeクライアントが初期化されていません",
        "CLIENT_NOT_INITIALIZED"
      );
    }

    try {
      const claudeMessages: Array<any> = [];

      for (const message of messages) {
        if (message.role === "user") {
          const content: Array<any> = [{ type: "text", text: message.content }];

          if (message.filePaths && message.filePaths.length > 0) {
            const attachments = await this.processFileAttachments(
              message.filePaths
            );
            content.push(...attachments);
          }

          claudeMessages.push({
            role: "user",
            content,
          });
        } else {
          claudeMessages.push({
            role: "assistant",
            content: message.content,
          });
        }
      }

      const response = await this.client.messages.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        messages: claudeMessages,
      });

      if (!response.content || response.content.length === 0) {
        throw new ChatError("Claudeからの応答が空です", "EMPTY_RESPONSE");
      }

      const textContent = response.content
        .filter((block: any) => block.type === "text")
        .map((block: any) => block.text)
        .join("");

      return {
        content: textContent,
        tokenCount: response.usage?.output_tokens || 0,
      };
    } catch (error) {
      if (error instanceof Anthropic.APIError) {
        throw new ChatError(
          `Claude API エラー: ${error.message}`,
          "CLAUDE_API_ERROR",
          error.status
        );
      }
      throw new ChatError(
        `メッセージ送信エラー: ${
          error instanceof Error ? error.message : String(error)
        }`,
        "SEND_MESSAGE_ERROR"
      );
    }
  }
}
