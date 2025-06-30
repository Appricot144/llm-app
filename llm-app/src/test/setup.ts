import "@testing-library/jest-dom";

global.window.electronAPI = {
  chat: {
    sendMessage: vi.fn(),
    getSession: vi.fn(),
    getAllSessions: vi.fn(),
    deleteSession: vi.fn(),
    clearAllSessions: vi.fn(),
  },
  config: {
    getConfig: vi.fn(),
    updateConfig: vi.fn(),
    setApiKey: vi.fn(),
    isApiKeyConfigured: vi.fn(),
    setBedrockCredentials: vi.fn(),
    isBedrockConfigured: vi.fn(),
    validateConfig: vi.fn(),
  },
};
