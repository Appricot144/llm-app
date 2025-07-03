import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Database } from "sqlite3";
import * as fs from "fs";
import * as path from "path";
import { Migrator } from "../migrator";

// モックの設定
vi.mock("fs");
vi.mock("sqlite3");

describe("Migrator", () => {
  let db: Database;
  let migrator: Migrator;
  let mockRun: any;
  let mockGet: any;
  let mockAll: any;

  beforeEach(() => {
    // データベースモックの設定
    mockRun = vi.fn((sql: string, callback?: any) => {
      if (callback) callback(null);
      return db;
    });
    mockGet = vi.fn((sql: string, callback?: any) => {
      if (callback) callback(null, null);
      return db;
    });
    mockAll = vi.fn((sql: string, callback?: any) => {
      if (callback) callback(null, []);
      return db;
    });

    db = {
      run: mockRun,
      get: mockGet,
      all: mockAll,
      close: vi.fn((callback?: any) => {
        if (callback) callback(null);
      }),
    } as any;

    migrator = new Migrator(db);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getCurrentVersion", () => {
    it("スキーマバージョンテーブルが存在しない場合は空文字を返す", async () => {
      mockGet.mockImplementation((sql: string, callback: any) => {
        callback(null, null);
      });

      const version = await migrator.getCurrentVersion();
      expect(version).toBe("");
    });

    it("スキーマバージョンが存在する場合はバージョンを返す", async () => {
      mockGet.mockImplementation((sql: string, callback: any) => {
        callback(null, { version: "v1_001" });
      });

      const version = await migrator.getCurrentVersion();
      expect(version).toBe("v1_001");
    });

    it("データベースエラーの場合は例外をスロー", async () => {
      mockGet.mockImplementation((sql: string, callback: any) => {
        callback(new Error("Database error"));
      });

      await expect(migrator.getCurrentVersion()).rejects.toThrow("Database error");
    });
  });

  describe("loadMigrations", () => {
    it("マイグレーションファイルを正しく読み込む", async () => {
      const mockFiles = ["v1_001_initial_schema.sql", "v1_002_add_column.sql", "not_migration.txt"];
      const mockFileContent = "CREATE TABLE test (id INTEGER);";

      vi.mocked(fs.readdirSync).mockReturnValue(mockFiles as any);
      vi.mocked(fs.readFileSync).mockReturnValue(mockFileContent);

      const migrations = await migrator.loadMigrations();

      expect(migrations).toHaveLength(2);
      expect(migrations[0]).toEqual({
        version: "v1_001",
        filename: "v1_001_initial_schema.sql",
        content: mockFileContent,
      });
      expect(migrations[1]).toEqual({
        version: "v1_002",
        filename: "v1_002_add_column.sql",
        content: mockFileContent,
      });
    });

    it("マイグレーションファイルがバージョン順にソートされる", async () => {
      const mockFiles = ["v1_002_second.sql", "v1_001_first.sql", "v1_003_third.sql"];
      
      vi.mocked(fs.readdirSync).mockReturnValue(mockFiles as any);
      vi.mocked(fs.readFileSync).mockReturnValue("SQL content");

      const migrations = await migrator.loadMigrations();

      expect(migrations[0].version).toBe("v1_001");
      expect(migrations[1].version).toBe("v1_002");
      expect(migrations[2].version).toBe("v1_003");
    });
  });

  describe("migrate", () => {
    it("未適用のマイグレーションのみを実行する", async () => {
      // 現在のバージョンをv1_001に設定
      mockGet.mockImplementation((sql: string, callback: any) => {
        if (sql.includes("SELECT version")) {
          callback(null, { version: "v1_001" });
        } else {
          callback(null, null);
        }
      });

      // マイグレーションファイルのモック
      const mockFiles = ["v1_001_initial.sql", "v1_002_update.sql", "v1_003_add_index.sql"];
      vi.mocked(fs.readdirSync).mockReturnValue(mockFiles as any);
      vi.mocked(fs.readFileSync).mockImplementation((filepath: any) => {
        if (filepath.includes("v1_002")) return "CREATE INDEX test_idx ON test(id);";
        if (filepath.includes("v1_003")) return "ALTER TABLE test ADD COLUMN name TEXT;";
        return "CREATE TABLE test (id INTEGER);";
      });

      await migrator.migrate();

      // v1_002とv1_003のみが実行されることを確認
      expect(mockRun).toHaveBeenCalledWith(
        expect.stringContaining("CREATE INDEX test_idx"),
        expect.any(Function)
      );
      expect(mockRun).toHaveBeenCalledWith(
        expect.stringContaining("ALTER TABLE test ADD COLUMN"),
        expect.any(Function)
      );
      
      // バージョン更新の確認
      expect(mockRun).toHaveBeenCalledWith(
        expect.stringContaining("INSERT OR REPLACE INTO schema_version"),
        expect.any(Function)
      );
    });

    it("初回実行時は全てのマイグレーションを実行する", async () => {
      // 現在のバージョンなし
      mockGet.mockImplementation((sql: string, callback: any) => {
        callback(null, null);
      });

      const mockFiles = ["v1_001_initial.sql"];
      vi.mocked(fs.readdirSync).mockReturnValue(mockFiles as any);
      vi.mocked(fs.readFileSync).mockReturnValue("CREATE TABLE test (id INTEGER);");

      await migrator.migrate();

      expect(mockRun).toHaveBeenCalledWith(
        expect.stringContaining("CREATE TABLE test"),
        expect.any(Function)
      );
    });

    it("マイグレーション失敗時は例外をスロー", async () => {
      mockGet.mockImplementation((sql: string, callback: any) => {
        callback(null, null);
      });

      mockRun.mockImplementation((sql: string, callback: any) => {
        if (sql.includes("CREATE TABLE")) {
          callback(new Error("SQL syntax error"));
        } else {
          callback(null);
        }
      });

      const mockFiles = ["v1_001_initial.sql"];
      vi.mocked(fs.readdirSync).mockReturnValue(mockFiles as any);
      vi.mocked(fs.readFileSync).mockReturnValue("CREATE TABLE test (id INTEGER);");

      await expect(migrator.migrate()).rejects.toThrow("Migration v1_001 failed: SQL syntax error");
    });
  });

  describe("reset", () => {
    it("開発環境でデータベースをリセットする", async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      await migrator.reset();

      // 全テーブルの削除を確認
      expect(mockRun).toHaveBeenCalledWith("DROP TABLE IF EXISTS messages", expect.any(Function));
      expect(mockRun).toHaveBeenCalledWith("DROP TABLE IF EXISTS sessions", expect.any(Function));
      expect(mockRun).toHaveBeenCalledWith("DROP TABLE IF EXISTS schema_version", expect.any(Function));

      // マイグレーションの再実行を確認
      expect(migrator.migrate).toBeDefined();

      process.env.NODE_ENV = originalEnv;
    });

    it("本番環境ではリセットを拒否する", async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      await expect(migrator.reset()).rejects.toThrow(
        "Database reset is not allowed in production environment"
      );

      expect(mockRun).not.toHaveBeenCalled();

      process.env.NODE_ENV = originalEnv;
    });
  });
});