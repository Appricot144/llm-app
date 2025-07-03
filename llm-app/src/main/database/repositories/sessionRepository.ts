import { DatabaseConnection } from "../database";
import {
  SessionModel,
  CreateSessionParams,
  UpdateSessionParams,
} from "../types";

/**
 * セッションのデータアクセスクラス
 */
export class SessionRepository {
  private db: DatabaseConnection;

  constructor() {
    this.db = DatabaseConnection.getInstance();
  }

  /**
   * セッションを作成
   */
  async create(params: CreateSessionParams): Promise<SessionModel> {
    const sql = `
      INSERT INTO sessions (id, name)
      VALUES (?, ?)
    `;

    await this.db.run(sql, [params.id, params.name]);

    // 作成したセッションを取得して返す
    const created = await this.findById(params.id);
    if (!created) {
      throw new Error("Failed to create session");
    }

    return created;
  }

  /**
   * IDでセッションを取得
   */
  async findById(id: string): Promise<SessionModel | undefined> {
    const sql = `
      SELECT * FROM sessions
      WHERE id = ?
    `;

    return await this.db.get<SessionModel>(sql, [id]);
  }

  /**
   * 全てのセッションを取得（更新日時の降順）
   */
  async findAll(): Promise<SessionModel[]> {
    const sql = `
      SELECT * FROM sessions
      ORDER BY updated_at DESC
    `;

    return await this.db.all<SessionModel>(sql, []);
  }

  /**
   * セッションを更新
   */
  async update(
    id: string,
    params: UpdateSessionParams
  ): Promise<SessionModel | undefined> {
    const fields: string[] = [];
    const values: any[] = [];

    if (params.name !== undefined) {
      fields.push("name = ?");
      values.push(params.name);
    }

    if (params.total_tokens !== undefined) {
      fields.push("total_tokens = ?");
      values.push(params.total_tokens);
    }

    if (fields.length === 0) {
      throw new Error("No fields to update");
    }

    // updated_atの更新はトリガーで自動的に行われる
    const sql = `
      UPDATE sessions
      SET ${fields.join(", ")}
      WHERE id = ?
    `;

    values.push(id);
    await this.db.run(sql, values);

    // 更新後のセッションを取得して返す
    return await this.findById(id);
  }

  /**
   * セッションを削除
   */
  async delete(id: string): Promise<void> {
    const sql = `
      DELETE FROM sessions
      WHERE id = ?
    `;

    await this.db.run(sql, [id]);
  }

  /**
   * 全てのセッションを削除
   */
  async deleteAll(): Promise<void> {
    const sql = `
      DELETE FROM sessions
    `;

    await this.db.run(sql, []);
  }

  /**
   * トークン数を更新（加算）
   */
  async updateTokenCount(id: string, additionalTokens: number): Promise<void> {
    const sql = `
      UPDATE sessions
      SET total_tokens = total_tokens + ?
      WHERE id = ?
    `;

    await this.db.run(sql, [additionalTokens, id]);
  }
}