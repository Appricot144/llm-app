import { contextBridge, ipcRenderer } from 'electron';
import { SendMessageRequest, SendMessageResponse, ChatSession } from './main/services/types';
import { AppConfig } from './main/config/types';

type ConfigApiResponse = Omit<AppConfig, 'claude'> & { 
  claude: Omit<AppConfig['claude'], 'anthropicApiKey'> 
};

const electronAPI = {
  chat: {
    sendMessage: (request: SendMessageRequest): Promise<SendMessageResponse> =>
      ipcRenderer.invoke('chat:sendMessage', request),
    
    getSession: (sessionId: string): Promise<ChatSession | null> =>
      ipcRenderer.invoke('chat:getSession', sessionId),
    
    getAllSessions: (): Promise<ChatSession[]> =>
      ipcRenderer.invoke('chat:getAllSessions'),
    
    deleteSession: (sessionId: string): Promise<boolean> =>
      ipcRenderer.invoke('chat:deleteSession', sessionId),
    
    clearAllSessions: (): Promise<void> =>
      ipcRenderer.invoke('chat:clearAllSessions'),
  },
  
  config: {
    getConfig: (): Promise<ConfigApiResponse> =>
      ipcRenderer.invoke('config:getConfig'),
    
    updateConfig: (updates: Partial<AppConfig>): Promise<void> =>
      ipcRenderer.invoke('config:updateConfig', updates),
    
    setApiKey: (apiKey: string): Promise<void> =>
      ipcRenderer.invoke('config:setApiKey', apiKey),
    
    isApiKeyConfigured: (): Promise<boolean> =>
      ipcRenderer.invoke('config:isApiKeyConfigured'),
    
    setBedrockCredentials: (accessKeyId: string, secretAccessKey: string): Promise<void> =>
      ipcRenderer.invoke('config:setBedrockCredentials', accessKeyId, secretAccessKey),
    
    isBedrockConfigured: (): Promise<boolean> =>
      ipcRenderer.invoke('config:isBedrockConfigured'),
    
    validateConfig: (): Promise<{ isValid: boolean; errors: string[] }> =>
      ipcRenderer.invoke('config:validateConfig'),
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

export type ElectronAPI = typeof electronAPI;