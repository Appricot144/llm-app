import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as sqlite3 from "sqlite3";
import * as fs from "fs";
import * as path from "path";
import { DatabaseConnection } from "../database";
import { Migrator } from "../migrator";

// モックの設定
vi.mock("sqlite3");
vi.mock("fs");
vi.mock("../migrator");

describe("DatabaseConnection", () => {
  let mockDatabase: any;
  let mockMigrator: any;

  beforeEach(() => {
    // SQLiteデータベースのモック
    mockDatabase = {
      run: vi.fn((sql: string, params: any, callback?: any) => {
        if (typeof params === "function") {
          callback = params;
          params = [];
        }
        if (callback) callback(null);
        return mockDatabase;
      }),
      get: vi.fn((sql: string, params: any, callback?: any) => {
        if (typeof params === "function") {
          callback = params;
          params = [];
        }
        if (callback) callback(null, null);
        return mockDatabase;
      }),
      all: vi.fn((sql: string, params: any, callback?: any) => {
        if (typeof params === "function") {
          callback = params;
          params = [];
        }
        if (callback) callback(null, []);
        return mockDatabase;
      }),
      close: vi.fn((callback?: any) => {
        if (callback) callback(null);
      }),
      serialize: vi.fn((callback: any) => {
        callback();
      }),
    };

    // sqlite3.Databaseコンストラクタのモック
    vi.mocked(sqlite3.Database).mockImplementation((filename: string, callback?: any) => {
      if (callback) callback(null);
      return mockDatabase;
    });

    // Migratorのモック
    mockMigrator = {
      migrate: vi.fn().mockResolvedValue(undefined),
      reset: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(Migrator).mockImplementation(() => mockMigrator);

    // ファイルシステムのモック
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.mkdirSync).mockReturnValue(undefined as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
    // シングルトンインスタンスをリセット
    (DatabaseConnection as any).instance = null;
  });

  describe("getInstance", () => {
    it("シングルトンインスタンスを返す", () => {
      const instance1 = DatabaseConnection.getInstance();
      const instance2 = DatabaseConnection.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it("デフォルトのデータベースパスを使用する", () => {
      const instance = DatabaseConnection.getInstance();
      
      expect(sqlite3.Database).toHaveBeenCalledWith(
        expect.stringContaining("chat.db"),
        expect.any(Function)
      );
    });

    it("カスタムデータベースパスを使用できる", () => {
      const customPath = "/custom/path/test.db";
      const instance = DatabaseConnection.getInstance(customPath);
      
      expect(sqlite3.Database).toHaveBeenCalledWith(
        customPath,
        expect.any(Function)
      );
    });
  });

  describe("connect", () => {
    it("データベースに接続してマイグレーションを実行する", async () => {
      const instance = DatabaseConnection.getInstance();
      await instance.connect();

      expect(mockMigrator.migrate).toHaveBeenCalled();
    });

    it("データベースディレクトリが存在しない場合は作成する", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const instance = DatabaseConnection.getInstance();
      await instance.connect();

      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.any(String),
        { recursive: true }
      );
    });

    it("接続エラー時は例外をスロー", async () => {
      vi.mocked(sqlite3.Database).mockImplementation((filename: string, callback?: any) => {
        if (callback) callback(new Error("Connection failed"));
        return mockDatabase;
      });

      const instance = DatabaseConnection.getInstance();
      await expect(instance.connect()).rejects.toThrow("Connection failed");
    });

    it("既に接続されている場合は何もしない", async () => {
      const instance = DatabaseConnection.getInstance();
      await instance.connect();
      
      vi.clearAllMocks();
      
      await instance.connect();
      expect(sqlite3.Database).not.toHaveBeenCalled();
    });
  });

  describe("close", () => {
    it("データベース接続を閉じる", async () => {
      const instance = DatabaseConnection.getInstance();
      await instance.connect();
      await instance.close();

      expect(mockDatabase.close).toHaveBeenCalled();
    });

    it("接続されていない場合は何もしない", async () => {
      const instance = DatabaseConnection.getInstance();
      await instance.close();

      expect(mockDatabase.close).not.toHaveBeenCalled();
    });
  });

  describe("getDb", () => {
    it("接続されている場合はデータベースインスタンスを返す", async () => {
      const instance = DatabaseConnection.getInstance();
      await instance.connect();
      
      const db = instance.getDb();
      expect(db).toBe(mockDatabase);
    });

    it("接続されていない場合は例外をスロー", () => {
      const instance = DatabaseConnection.getInstance();
      
      expect(() => instance.getDb()).toThrow("Database is not connected");
    });
  });

  describe("run", () => {
    it("SQLクエリを実行する", async () => {
      const instance = DatabaseConnection.getInstance();
      await instance.connect();

      const sql = "INSERT INTO test (name) VALUES (?)";
      const params = ["test"];
      
      await instance.run(sql, params);

      expect(mockDatabase.run).toHaveBeenCalledWith(
        sql,
        params,
        expect.any(Function)
      );
    });

    it("パラメータなしでSQLクエリを実行する", async () => {
      const instance = DatabaseConnection.getInstance();
      await instance.connect();

      const sql = "DELETE FROM test";
      
      await instance.run(sql);

      expect(mockDatabase.run).toHaveBeenCalledWith(
        sql,
        [],
        expect.any(Function)
      );
    });

    it("エラー時は例外をスロー", async () => {
      mockDatabase.run.mockImplementation((sql: string, params: any, callback: any) => {
        callback(new Error("SQL error"));
      });

      const instance = DatabaseConnection.getInstance();
      await instance.connect();

      await expect(instance.run("INSERT INTO test VALUES (?)")).rejects.toThrow("SQL error");
    });
  });

  describe("get", () => {
    it("単一の行を取得する", async () => {
      const mockRow = { id: 1, name: "test" };
      mockDatabase.get.mockImplementation((sql: string, params: any, callback: any) => {
        if (typeof params === "function") {
          callback = params;
          params = [];
        }
        callback(null, mockRow);
      });

      const instance = DatabaseConnection.getInstance();
      await instance.connect();

      const result = await instance.get("SELECT * FROM test WHERE id = ?", [1]);
      expect(result).toEqual(mockRow);
    });

    it("結果がない場合はundefinedを返す", async () => {
      const instance = DatabaseConnection.getInstance();
      await instance.connect();

      const result = await instance.get("SELECT * FROM test WHERE id = ?", [999]);
      expect(result).toBeUndefined();
    });
  });

  describe("all", () => {
    it("複数の行を取得する", async () => {
      const mockRows = [
        { id: 1, name: "test1" },
        { id: 2, name: "test2" },
      ];
      mockDatabase.all.mockImplementation((sql: string, params: any, callback: any) => {
        if (typeof params === "function") {
          callback = params;
          params = [];
        }
        callback(null, mockRows);
      });

      const instance = DatabaseConnection.getInstance();
      await instance.connect();

      const result = await instance.all("SELECT * FROM test");
      expect(result).toEqual(mockRows);
    });

    it("結果がない場合は空配列を返す", async () => {
      const instance = DatabaseConnection.getInstance();
      await instance.connect();

      const result = await instance.all("SELECT * FROM test WHERE id > ?", [999]);
      expect(result).toEqual([]);
    });
  });

  describe("reset", () => {
    it("開発環境でデータベースをリセットする", async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      const instance = DatabaseConnection.getInstance();
      await instance.connect();
      await instance.reset();

      expect(mockMigrator.reset).toHaveBeenCalled();

      process.env.NODE_ENV = originalEnv;
    });

    it("本番環境ではリセットを拒否する", async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      const instance = DatabaseConnection.getInstance();
      await instance.connect();

      await expect(instance.reset()).rejects.toThrow(
        "Database reset is not allowed in production environment"
      );

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe("transaction", () => {
    it("トランザクション内で操作を実行する", async () => {
      const instance = DatabaseConnection.getInstance();
      await instance.connect();

      const callback = vi.fn().mockResolvedValue("result");
      const result = await instance.transaction(callback);

      expect(mockDatabase.run).toHaveBeenCalledWith("BEGIN", expect.any(Function));
      expect(callback).toHaveBeenCalled();
      expect(mockDatabase.run).toHaveBeenCalledWith("COMMIT", expect.any(Function));
      expect(result).toBe("result");
    });

    it("エラー時はロールバックする", async () => {
      const instance = DatabaseConnection.getInstance();
      await instance.connect();

      const callback = vi.fn().mockRejectedValue(new Error("Transaction error"));

      await expect(instance.transaction(callback)).rejects.toThrow("Transaction error");

      expect(mockDatabase.run).toHaveBeenCalledWith("BEGIN", expect.any(Function));
      expect(mockDatabase.run).toHaveBeenCalledWith("ROLLBACK", expect.any(Function));
      expect(mockDatabase.run).not.toHaveBeenCalledWith("COMMIT", expect.any(Function));
    });
  });
});