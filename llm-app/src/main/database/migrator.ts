import { Database } from "sqlite3";
import * as fs from "fs";
import * as path from "path";

export interface Migration {
  version: string;
  filename: string;
  content: string;
}

export class Migrator {
  private migrationsPath: string;

  constructor(private db: Database) {
    this.migrationsPath = path.join(__dirname, "migrations");
  }

  /**
   * 現在のデータベースバージョンを取得
   */
  async getCurrentVersion(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.db.get(
        "SELECT version FROM schema_version ORDER BY applied_at DESC LIMIT 1",
        (err, row: any) => {
          if (err) {
            // テーブルが存在しない場合は空文字を返す
            if (err.message.includes("no such table")) {
              resolve("");
            } else {
              reject(err);
            }
          } else {
            resolve(row?.version || "");
          }
        }
      );
    });
  }

  /**
   * マイグレーションファイルを読み込み
   */
  async loadMigrations(): Promise<Migration[]> {
    if (!fs.existsSync(this.migrationsPath)) {
      return [];
    }

    const files = fs.readdirSync(this.migrationsPath);
    const migrations: Migration[] = [];

    for (const filename of files) {
      // v1_001_description.sql形式のファイルのみを対象
      const match = filename.match(/^(v\d+_\d+)_.*\.sql$/);
      if (match) {
        const version = match[1];
        const filepath = path.join(this.migrationsPath, filename);
        const content = fs.readFileSync(filepath, "utf-8");

        migrations.push({
          version,
          filename,
          content,
        });
      }
    }

    // バージョン順にソート
    migrations.sort((a, b) => a.version.localeCompare(b.version));

    return migrations;
  }

  /**
   * マイグレーションを実行
   */
  async migrate(): Promise<void> {
    try {
      const currentVersion = await this.getCurrentVersion();
      const migrations = await this.loadMigrations();

      console.log(`Current database version: ${currentVersion || "none"}`);

      // 未適用のマイグレーションをフィルタ
      const pendingMigrations = currentVersion
        ? migrations.filter((m) => m.version > currentVersion)
        : migrations;

      if (pendingMigrations.length === 0) {
        console.log("Database is up to date");
        return;
      }

      console.log(`Found ${pendingMigrations.length} pending migrations`);

      // マイグレーションを順次実行
      for (const migration of pendingMigrations) {
        await this.executeMigration(migration);
      }

      console.log("All migrations completed successfully");
    } catch (error) {
      console.error("Migration failed:", error);
      throw error;
    }
  }

  /**
   * 単一のマイグレーションを実行
   */
  private async executeMigration(migration: Migration): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`Executing migration: ${migration.filename}`);

      // トランザクション開始
      this.db.run("BEGIN TRANSACTION", (err) => {
        if (err) {
          reject(new Error(`Failed to start transaction: ${err.message}`));
          return;
        }

        // マイグレーションSQL実行
        this.db.run(migration.content, (err) => {
          if (err) {
            // ロールバック
            this.db.run("ROLLBACK", () => {
              reject(new Error(`Migration ${migration.version} failed: ${err.message}`));
            });
            return;
          }

          // バージョン更新
          this.db.run(
            "INSERT OR REPLACE INTO schema_version (version) VALUES (?)",
            [migration.version],
            (err) => {
              if (err) {
                // ロールバック
                this.db.run("ROLLBACK", () => {
                  reject(new Error(`Failed to update version: ${err.message}`));
                });
                return;
              }

              // コミット
              this.db.run("COMMIT", (err) => {
                if (err) {
                  reject(new Error(`Failed to commit transaction: ${err.message}`));
                } else {
                  console.log(`Migration ${migration.version} completed`);
                  resolve();
                }
              });
            }
          );
        });
      });
    });
  }

  /**
   * 開発環境用: データベースをリセット
   */
  async reset(): Promise<void> {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Database reset is not allowed in production environment");
    }

    console.log("Resetting database...");

    // 全テーブルを削除
    const dropTables = [
      "DROP TABLE IF EXISTS messages",
      "DROP TABLE IF EXISTS sessions",
      "DROP TABLE IF EXISTS schema_version",
    ];

    for (const sql of dropTables) {
      await new Promise<void>((resolve, reject) => {
        this.db.run(sql, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    console.log("All tables dropped. Running migrations...");

    // マイグレーションを再実行
    await this.migrate();
  }
}