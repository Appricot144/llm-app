# Claude Chat App 設計書

## 機能

### 必要な機能
1. **Claude API リクエストの作成**
   - Anthropic Messages APIを使用した会話機能
   - マルチモーダル対応（テキスト + 画像）

2. **会話の履歴管理**
   - セッション単位での会話管理
   - SQLiteでの永続化
   - セッション作成・切り替え・削除

3. **ユーザが選択したファイルをリクエストに含める機能**
   - 複数ファイルの選択・添付
   - 画像ファイル（base64エンコード）
   - テキストファイル（コードブロック形式）

4. **常に読み込むファイル（context.md）をプロンプトに組み込む機能**
   - プロジェクトコンテキストの自動読み込み
   - 設定可能なファイルパス

## 機能の実装方針

### 1. 認証情報管理
- **方針**: API keyなどの認証情報はアプリケーションのプロパティファイル（JSON）に保存
- **保存場所**: `app.getPath('userData')/config.json`
- **セキュリティ**: メインプロセスのみでAPI keyを扱い、レンダラープロセスには渡さない

### 2. ファイル受け渡し
- **方針**: レンダラー→メインプロセスへのファイル受け渡しはファイルパスで渡す
- **理由**: IPCでFileオブジェクトを直接渡せないため、効率的なファイルパス方式を採用

### 3. ファイル参照方式
- **方針**: ユーザが選択したファイルはパス参照で管理
- **実装**: データベースにファイルパスをJSON配列で保存

### 4. Context.md読み込み
- **方針**: メッセージ送信時にcontext.mdを読み込み
- **設定**: context.mdの保存先をアプリケーションプロパティで管理
- **タイミング**: 毎回のAPI呼び出し時に最新内容を読み込み

### 5. トークン制限対策
- **方針**: 古いメッセージを要約してコンテキスト制限内に収める
- **実装**: Claude APIを使って過去の会話を要約し、要約メッセージとして保持

### 6. エラーハンドリング
- **方針**: API呼び出しエラーは400番台でユーザーに通知
- **実装**: try-catchでエラーを捕捉し、ステータスコードに応じた適切なメッセージを表示

### 7. ファイル選択UI
- **方針**: OS標準ダイアログとドラッグ&ドロップの両方に対応
- **実装**: `dialog.showOpenDialog()`とドラッグ&ドロップイベントの両方を実装

### 8. データベースマイグレーション
- **方針**: スキーマを変更した際は、patchを当ててマイグレーション
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
- **UIコンポーネント**: Headless UI
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

#### スキーマ構造
```sql
-- バージョン管理
CREATE TABLE schema_version (
  version INTEGER PRIMARY KEY
);

-- セッション
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- メッセージ
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT CHECK(role IN ('user', 'assistant', 'system')) NOT NULL,
  content TEXT NOT NULL,
  file_paths TEXT,           -- JSON array of file paths
  token_count INTEGER DEFAULT 0,
  is_summary BOOLEAN DEFAULT FALSE,
  original_message_ids TEXT, -- 要約時の元メッセージID
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE CASCADE
);

-- インデックス
CREATE INDEX idx_messages_session_created ON messages(session_id, created_at);
```

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
```

### IPC通信インターフェース
```typescript
// メインプロセス → レンダラープロセス
interface ElectronAPI {
  // チャット関連
  sendMessage: (sessionId: string, message: string, filePaths: string[]) => Promise<string>;
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
1. **ファイル選択**: OS標準ダイアログまたはドラッグ&ドロップ
2. **ファイルパス取得**: レンダラープロセスでファイルパスを取得
3. **IPC通信**: ファイルパスをメインプロセスに送信
4. **ファイル処理**: メインプロセスでファイル読み込み・変換
5. **API送信**: Claude APIに適切な形式で送信

### メッセージ要約フロー
1. **トークン数チェック**: 送信前に会話履歴のトークン数を確認
2. **要約対象選定**: 古いメッセージを要約対象として選定
3. **要約作成**: Claude APIを使って要約を生成
4. **履歴更新**: 要約メッセージで古いメッセージを置換
5. **データベース更新**: 要約情報をデータベースに保存

## 実装優先順位
1. プロジェクト構造の作成
2. 設定管理システム
3. データベース初期化とマイグレーション
4. 基本的なIPC通信
5. UIコンポーネント
6. Claude API統合
7. ファイル処理機能
8. メッセージ要約機能