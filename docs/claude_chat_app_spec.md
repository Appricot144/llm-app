# 設定ファイル仕様

## ファイル形式・保存場所

- **形式**: JSON
- **ファイル名**: `config.json`
- **保存場所**: `app.getPath('userData')/config.json`
- **保存方式**: リアルタイム保存（設定変更時に即座に保存）

### 設定ファイル構造

```typescript
interface MinimalAppConfig {
  // LLMプロバイダー設定
  providers: {
    defaultProvider: "anthropic" | "bedrock";

    anthropic?: {
      apiKey: string; // 必須: API認証
      model: string; // 必須: 使用モデル
      maxTokens: number; // 必須: レスポンス上限
    };

    bedrock?: {
      region: string; // 必須: AWSリージョン
      accessKeyId: string; // 必須: AWS認証
      secretAccessKey: string; // 必須: AWS認証
      modelId: string; // 必須: Bedrockモデル
      maxTokens: number; // 必須: レスポンス上限
    };
  };

  // データベース設定
  database: {
    path: string; // 必須: SQLiteファイルの場所
  };

  // コンテキストファイル設定
  context: {
    filePath: string; // 必須: context.mdの場所
  };

  // ファイル処理設定
  files: {
    maxFileSize: number; // 必須: ファイルサイズ制限（MB）
    allowedExtensions: string[]; // 必須: 許可する拡張子
  };
}
```

### 設定ファイル例

```json
{
  "providers": {
    "defaultProvider": "anthropic",
    "anthropic": {
      "apiKey": "sk-ant-...",
      "model": "claude-3-5-sonnet-20241022",
      "maxTokens": 4096
    },
    "bedrock": {
      "region": "us-east-1",
      "accessKeyId": "AKIA...",
      "secretAccessKey": "...",
      "modelId": "anthropic.claude-3-5-sonnet-20241022-v2:0",
      "maxTokens": 4096
    }
  },
  "database": {
    "path": "./data/chat.db"
  },
  "context": {
    "filePath": "./context.md"
  },
  "files": {
    "maxFileSize": 10,
    "allowedExtensions": [
      ".txt",
      ".md",
      ".js",
      ".ts",
      ".json",
      ".png",
      ".jpg",
      ".jpeg"
    ]
  }
}
```

## 設定ファイルの動作方針

### 初期化

- アプリケーションの初期インストール時点でデフォルト値を設定
- 設定ファイルが存在しない場合、デフォルト値で自動作成

### エラーハンドリング

以下の場合にユーザーにエラーを表示：

- JSON パースエラー
- 設定ファイルが存在しない場合
- 設定の欠損・不正値の場合

### 設定変更

- リアルタイム保存（設定変更時に即座にファイルに保存）
- 設定変更時のバリデーション実行

## デフォルト値（後日決定）

- 各設定項目のデフォルト値は実装時に決定
- 特に API キーなどの認証情報は空文字で初期化し、ユーザー入力を必須とする
