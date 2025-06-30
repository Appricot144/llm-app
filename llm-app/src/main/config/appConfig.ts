import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { AppConfig, defaultConfig } from './types';

export class AppConfigManager {
  private configPath: string;
  private config: AppConfig;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.configPath = path.join(userDataPath, 'config.json');
    this.config = { ...defaultConfig };
    this.initializeConfig();
  }

  private initializeConfig(): void {
    this.config.database.databasePath = path.join(app.getPath('userData'), 'chat.db');
    this.config.file.uploadDirectory = path.join(app.getPath('userData'), 'uploads');
    
    this.loadConfig();
  }

  private loadConfig(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, 'utf-8');
        const parsedConfig = JSON.parse(configData);
        this.config = this.mergeConfig(defaultConfig, parsedConfig);
      } else {
        this.saveConfig();
      }
    } catch (error) {
      console.error('設定ファイルの読み込みに失敗しました:', error);
      this.config = { ...defaultConfig };
      this.initializeConfig();
    }
  }

  private mergeConfig(defaultConfig: AppConfig, userConfig: Partial<AppConfig>): AppConfig {
    return {
      claude: { ...defaultConfig.claude, ...userConfig.claude },
      bedrock: { ...defaultConfig.bedrock, ...userConfig.bedrock },
      app: { ...defaultConfig.app, ...userConfig.app },
      database: { ...defaultConfig.database, ...userConfig.database },
      file: { ...defaultConfig.file, ...userConfig.file },
    };
  }

  public saveConfig(): void {
    try {
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      const configToSave = { ...this.config };
      delete configToSave.claude.anthropicApiKey;
      delete configToSave.bedrock.awsAccessKeyId;
      delete configToSave.bedrock.awsSecretAccessKey;

      fs.writeFileSync(
        this.configPath,
        JSON.stringify(configToSave, null, 2),
        'utf-8'
      );
    } catch (error) {
      console.error('設定ファイルの保存に失敗しました:', error);
      throw error;
    }
  }

  public getConfig(): AppConfig {
    return { ...this.config };
  }

  public updateConfig(updates: Partial<AppConfig>): void {
    this.config = this.mergeConfig(this.config, updates);
    this.saveConfig();
  }

  public setApiKey(key: string): void {
    this.config.claude.anthropicApiKey = key;
  }

  public getApiKey(): string | undefined {
    return this.config.claude.anthropicApiKey;
  }

  public setBedrockCredentials(accessKeyId: string, secretAccessKey: string): void {
    this.config.bedrock.awsAccessKeyId = accessKeyId;
    this.config.bedrock.awsSecretAccessKey = secretAccessKey;
  }

  public getBedrockCredentials(): { accessKeyId?: string; secretAccessKey?: string } {
    return {
      accessKeyId: this.config.bedrock.awsAccessKeyId,
      secretAccessKey: this.config.bedrock.awsSecretAccessKey,
    };
  }

  public isApiKeyConfigured(): boolean {
    return !!this.config.claude.anthropicApiKey;
  }

  public isBedrockConfigured(): boolean {
    return !!(this.config.bedrock.awsAccessKeyId && this.config.bedrock.awsSecretAccessKey);
  }

  public validateConfig(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.config.claude.anthropicApiKey && !this.isBedrockConfigured()) {
      errors.push('Anthropic APIキーまたはAWS Bedrockの認証情報が設定されていません');
    }

    if (this.config.claude.maxTokens <= 0) {
      errors.push('最大トークン数は1以上である必要があります');
    }

    if (this.config.claude.temperature < 0 || this.config.claude.temperature > 1) {
      errors.push('温度設定は0から1の範囲である必要があります');
    }

    if (this.config.file.maxFileSize <= 0) {
      errors.push('最大ファイルサイズは1以上である必要があります');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

export const configManager = new AppConfigManager();