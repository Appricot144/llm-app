import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { SessionRepository } from "../sessionRepository";
import { DatabaseConnection } from "../../database";
import { SessionModel, CreateSessionParams, UpdateSessionParams } from "../../types";

// DatabaseConnectionのモック
vi.mock("../../database");

describe("SessionRepository", () => {
  let repository: SessionRepository;
  let mockDb: any;

  beforeEach(() => {
    // モックの設定
    mockDb = {
      run: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue(undefined),
      all: vi.fn().mockResolvedValue([]),
      transaction: vi.fn(async (callback) => callback()),
    };

    vi.mocked(DatabaseConnection.getInstance).mockReturnValue({
      getDb: () => mockDb,
      run: mockDb.run,
      get: mockDb.get,
      all: mockDb.all,
      transaction: mockDb.transaction,
    } as any);

    repository = new SessionRepository();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("create", () => {
    it("新しいセッションを作成する", async () => {
      const params: CreateSessionParams = {
        id: "test-id-123",
        name: "Test Session",
      };

      await repository.create(params);

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO sessions"),
        [params.id, params.name]
      );
    });

    it("作成したセッションを返す", async () => {
      const params: CreateSessionParams = {
        id: "test-id-123",
        name: "Test Session",
      };

      const mockSession: SessionModel = {
        id: params.id,
        name: params.name,
        total_tokens: 0,
        created_at: "2025-07-02 10:00:00",
        updated_at: "2025-07-02 10:00:00",
      };

      mockDb.get.mockResolvedValue(mockSession);

      const result = await repository.create(params);

      expect(result).toEqual(mockSession);
      expect(mockDb.get).toHaveBeenCalledWith(
        expect.stringContaining("SELECT * FROM sessions WHERE id = ?"),
        [params.id]
      );
    });

    it("重複するIDの場合はエラーをスロー", async () => {
      const params: CreateSessionParams = {
        id: "duplicate-id",
        name: "Test Session",
      };

      mockDb.run.mockRejectedValue(new Error("UNIQUE constraint failed"));

      await expect(repository.create(params)).rejects.toThrow("UNIQUE constraint failed");
    });
  });

  describe("findById", () => {
    it("指定されたIDのセッションを取得する", async () => {
      const mockSession: SessionModel = {
        id: "test-id-123",
        name: "Test Session",
        total_tokens: 100,
        created_at: "2025-07-02 10:00:00",
        updated_at: "2025-07-02 11:00:00",
      };

      mockDb.get.mockResolvedValue(mockSession);

      const result = await repository.findById("test-id-123");

      expect(result).toEqual(mockSession);
      expect(mockDb.get).toHaveBeenCalledWith(
        expect.stringContaining("SELECT * FROM sessions WHERE id = ?"),
        ["test-id-123"]
      );
    });

    it("セッションが存在しない場合はundefinedを返す", async () => {
      mockDb.get.mockResolvedValue(undefined);

      const result = await repository.findById("non-existent-id");

      expect(result).toBeUndefined();
    });
  });

  describe("findAll", () => {
    it("全てのセッションを更新日時の降順で取得する", async () => {
      const mockSessions: SessionModel[] = [
        {
          id: "id-1",
          name: "Session 1",
          total_tokens: 100,
          created_at: "2025-07-02 10:00:00",
          updated_at: "2025-07-02 12:00:00",
        },
        {
          id: "id-2",
          name: "Session 2",
          total_tokens: 200,
          created_at: "2025-07-02 11:00:00",
          updated_at: "2025-07-02 11:30:00",
        },
      ];

      mockDb.all.mockResolvedValue(mockSessions);

      const result = await repository.findAll();

      expect(result).toEqual(mockSessions);
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining("SELECT * FROM sessions ORDER BY updated_at DESC"),
        []
      );
    });

    it("セッションが存在しない場合は空配列を返す", async () => {
      mockDb.all.mockResolvedValue([]);

      const result = await repository.findAll();

      expect(result).toEqual([]);
    });
  });

  describe("update", () => {
    it("セッション名を更新する", async () => {
      const id = "test-id-123";
      const params: UpdateSessionParams = {
        name: "Updated Session Name",
      };

      const mockUpdatedSession: SessionModel = {
        id,
        name: params.name!,
        total_tokens: 100,
        created_at: "2025-07-02 10:00:00",
        updated_at: "2025-07-02 12:00:00",
      };

      mockDb.get.mockResolvedValue(mockUpdatedSession);

      const result = await repository.update(id, params);

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE sessions SET name = ?"),
        [params.name, id]
      );
      expect(result).toEqual(mockUpdatedSession);
    });

    it("トークン数を更新する", async () => {
      const id = "test-id-123";
      const params: UpdateSessionParams = {
        total_tokens: 500,
      };

      await repository.update(id, params);

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE sessions SET total_tokens = ?"),
        [params.total_tokens, id]
      );
    });

    it("複数のフィールドを同時に更新する", async () => {
      const id = "test-id-123";
      const params: UpdateSessionParams = {
        name: "Updated Name",
        total_tokens: 300,
      };

      await repository.update(id, params);

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE sessions SET name = ?, total_tokens = ?"),
        [params.name, params.total_tokens, id]
      );
    });

    it("更新するフィールドがない場合はエラーをスロー", async () => {
      const id = "test-id-123";
      const params: UpdateSessionParams = {};

      await expect(repository.update(id, params)).rejects.toThrow(
        "No fields to update"
      );
    });

    it("存在しないセッションの更新は空の結果を返す", async () => {
      const id = "non-existent-id";
      const params: UpdateSessionParams = {
        name: "Updated Name",
      };

      mockDb.get.mockResolvedValue(undefined);

      const result = await repository.update(id, params);

      expect(result).toBeUndefined();
    });
  });

  describe("delete", () => {
    it("指定されたIDのセッションを削除する", async () => {
      const id = "test-id-123";

      await repository.delete(id);

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM sessions WHERE id = ?"),
        [id]
      );
    });

    it("関連するメッセージも一緒に削除される（CASCADE）", async () => {
      const id = "test-id-123";

      await repository.delete(id);

      // DELETE文が1回だけ呼ばれることを確認（CASCADEにより自動削除）
      expect(mockDb.run).toHaveBeenCalledTimes(1);
      expect(mockDb.run).not.toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM messages"),
        expect.any(Array)
      );
    });
  });

  describe("deleteAll", () => {
    it("全てのセッションを削除する", async () => {
      await repository.deleteAll();

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM sessions"),
        []
      );
    });
  });

  describe("updateTokenCount", () => {
    it("トークン数を加算する", async () => {
      const id = "test-id-123";
      const additionalTokens = 50;

      await repository.updateTokenCount(id, additionalTokens);

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE sessions SET total_tokens = total_tokens + ?"),
        [additionalTokens, id]
      );
    });

    it("負の値でトークン数を減算する", async () => {
      const id = "test-id-123";
      const additionalTokens = -30;

      await repository.updateTokenCount(id, additionalTokens);

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE sessions SET total_tokens = total_tokens + ?"),
        [additionalTokens, id]
      );
    });
  });
});