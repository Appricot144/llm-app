import React, { useState, useEffect } from "react";
import { ChatInterface } from "./components/ChatInterface";
import { ConfigModal } from "./components/ConfigModal";
import { SessionSidebar } from "./components/SessionSidebar";

export const App: React.FC = () => {
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isApiKeyConfigured, setIsApiKeyConfigured] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  useEffect(() => {
    checkApiKeyConfiguration();
  }, []);

  const checkApiKeyConfiguration = async () => {
    try {
      const configured = await window.electronAPI.config.isApiKeyConfigured();
      setIsApiKeyConfigured(configured);
      if (!configured) {
        setIsConfigModalOpen(true);
      }
    } catch (error) {
      console.error("APIキー設定の確認に失敗しました:", error);
    }
  };

  const handleConfigSaved = () => {
    setIsConfigModalOpen(false);
    checkApiKeyConfiguration();
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <SessionSidebar
        currentSessionId={currentSessionId}
        onSessionSelect={setCurrentSessionId}
        onNewChat={() => setCurrentSessionId(null)}
        onOpenConfig={() => setIsConfigModalOpen(true)}
      />

      <div className="flex-1 flex flex-col">
        <ChatInterface
          sessionId={currentSessionId}
          onSessionCreated={setCurrentSessionId}
          disabled={!isApiKeyConfigured}
        />
      </div>

      <ConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        onSaved={handleConfigSaved}
      />
    </div>
  );
};
