import React, { useState, useEffect } from "react";
import { X } from "@phosphor-icons/react";

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const ConfigModal: React.FC<ConfigModalProps> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
  const [activeTab, setActiveTab] = useState<"claude" | "bedrock">("claude");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("claude-3-haiku-20240307");
  const [maxTokens, setMaxTokens] = useState(4096);
  const [temperature, setTemperature] = useState(0.7);
  const [awsRegion, setAwsRegion] = useState("us-east-1");
  const [awsAccessKeyId, setAwsAccessKeyId] = useState("");
  const [awsSecretAccessKey, setAwsSecretAccessKey] = useState("");
  const [bedrockModelId, setBedrockModelId] = useState(
    "anthropic.claude-3-haiku-20240307-v1:0"
  );
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadConfig();
    }
  }, [isOpen]);

  const loadConfig = async () => {
    try {
      const config = await window.electronAPI.config.getConfig();
      setModel(config.claude.model);
      setMaxTokens(config.claude.maxTokens);
      setTemperature(config.claude.temperature);
      setAwsRegion(config.bedrock.awsRegion);
      setBedrockModelId(config.bedrock.modelId);
    } catch (error) {
      console.error("設定読み込みエラー:", error);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setErrors([]);

    try {
      if (activeTab === "claude") {
        if (!apiKey.trim()) {
          setErrors(["Anthropic APIキーを入力してください"]);
          return;
        }
        await window.electronAPI.config.setApiKey(apiKey.trim());
      } else {
        if (!awsAccessKeyId.trim() || !awsSecretAccessKey.trim()) {
          setErrors(["AWS認証情報を入力してください"]);
          return;
        }
        await window.electronAPI.config.setBedrockCredentials(
          awsAccessKeyId.trim(),
          awsSecretAccessKey.trim()
        );
      }

      await window.electronAPI.config.updateConfig({
        claude: {
          model,
          maxTokens,
          temperature,
        },
        bedrock: {
          awsRegion,
          modelId: bedrockModelId,
        },
      });

      const validation = await window.electronAPI.config.validateConfig();
      if (!validation.isValid) {
        setErrors(validation.errors);
        return;
      }

      setApiKey("");
      setAwsAccessKeyId("");
      setAwsSecretAccessKey("");
      onSaved();
    } catch (error) {
      console.error("設定保存エラー:", error);
      setErrors(["設定の保存に失敗しました"]);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">設定</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6">
          <div className="flex space-x-1 mb-6">
            <button
              onClick={() => setActiveTab("claude")}
              className={`px-4 py-2 rounded-lg ${
                activeTab === "claude"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Claude API
            </button>
            <button
              onClick={() => setActiveTab("bedrock")}
              className={`px-4 py-2 rounded-lg ${
                activeTab === "bedrock"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              AWS Bedrock
            </button>
          </div>

          {errors.length > 0 && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              {errors.map((error, index) => (
                <p key={index} className="text-red-600 text-sm">
                  {error}
                </p>
              ))}
            </div>
          )}

          {activeTab === "claude" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Anthropic APIキー
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-ant-..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  モデル
                </label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="claude-3-haiku-20240307">
                    Claude 3 Haiku
                  </option>
                  <option value="claude-3-sonnet-20240229">
                    Claude 3 Sonnet
                  </option>
                  <option value="claude-3-opus-20240229">Claude 3 Opus</option>
                </select>
              </div>
            </div>
          )}

          {activeTab === "bedrock" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  AWSリージョン
                </label>
                <select
                  value={awsRegion}
                  onChange={(e) => setAwsRegion(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="us-east-1">us-east-1</option>
                  <option value="us-west-2">us-west-2</option>
                  <option value="eu-west-1">eu-west-1</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  AWSアクセスキーID
                </label>
                <input
                  type="text"
                  value={awsAccessKeyId}
                  onChange={(e) => setAwsAccessKeyId(e.target.value)}
                  placeholder="AKIAxxxxxxxxxxxx"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  AWSシークレットアクセスキー
                </label>
                <input
                  type="password"
                  value={awsSecretAccessKey}
                  onChange={(e) => setAwsSecretAccessKey(e.target.value)}
                  placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bedrockモデル
                </label>
                <select
                  value={bedrockModelId}
                  onChange={(e) => setBedrockModelId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="anthropic.claude-3-haiku-20240307-v1:0">
                    Claude 3 Haiku
                  </option>
                  <option value="anthropic.claude-3-sonnet-20240229-v1:0">
                    Claude 3 Sonnet
                  </option>
                  <option value="anthropic.claude-3-opus-20240229-v1:0">
                    Claude 3 Opus
                  </option>
                </select>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 mt-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                最大トークン数
              </label>
              <input
                type="number"
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                min="100"
                max="200000"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                温度設定
              </label>
              <input
                type="number"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                min="0"
                max="1"
                step="0.1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-3 p-6 border-t">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
          >
            {isSaving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
};
