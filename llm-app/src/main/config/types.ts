export interface ClaudeConfig {
  anthropicApiKey?: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

export interface BedrockConfig {
  awsRegion: string;
  awsAccessKeyId?: string;
  awsSecretAccessKey?: string;
  modelId: string;
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  language: string;
  autoSave: boolean;
  autoSaveInterval: number;
  contextFilePath?: string;
}

export interface DatabaseConfig {
  databasePath: string;
  maxSessionHistory: number;
}

export interface FileConfig {
  maxFileSize: number;
  allowedFileTypes: string[];
  uploadDirectory: string;
}

export interface AppConfig {
  claude: ClaudeConfig;
  bedrock: BedrockConfig;
  app: AppSettings;
  database: DatabaseConfig;
  file: FileConfig;
}

export const defaultConfig: AppConfig = {
  claude: {
    model: 'claude-3-haiku-20240307',
    maxTokens: 4096,
    temperature: 0.7,
  },
  bedrock: {
    awsRegion: 'us-east-1',
    modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
  },
  app: {
    theme: 'system',
    language: 'ja',
    autoSave: true,
    autoSaveInterval: 30000,
  },
  database: {
    databasePath: '',
    maxSessionHistory: 1000,
  },
  file: {
    maxFileSize: 10485760,
    allowedFileTypes: ['.txt', '.md', '.json', '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.h', '.css', '.html', '.xml', '.yaml', '.yml'],
    uploadDirectory: '',
  },
};