# Claude Chat App 設計書

## 機能

### 必要な機能

1. **Claude API リクエストの作成**

   - Anthropic Messages API を使用した会話機能
   - マルチモーダル対応（テキスト + 画像）

2. **会話の履歴管理**

   - セッション単位での会話管理
   - SQLite での永続化
   - セッション作成・切り替え・削除

3. **ユーザが選択したファイルをリクエストに含める機能**

   - 複数ファイルの選択・添付
   - 画像ファイル（base64 エンコード）
   - テキストファイル（コードブロック形式）

4. **常に読み込むファイル（context.md）をプロンプトに組み込む機能**
   - プロジェクトコンテキストの自動読み込み
   - 設定可能なファイルパス

## 機能の実装方針

### 1. 認証情報管理

- **方針**: API key などの認証情報はアプリケーションのプロパティファイル（JSON）に保存
- **保存場所**: `app.getPath('userData')/config.json`
- **セキュリティ**: メインプロセスのみで API key を扱い、レンダラープロセスには渡さない

### 2. ファイル受け渡し

- **方針**: レンダラー → メインプロセスへのファイル受け渡しはファイルパスで渡す
- **理由**: IPC で File オブジェクトを直接渡せないため、効率的なファイルパス方式を採用

### 3. ファイル参照方式

- **方針**: ユーザが選択したファイルはパス参照で管理
- **実装**: データベースにファイルパスを JSON 配列で保存

### 4. Context.md 読み込み

- **方針**: メッセージ送信時に context.md を読み込み
- **設定**: context.md の保存先をアプリケーションプロパティで管理
- **タイミング**: 毎回の API 呼び出し時に最新内容を読み込み

### 5. トークン制限対策

- **方針**: 古いメッセージを要約してコンテキスト制限内に収める
- **実装**: Claude API を使って過去の会話を要約し、要約メッセージとして保持

### 6. エラーハンドリング

- **方針**: API 呼び出しエラーは 400 番台でユーザーに通知
- **実装**: try-catch でエラーを捕捉し、ステータスコードに応じた適切なメッセージを表示

### 7. ファイル選択 UI

- **方針**: OS 標準ダイアログとドラッグ&ドロップの両方に対応
- **実装**: `dialog.showOpenDialog()`とドラッグ&ドロップイベントの両方を実装

### 8. データベースマイグレーション

- **方針**: スキーマを変更した際は、patch を当ててマイグレーション
- **実装**: バージョン管理テーブルとマイグレーション実行システム

## 技術スタック

### フレームワーク・ライブラリ

- **アプリケーション**: Electron
- **UI フレームワーク**: React 18
- **言語**: TypeScript
- **データベース**: SQLite3
- **AI API**: @anthropic-ai/sdk

### UI ライブラリ

- **ルーティング**: React Router v6
- **データ取得**: SWR
- **スタイリング**: Tailwind CSS
- **UI コンポーネント**: Headless UI
- **アイコン**: Phosphor Icons

### 開発ツール

- **ビルドツール**: Vite（レンダラープロセス）
- **バンドラー**: TypeScript Compiler（メインプロセス）
- **開発サーバー**: concurrently（並行実行）

## アプリケーション構成

### 全体アーキテクチャ

```
Electron アプリケーション
├── Main Process (Node.js)
│   ├── @anthropic-ai/sdk
│   ├── SQLite (会話履歴)
│   ├── File System Access
│   ├── 設定管理
│   └── IPC通信
└── Renderer Process (React)
    ├── React + TypeScript
    ├── Tailwind CSS + Headless UI
    ├── React Router
    └── SWR
```

### プロジェクト構造

```
claude-chat-app/
├── src/
│   ├── main/                      # メインプロセス
│   │   ├── index.ts              # エントリーポイント
│   │   ├── config/
│   │   │   └── appConfig.ts      # 設定管理
│   │   ├── database/
│   │   │   ├── database.ts       # データベース接続
│   │   │   ├── migrator.ts       # マイグレーション
│   │   │   └── schema.sql        # スキーマ定義
│   │   ├── services/
│   │   │   ├── chatService.ts    # チャット機能
│   │   │   ├── fileService.ts    # ファイル処理
│   │   │   └── summaryService.ts # メッセージ要約
│   │   └── ipc/
│   │       └── chatHandlers.ts   # IPC通信
│   └── renderer/                  # レンダラープロセス
│       ├── components/            # UIコンポーネント
│       │   ├── Chat/
│       │   ├── Sidebar/
│       │   └── FileUpload/
│       ├── pages/                 # ページコンポーネント
│       ├── hooks/                 # カスタムフック
│       │   ├── useChat.ts
│       │   ├── useSessions.ts
│       │   └── useFiles.ts
│       ├── stores/                # 状態管理
│       ├── types/                 # TypeScript型定義
│       └── utils/                 # ユーティリティ
├── contexts/                      # プロジェクトコンテキスト
│   └── context.md
├── package.json
├── tsconfig.json
├── tsconfig.main.json
└── vite.config.ts
```

### データベース設計

#### エンティティ設計

- **セッション**: 会話のまとまり単位
- **メッセージ**: 個々の発言（ユーザー・アシスタント）
- **ファイル添付**: ファイルパスのみ管理（実体はファイル直読み）
- **プロジェクトコンテキスト**: 設定ファイルで管理（claude.md など）

#### スキーマ構造

```sql
-- 1. スキーマバージョン管理
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. セッション
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,                    -- UUID
  name TEXT NOT NULL,                     -- セッション名
  total_tokens INTEGER DEFAULT 0,         -- セッション内の合計トークン数
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. メッセージ
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,                    -- UUID
  session_id TEXT NOT NULL,               -- セッションへの外部キー
  role TEXT CHECK(role IN ('user', 'assistant', 'system')) NOT NULL,
  content TEXT NOT NULL,                  -- メッセージ本文
  file_paths TEXT,                        -- ファイルパスのJSON配列 ["path1", "path2"]
  token_count INTEGER DEFAULT 0,          -- 個別メッセージのトークン数
  is_summary BOOLEAN DEFAULT FALSE,       -- 要約メッセージかどうか
  original_message_ids TEXT,              -- 要約元のメッセージID（JSON配列）
  is_deleted BOOLEAN DEFAULT FALSE,       -- 論理削除フラグ（ファイル削除時等）
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE CASCADE
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_messages_session_created ON messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_updated ON sessions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_is_summary ON messages(is_summary);
CREATE INDEX IF NOT EXISTS idx_messages_role ON messages(role);
CREATE INDEX IF NOT EXISTS idx_messages_not_deleted ON messages(is_deleted, session_id);

-- トリガー: セッション更新時のupdated_at自動更新
CREATE TRIGGER IF NOT EXISTS update_session_timestamp 
  AFTER UPDATE ON sessions
  FOR EACH ROW
  WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- トリガー: メッセージ追加/更新時のセッション更新とトークン数集計
CREATE TRIGGER IF NOT EXISTS update_session_on_message_change
  AFTER INSERT ON messages
  FOR EACH ROW
BEGIN
  UPDATE sessions 
  SET updated_at = CURRENT_TIMESTAMP,
      total_tokens = total_tokens + NEW.token_count
  WHERE id = NEW.session_id;
END;

-- トリガー: メッセージ削除時のトークン数調整
CREATE TRIGGER IF NOT EXISTS update_session_on_message_delete
  AFTER UPDATE ON messages
  FOR EACH ROW
  WHEN NEW.is_deleted = TRUE AND OLD.is_deleted = FALSE
BEGIN
  UPDATE sessions 
  SET total_tokens = total_tokens - OLD.token_count
  WHERE id = OLD.session_id;
END;
```

#### 設計方針

- **ファイル管理**: ファイルの実体は直読み、パスのみを JSON で保存
- **論理削除**: ファイル削除時も履歴を保持し、is_deletedフラグで管理
- **トークン数管理**: メッセージ個別とセッション合計の両方でトークン数を管理
- **自動集計**: トリガーによるトークン数自動集計とタイムスタンプ更新
- **検索最適化**: 要約・ロール・削除状態での効率的な検索のためのインデックス設計
- **プロジェクトコンテキスト**: データベースに保存せず設定ファイルで管理
- **シンプル構成**: 最小限のテーブル数でメンテナンス性を重視

````

### 設定ファイル構造
```typescript
interface AppConfig {
  anthropic: {
    apiKey: string;
    model: string;
    maxTokens: number;
  };
  context: {
    filePath: string;      // context.mdのパス
    autoReload: boolean;   // 自動リロード設定
  };
  database: {
    path: string;
    maxHistoryLength: number;
  };
  ui: {
    theme: 'light' | 'dark' | 'system';
    defaultSessionName: string;
  };
}
````

### IPC 通信インターフェース

```typescript
// メインプロセス → レンダラープロセス
interface ElectronAPI {
  // チャット関連
  sendMessage: (
    sessionId: string,
    message: string,
    filePaths: string[]
  ) => Promise<string>;
  getSessions: () => Promise<Session[]>;
  createSession: (name: string) => Promise<Session>;
  deleteSession: (sessionId: string) => Promise<void>;

  // ファイル関連
  selectFiles: () => Promise<string[]>;
  validateDraggedFiles: (filePaths: string[]) => Promise<string[]>;

  // 設定関連
  getConfig: () => Promise<AppConfig>;
  setConfig: (config: Partial<AppConfig>) => Promise<void>;
}
```

### ファイル処理フロー

1. **ファイル選択**: OS 標準ダイアログまたはドラッグ&ドロップ
2. **ファイルパス取得**: レンダラープロセスでファイルパスを取得
3. **IPC 通信**: ファイルパスをメインプロセスに送信
4. **ファイル処理**: メインプロセスでファイル読み込み・変換
5. **API 送信**: Claude API に適切な形式で送信

### メッセージ要約フロー

1. **トークン数チェック**: 送信前に会話履歴のトークン数を確認
2. **要約対象選定**: 古いメッセージを要約対象として選定
3. **要約作成**: Claude API を使って要約を生成
4. **履歴更新**: 要約メッセージで古いメッセージを置換
5. **データベース更新**: 要約情報をデータベースに保存

## 実装優先順位

1. プロジェクト構造の作成
2. 設定管理システム
3. データベース初期化とマイグレーション
4. 基本的な IPC 通信
5. UI コンポーネント
6. Claude API 統合
7. ファイル処理機能
8. メッセージ要約機能
