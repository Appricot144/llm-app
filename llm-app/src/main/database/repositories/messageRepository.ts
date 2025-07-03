import { DatabaseConnection } from "../database";
import {
  MessageModel,
  CreateMessageParams,
  MessageSearchParams,
} from "../types";

/**
 * メッセージのデータアクセスクラス
 */
export class MessageRepository {
  private db: DatabaseConnection;

  constructor() {
    this.db = DatabaseConnection.getInstance();
  }

  /**
   * メッセージを作成
   */
  async create(params: CreateMessageParams): Promise<MessageModel> {
    const sql = `
      INSERT INTO messages (
        id, session_id, role, content, file_paths,
        token_count, is_summary, original_message_ids
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      params.id,
      params.session_id,
      params.role,
      params.content,
      params.file_paths ? JSON.stringify(params.file_paths) : null,
      params.token_count || 0,
      params.is_summary || false,
      params.original_message_ids ? JSON.stringify(params.original_message_ids) : null,
    ];

    await this.db.run(sql, values);

    // 作成したメッセージを取得して返す
    const created = await this.findById(params.id);
    if (!created) {
      throw new Error("Failed to create message");
    }

    return created;
  }

  /**
   * IDでメッセージを取得
   */
  async findById(id: string): Promise<MessageModel | undefined> {
    const sql = `
      SELECT * FROM messages
      WHERE id = ?
    `;

    const message = await this.db.get<MessageModel>(sql, [id]);
    
    if (message) {
      return this.parseMessage(message);
    }
    
    return undefined;
  }

  /**
   * セッションIDに属する全メッセージを取得
   */
  async findBySessionId(sessionId: string): Promise<MessageModel[]> {
    const sql = `
      SELECT * FROM messages
      WHERE session_id = ? AND is_deleted = FALSE
      ORDER BY created_at ASC
    `;

    const messages = await this.db.all<MessageModel>(sql, [sessionId]);
    return messages.map(msg => this.parseMessage(msg));
  }

  /**
   * 検索条件に基づいてメッセージを取得
   */
  async search(params: MessageSearchParams): Promise<MessageModel[]> {
    const conditions: string[] = [];
    const values: any[] = [];

    if (params.session_id !== undefined) {
      conditions.push("session_id = ?");
      values.push(params.session_id);
    }

    if (params.role !== undefined) {
      conditions.push("role = ?");
      values.push(params.role);
    }

    if (params.is_summary !== undefined) {
      conditions.push("is_summary = ?");
      values.push(params.is_summary);
    }

    if (params.is_deleted !== undefined) {
      conditions.push("is_deleted = ?");
      values.push(params.is_deleted);
    }

    let sql = "SELECT * FROM messages";
    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }
    sql += " ORDER BY created_at DESC";

    if (params.limit !== undefined) {
      sql += " LIMIT ?";
      values.push(params.limit);
    }

    if (params.offset !== undefined) {
      sql += " OFFSET ?";
      values.push(params.offset);
    }

    const messages = await this.db.all<MessageModel>(sql, values);
    return messages.map(msg => this.parseMessage(msg));
  }

  /**
   * メッセージを論理削除
   */
  async markAsDeleted(id: string): Promise<void> {
    const sql = `
      UPDATE messages
      SET is_deleted = TRUE
      WHERE id = ?
    `;

    await this.db.run(sql, [id]);
  }

  /**
   * セッションに属する全メッセージを物理削除
   */
  async deleteBySessionId(sessionId: string): Promise<void> {
    const sql = `
      DELETE FROM messages
      WHERE session_id = ?
    `;

    await this.db.run(sql, [sessionId]);
  }

  /**
   * 要約対象のメッセージを取得
   */
  async getSummaryTargets(sessionId: string, keepRecentCount: number): Promise<MessageModel[]> {
    const sql = `
      SELECT * FROM messages
      WHERE session_id = ?
        AND is_summary = FALSE
        AND is_deleted = FALSE
      ORDER BY created_at ASC
      LIMIT -1 OFFSET ?
    `;

    // 最新のkeepRecentCount件を除いた古いメッセージを取得
    const totalCount = await this.getMessageCount(sessionId);
    const offset = Math.max(0, totalCount - keepRecentCount);
    
    if (offset === 0) {
      return [];
    }

    // SQLiteでは逆の考え方で、古いメッセージを取得
    const inverseSql = `
      SELECT * FROM (
        SELECT * FROM messages
        WHERE session_id = ?
          AND is_summary = FALSE
          AND is_deleted = FALSE
        ORDER BY created_at ASC
        LIMIT ?
      )
      ORDER BY created_at ASC
    `;

    const messages = await this.db.all<MessageModel>(inverseSql, [sessionId, offset]);
    return messages.map(msg => this.parseMessage(msg));
  }

  /**
   * セッションのメッセージ数を取得
   */
  async getMessageCount(sessionId: string): Promise<number> {
    const sql = `
      SELECT COUNT(*) as count
      FROM messages
      WHERE session_id = ? AND is_deleted = FALSE
    `;

    const result = await this.db.get<{ count: number }>(sql, [sessionId]);
    return result?.count || 0;
  }

  /**
   * JSONフィールドをパースしてメッセージモデルに変換
   */
  private parseMessage(message: MessageModel): MessageModel {
    return {
      ...message,
      file_paths: message.file_paths ? JSON.parse(message.file_paths) : null,
      original_message_ids: message.original_message_ids ? JSON.parse(message.original_message_ids) : null,
    };
  }
}