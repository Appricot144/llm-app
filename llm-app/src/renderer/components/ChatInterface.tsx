import React, { useState, useEffect, useRef } from "react";
import { PaperAirplaneIcon, PaperClipIcon } from "@phosphor-icons";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  filePaths?: string[];
}

interface ChatInterfaceProps {
  sessionId: string | null;
  onSessionCreated: (sessionId: string) => void;
  disabled?: boolean;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  sessionId,
  onSessionCreated,
  disabled = false,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (sessionId) {
      loadSession(sessionId);
    } else {
      setMessages([]);
    }
  }, [sessionId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadSession = async (id: string) => {
    try {
      const session = await window.electronAPI.chat.getSession(id);
      if (session) {
        setMessages(session.messages);
      }
    } catch (error) {
      console.error("セッション読み込みエラー:", error);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const messageText = inputMessage.trim();
    const filePaths = [...attachedFiles];

    setInputMessage("");
    setAttachedFiles([]);
    setIsLoading(true);

    try {
      const response = await window.electronAPI.chat.sendMessage({
        message: messageText,
        filePaths: filePaths.length > 0 ? filePaths : undefined,
        sessionId: sessionId || undefined,
      });

      if (!sessionId) {
        onSessionCreated(response.sessionId);
      }

      await loadSession(response.sessionId);
    } catch (error) {
      console.error("メッセージ送信エラー:", error);
      alert("メッセージの送信に失敗しました。設定を確認してください。");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const filePaths = Array.from(files).map((file) => file.path);
      setAttachedFiles((prev) => [...prev, ...filePaths]);
    }
    e.target.value = "";
  };

  const removeAttachedFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !disabled && (
          <div className="text-center text-gray-500 mt-8">
            <p>新しい会話を始めましょう</p>
          </div>
        )}

        {disabled && (
          <div className="text-center text-red-500 mt-8">
            <p>APIキーが設定されていません。設定から設定してください。</p>
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-3xl p-3 rounded-lg ${
                message.role === "user"
                  ? "bg-blue-500 text-white"
                  : "bg-white text-gray-800 border"
              }`}
            >
              <div className="whitespace-pre-wrap">{message.content}</div>
              {message.filePaths && message.filePaths.length > 0 && (
                <div className="mt-2 text-sm opacity-75">
                  添付ファイル:{" "}
                  {message.filePaths
                    .map((path) => path.split("/").pop())
                    .join(", ")}
                </div>
              )}
              <div className="text-xs opacity-75 mt-1">
                {new Date(message.timestamp).toLocaleTimeString("ja-JP")}
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white p-3 rounded-lg border">
              <div className="flex items-center space-x-2">
                <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                <span className="text-gray-600">応答を生成中...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="border-t bg-white p-4">
        {attachedFiles.length > 0 && (
          <div className="mb-3">
            <div className="text-sm text-gray-600 mb-2">添付ファイル:</div>
            <div className="flex flex-wrap gap-2">
              {attachedFiles.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center space-x-2 bg-gray-100 px-3 py-1 rounded-full text-sm"
                >
                  <span>{file.split("/").pop()}</span>
                  <button
                    onClick={() => removeAttachedFile(index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-end space-x-2">
          <button
            onClick={handleFileSelect}
            disabled={disabled || isLoading}
            className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50"
          >
            <PaperClipIcon size={20} />
          </button>

          <div className="flex-1">
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={
                disabled ? "APIキーを設定してください" : "メッセージを入力..."
              }
              disabled={disabled || isLoading}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              rows={1}
              style={{ maxHeight: "120px" }}
            />
          </div>

          <button
            onClick={handleSendMessage}
            disabled={disabled || isLoading || !inputMessage.trim()}
            className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:hover:bg-blue-500"
          >
            <PaperAirplaneIcon size={20} />
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileChange}
          className="hidden"
          accept=".txt,.md,.json,.js,.ts,.jsx,.tsx,.py,.java,.cpp,.c,.h,.css,.html,.xml,.yaml,.yml,.jpg,.jpeg,.png,.gif,.webp"
        />
      </div>
    </div>
  );
};
