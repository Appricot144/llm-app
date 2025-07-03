import { Database } from "sqlite3";
import * as sqlite3 from "sqlite3";
import * as fs from "fs";
import * as path from "path";
import { app } from "electron";
import { Migrator } from "./migrator";

/**
 * SQLiteデータベース接続を管理するシングルトンクラス
 */
export class DatabaseConnection {
  private static instance: DatabaseConnection | null = null;
  private db: Database | null = null;
  private dbPath: string;
  private migrator: Migrator | null = null;

  private constructor(dbPath?: string) {
    // デフォルトのデータベースパス
    this.dbPath = dbPath || path.join(app.getPath("userData"), "chat.db");
  }

  /**
   * シングルトンインスタンスを取得
   */
  static getInstance(dbPath?: string): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection(dbPath);
    }
    return DatabaseConnection.instance;
  }

  /**
   * データベースに接続
   */
  async connect(): Promise<void> {
    if (this.db) {
      return; // 既に接続済み
    }

    // データベースディレクトリの作成
    const dbDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
          return;
        }

        console.log(`Connected to SQLite database: ${this.dbPath}`);

        // マイグレーションの実行
        this.migrator = new Migrator(this.db!);
        this.migrator
          .migrate()
          .then(() => resolve())
          .catch(reject);
      });
    });
  }

  /**
   * データベース接続を閉じる
   */
  async close(): Promise<void> {
    if (!this.db) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.db!.close((err) => {
        if (err) {
          reject(err);
        } else {
          this.db = null;
          this.migrator = null;
          console.log("Database connection closed");
          resolve();
        }
      });
    });
  }

  /**
   * データベースインスタンスを取得
   */
  getDb(): Database {
    if (!this.db) {
      throw new Error("Database is not connected");
    }
    return this.db;
  }

  /**
   * SQLクエリを実行（INSERT, UPDATE, DELETE用）
   */
  async run(sql: string, params: any[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
      this.getDb().run(sql, params, function (err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * 単一の行を取得（SELECT用）
   */
  async get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      this.getDb().get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row as T | undefined);
        }
      });
    });
  }

  /**
   * 複数の行を取得（SELECT用）
   */
  async all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.getDb().all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows as T[]);
        }
      });
    });
  }

  /**
   * トランザクション処理
   */
  async transaction<T>(callback: () => Promise<T>): Promise<T> {
    await this.run("BEGIN");
    try {
      const result = await callback();
      await this.run("COMMIT");
      return result;
    } catch (error) {
      await this.run("ROLLBACK");
      throw error;
    }
  }

  /**
   * 開発環境用: データベースをリセット
   */
  async reset(): Promise<void> {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Database reset is not allowed in production environment");
    }

    if (!this.migrator) {
      throw new Error("Database is not connected");
    }

    await this.migrator.reset();
  }
}

// デフォルトのインスタンスをエクスポート
export const db = DatabaseConnection.getInstance();