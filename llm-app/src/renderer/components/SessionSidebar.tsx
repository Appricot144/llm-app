import React, { useState, useEffect } from "react";
import { ChatCircle, Plus, Gear, Trash } from "@phosphor-icons/react";

interface ChatSession {
  id: string;
  title: string;
  updatedAt: Date;
  totalTokens: number;
}

interface SessionSidebarProps {
  currentSessionId: string | null;
  onSessionSelect: (sessionId: string) => void;
  onNewChat: () => void;
  onOpenConfig: () => void;
}

export const SessionSidebar: React.FC<SessionSidebarProps> = ({
  currentSessionId,
  onSessionSelect,
  onNewChat,
  onOpenConfig,
}) => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const loadedSessions = await window.electronAPI.chat.getAllSessions();
      setSessions(loadedSessions);
    } catch (error) {
      console.error("セッション読み込みエラー:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSession = async (
    sessionId: string,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();

    if (confirm("このセッションを削除しますか？")) {
      try {
        await window.electronAPI.chat.deleteSession(sessionId);
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));

        if (currentSessionId === sessionId) {
          onNewChat();
        }
      } catch (error) {
        console.error("セッション削除エラー:", error);
      }
    }
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours < 1) {
      return "今";
    } else if (diffHours < 24) {
      return `${Math.floor(diffHours)}時間前`;
    } else {
      return new Date(date).toLocaleDateString("ja-JP");
    }
  };

  return (
    <div className="w-80 bg-gray-900 text-white flex flex-col">
      <div className="p-4 border-b border-gray-700">
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 py-2 px-4 rounded-lg transition-colors"
        >
          <Plus size={16} />
          <span>新しいチャット</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-gray-400">読み込み中...</div>
        ) : sessions.length === 0 ? (
          <div className="p-4 text-center text-gray-400">
            セッションがありません
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {sessions.map((session) => (
              <div
                key={session.id}
                onClick={() => onSessionSelect(session.id)}
                className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                  currentSessionId === session.id
                    ? "bg-blue-600"
                    : "hover:bg-gray-800"
                }`}
              >
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <ChatCircle
                    size={16}
                    className="text-gray-400 flex-shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{session.title}</div>
                    <div className="text-xs text-gray-400 flex items-center space-x-2">
                      <span>{formatDate(session.updatedAt)}</span>
                      <span>•</span>
                      <span>{session.totalTokens} トークン</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={(e) => handleDeleteSession(session.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-400 transition-opacity"
                >
                  <Trash size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-gray-700 p-4">
        <button
          onClick={onOpenConfig}
          className="w-full flex items-center space-x-2 text-gray-400 hover:text-white py-2 px-3 rounded-lg hover:bg-gray-800 transition-colors"
        >
          <Gear size={16} />
          <span>設定</span>
        </button>
      </div>
    </div>
  );
};
