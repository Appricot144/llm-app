-- Migration: v1_001_initial_schema
-- Description: 初期スキーマの作成
-- Created: 2025-07-02

-- 1. スキーマバージョン管理テーブル
CREATE TABLE IF NOT EXISTS schema_version (
  version TEXT PRIMARY KEY,
  applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. セッションテーブル
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,                    -- UUID
  name TEXT NOT NULL,                     -- セッション名
  total_tokens INTEGER DEFAULT 0,         -- セッション内の合計トークン数
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. メッセージテーブル
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

-- 4. インデックス作成
-- セッションIDと作成日時での検索用
CREATE INDEX IF NOT EXISTS idx_messages_session_created ON messages(session_id, created_at);

-- セッションの更新日時でのソート用
CREATE INDEX IF NOT EXISTS idx_sessions_updated ON sessions(updated_at DESC);

-- 要約メッセージの検索用
CREATE INDEX IF NOT EXISTS idx_messages_is_summary ON messages(is_summary);

-- ロール別メッセージの検索用
CREATE INDEX IF NOT EXISTS idx_messages_role ON messages(role);

-- 論理削除されていないメッセージの検索用
CREATE INDEX IF NOT EXISTS idx_messages_not_deleted ON messages(is_deleted, session_id);

-- 5. トリガー作成
-- セッション更新時のupdated_at自動更新
CREATE TRIGGER IF NOT EXISTS update_session_timestamp 
  AFTER UPDATE ON sessions
  FOR EACH ROW
  WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- メッセージ追加時のセッション更新とトークン数集計
CREATE TRIGGER IF NOT EXISTS update_session_on_message_change
  AFTER INSERT ON messages
  FOR EACH ROW
BEGIN
  UPDATE sessions 
  SET updated_at = CURRENT_TIMESTAMP,
      total_tokens = total_tokens + NEW.token_count
  WHERE id = NEW.session_id;
END;

-- メッセージ削除時のトークン数調整
CREATE TRIGGER IF NOT EXISTS update_session_on_message_delete
  AFTER UPDATE ON messages
  FOR EACH ROW
  WHEN NEW.is_deleted = TRUE AND OLD.is_deleted = FALSE
BEGIN
  UPDATE sessions 
  SET total_tokens = total_tokens - OLD.token_count
  WHERE id = OLD.session_id;
END;