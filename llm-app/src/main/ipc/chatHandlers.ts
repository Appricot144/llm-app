import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { chatService } from '../services/chatService';
import { configManager } from '../config/appConfig';
import { SendMessageRequest, SendMessageResponse, ChatSession } from '../services/types';
import { AppConfig } from '../config/types';

export function setupChatHandlers(): void {
  ipcMain.handle('chat:sendMessage', async (
    _event: IpcMainInvokeEvent,
    request: SendMessageRequest
  ): Promise<SendMessageResponse> => {
    try {
      return await chatService.sendMessage(request);
    } catch (error) {
      console.error('チャットメッセージ送信エラー:', error);
      throw error;
    }
  });

  ipcMain.handle('chat:getSession', async (
    _event: IpcMainInvokeEvent,
    sessionId: string
  ): Promise<ChatSession | null> => {
    try {
      const session = chatService.getSession(sessionId);
      return session || null;
    } catch (error) {
      console.error('セッション取得エラー:', error);
      throw error;
    }
  });

  ipcMain.handle('chat:getAllSessions', async (
    _event: IpcMainInvokeEvent
  ): Promise<ChatSession[]> => {
    try {
      return chatService.getAllSessions();
    } catch (error) {
      console.error('セッション一覧取得エラー:', error);
      throw error;
    }
  });

  ipcMain.handle('chat:deleteSession', async (
    _event: IpcMainInvokeEvent,
    sessionId: string
  ): Promise<boolean> => {
    try {
      return chatService.deleteSession(sessionId);
    } catch (error) {
      console.error('セッション削除エラー:', error);
      throw error;
    }
  });

  ipcMain.handle('chat:clearAllSessions', async (
    _event: IpcMainInvokeEvent
  ): Promise<void> => {
    try {
      chatService.clearAllSessions();
    } catch (error) {
      console.error('全セッション削除エラー:', error);
      throw error;
    }
  });
}

export function setupConfigHandlers(): void {
  ipcMain.handle('config:getConfig', async (
    _event: IpcMainInvokeEvent
  ): Promise<Omit<AppConfig, 'claude'> & { claude: Omit<AppConfig['claude'], 'anthropicApiKey'> }> => {
    try {
      const config = configManager.getConfig();
      return {
        ...config,
        claude: {
          model: config.claude.model,
          maxTokens: config.claude.maxTokens,
          temperature: config.claude.temperature,
        },
      };
    } catch (error) {
      console.error('設定取得エラー:', error);
      throw error;
    }
  });

  ipcMain.handle('config:updateConfig', async (
    _event: IpcMainInvokeEvent,
    updates: Partial<AppConfig>
  ): Promise<void> => {
    try {
      configManager.updateConfig(updates);
      chatService.updateConfig();
    } catch (error) {
      console.error('設定更新エラー:', error);
      throw error;
    }
  });

  ipcMain.handle('config:setApiKey', async (
    _event: IpcMainInvokeEvent,
    apiKey: string
  ): Promise<void> => {
    try {
      configManager.setApiKey(apiKey);
      chatService.updateConfig();
    } catch (error) {
      console.error('APIキー設定エラー:', error);
      throw error;
    }
  });

  ipcMain.handle('config:isApiKeyConfigured', async (
    _event: IpcMainInvokeEvent
  ): Promise<boolean> => {
    try {
      return configManager.isApiKeyConfigured();
    } catch (error) {
      console.error('APIキー設定確認エラー:', error);
      return false;
    }
  });

  ipcMain.handle('config:setBedrockCredentials', async (
    _event: IpcMainInvokeEvent,
    accessKeyId: string,
    secretAccessKey: string
  ): Promise<void> => {
    try {
      configManager.setBedrockCredentials(accessKeyId, secretAccessKey);
      chatService.updateConfig();
    } catch (error) {
      console.error('Bedrock認証情報設定エラー:', error);
      throw error;
    }
  });

  ipcMain.handle('config:isBedrockConfigured', async (
    _event: IpcMainInvokeEvent
  ): Promise<boolean> => {
    try {
      return configManager.isBedrockConfigured();
    } catch (error) {
      console.error('Bedrock設定確認エラー:', error);
      return false;
    }
  });

  ipcMain.handle('config:validateConfig', async (
    _event: IpcMainInvokeEvent
  ): Promise<{ isValid: boolean; errors: string[] }> => {
    try {
      return configManager.validateConfig();
    } catch (error) {
      console.error('設定検証エラー:', error);
      return {
        isValid: false,
        errors: ['設定の検証中にエラーが発生しました'],
      };
    }
  });
}

export function setupAllHandlers(): void {
  setupChatHandlers();
  setupConfigHandlers();
}