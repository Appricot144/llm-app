import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { AppConfigManager } from '../appConfig';

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/test/userData'),
  },
}));

vi.mock('fs');
vi.mock('path');

describe('AppConfigManager', () => {
  let configManager: AppConfigManager;
  const mockUserDataPath = '/test/userData';
  const mockConfigPath = '/test/userData/config.json';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(path.join).mockReturnValue(mockConfigPath);
    vi.mocked(fs.existsSync).mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      
      configManager = new AppConfigManager();
      const config = configManager.getConfig();
      
      expect(config.claude.model).toBe('claude-3-haiku-20240307');
      expect(config.claude.maxTokens).toBe(4096);
      expect(config.claude.temperature).toBe(0.7);
    });

    it('should load existing configuration', () => {
      const mockConfig = {
        claude: {
          model: 'claude-3-sonnet-20240229',
          maxTokens: 8192,
          temperature: 0.5,
        },
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockConfig));
      
      configManager = new AppConfigManager();
      const config = configManager.getConfig();
      
      expect(config.claude.model).toBe('claude-3-sonnet-20240229');
      expect(config.claude.maxTokens).toBe(8192);
      expect(config.claude.temperature).toBe(0.5);
    });
  });

  describe('setApiKey', () => {
    beforeEach(() => {
      configManager = new AppConfigManager();
    });

    it('should set API key', () => {
      const testApiKey = 'sk-ant-test123';
      
      configManager.setApiKey(testApiKey);
      
      expect(configManager.getApiKey()).toBe(testApiKey);
    });

    it('should return true when API key is configured', () => {
      configManager.setApiKey('sk-ant-test123');
      
      expect(configManager.isApiKeyConfigured()).toBe(true);
    });
  });

  describe('validateConfig', () => {
    beforeEach(() => {
      configManager = new AppConfigManager();
    });

    it('should validate configuration with API key', () => {
      configManager.setApiKey('sk-ant-test123');
      
      const validation = configManager.validateConfig();
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should return errors for invalid configuration', () => {
      const validation = configManager.validateConfig();
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should validate token limits', () => {
      configManager.setApiKey('sk-ant-test123');
      configManager.updateConfig({
        claude: {
          model: 'claude-3-haiku-20240307',
          maxTokens: -1,
          temperature: 0.7,
        },
      });
      
      const validation = configManager.validateConfig();
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('最大トークン数は1以上である必要があります');
    });

    it('should validate temperature range', () => {
      configManager.setApiKey('sk-ant-test123');
      configManager.updateConfig({
        claude: {
          model: 'claude-3-haiku-20240307',
          maxTokens: 4096,
          temperature: 1.5,
        },
      });
      
      const validation = configManager.validateConfig();
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('温度設定は0から1の範囲である必要があります');
    });
  });

  describe('saveConfig', () => {
    beforeEach(() => {
      configManager = new AppConfigManager();
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
      vi.mocked(fs.writeFileSync).mockImplementation(() => undefined);
      vi.mocked(path.dirname).mockReturnValue('/test/userData');
    });

    it('should save configuration without sensitive data', () => {
      configManager.setApiKey('sk-ant-test123');
      configManager.setBedrockCredentials('access-key', 'secret-key');
      
      configManager.saveConfig();
      
      expect(fs.writeFileSync).toHaveBeenCalled();
      const [, configData] = vi.mocked(fs.writeFileSync).mock.calls[0];
      const parsedConfig = JSON.parse(configData as string);
      
      expect(parsedConfig.claude.anthropicApiKey).toBeUndefined();
      expect(parsedConfig.bedrock.awsAccessKeyId).toBeUndefined();
      expect(parsedConfig.bedrock.awsSecretAccessKey).toBeUndefined();
    });
  });
});