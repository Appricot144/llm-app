/**
 * データベース関連の型定義
 */

/**
 * セッションのデータベースモデル
 */
export interface SessionModel {
  id: string;
  name: string;
  total_tokens: number;
  created_at: string;
  updated_at: string;
}

/**
 * メッセージのデータベースモデル
 */
export interface MessageModel {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  file_paths: string | null;  // JSON文字列
  token_count: number;
  is_summary: boolean;
  original_message_ids: string | null;  // JSON文字列
  is_deleted: boolean;
  created_at: string;
}

/**
 * セッション作成パラメータ
 */
export interface CreateSessionParams {
  id: string;
  name: string;
}

/**
 * メッセージ作成パラメータ
 */
export interface CreateMessageParams {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  file_paths?: string[];
  token_count?: number;
  is_summary?: boolean;
  original_message_ids?: string[];
}

/**
 * セッション更新パラメータ
 */
export interface UpdateSessionParams {
  name?: string;
  total_tokens?: number;
}

/**
 * メッセージ検索条件
 */
export interface MessageSearchParams {
  session_id?: string;
  role?: "user" | "assistant" | "system";
  is_summary?: boolean;
  is_deleted?: boolean;
  limit?: number;
  offset?: number;
}