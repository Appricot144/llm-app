import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MessageRepository } from "../messageRepository";
import { DatabaseConnection } from "../../database";
import { MessageModel, CreateMessageParams, MessageSearchParams } from "../../types";

// DatabaseConnectionのモック
vi.mock("../../database");

describe("MessageRepository", () => {
  let repository: MessageRepository;
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

    repository = new MessageRepository();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("create", () => {
    it("新しいメッセージを作成する", async () => {
      const params: CreateMessageParams = {
        id: "msg-123",
        session_id: "session-123",
        role: "user",
        content: "Hello, Claude!",
        file_paths: ["/path/to/file1.txt", "/path/to/file2.jpg"],
        token_count: 10,
      };

      const mockMessage: MessageModel = {
        id: params.id,
        session_id: params.session_id,
        role: params.role,
        content: params.content,
        file_paths: JSON.stringify(params.file_paths),
        token_count: params.token_count!,
        is_summary: false,
        original_message_ids: null,
        is_deleted: false,
        created_at: "2025-07-02 10:00:00",
      };

      mockDb.get.mockResolvedValue(mockMessage);

      const result = await repository.create(params);

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO messages"),
        [
          params.id,
          params.session_id,
          params.role,
          params.content,
          JSON.stringify(params.file_paths),
          params.token_count,
          false,
          null,
        ]
      );

      expect(result).toEqual({
        ...mockMessage,
        file_paths: params.file_paths,
        original_message_ids: null,
      });
    });

    it("要約メッセージを作成する", async () => {
      const params: CreateMessageParams = {
        id: "msg-summary-123",
        session_id: "session-123",
        role: "assistant",
        content: "Summary of previous messages",
        token_count: 50,
        is_summary: true,
        original_message_ids: ["msg-1", "msg-2", "msg-3"],
      };

      await repository.create(params);

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO messages"),
        expect.arrayContaining([
          params.id,
          params.session_id,
          params.role,
          params.content,
          null,
          params.token_count,
          true,
          JSON.stringify(params.original_message_ids),
        ])
      );
    });

    it("ファイルパスなしのメッセージを作成する", async () => {
      const params: CreateMessageParams = {
        id: "msg-123",
        session_id: "session-123",
        role: "user",
        content: "Simple message",
      };

      await repository.create(params);

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO messages"),
        expect.arrayContaining([
          params.id,
          params.session_id,
          params.role,
          params.content,
          null,
          0,
          false,
          null,
        ])
      );
    });
  });

  describe("findById", () => {
    it("指定されたIDのメッセージを取得する", async () => {
      const mockMessage: MessageModel = {
        id: "msg-123",
        session_id: "session-123",
        role: "user",
        content: "Test message",
        file_paths: '["file1.txt"]',
        token_count: 10,
        is_summary: false,
        original_message_ids: null,
        is_deleted: false,
        created_at: "2025-07-02 10:00:00",
      };

      mockDb.get.mockResolvedValue(mockMessage);

      const result = await repository.findById("msg-123");

      expect(result).toEqual({
        ...mockMessage,
        file_paths: ["file1.txt"],
        original_message_ids: null,
      });

      expect(mockDb.get).toHaveBeenCalledWith(
        expect.stringContaining("SELECT * FROM messages WHERE id = ?"),
        ["msg-123"]
      );
    });

    it("メッセージが存在しない場合はundefinedを返す", async () => {
      mockDb.get.mockResolvedValue(undefined);

      const result = await repository.findById("non-existent");

      expect(result).toBeUndefined();
    });
  });

  describe("findBySessionId", () => {
    it("セッションIDに属する全メッセージを作成日時順で取得する", async () => {
      const mockMessages: MessageModel[] = [
        {
          id: "msg-1",
          session_id: "session-123",
          role: "user",
          content: "First message",
          file_paths: null,
          token_count: 5,
          is_summary: false,
          original_message_ids: null,
          is_deleted: false,
          created_at: "2025-07-02 10:00:00",
        },
        {
          id: "msg-2",
          session_id: "session-123",
          role: "assistant",
          content: "Response message",
          file_paths: null,
          token_count: 8,
          is_summary: false,
          original_message_ids: null,
          is_deleted: false,
          created_at: "2025-07-02 10:01:00",
        },
      ];

      mockDb.all.mockResolvedValue(mockMessages);

      const result = await repository.findBySessionId("session-123");

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("msg-1");
      expect(result[1].id).toBe("msg-2");

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining("WHERE session_id = ? AND is_deleted = FALSE"),
        ["session-123"]
      );
    });

    it("削除されたメッセージは含まない", async () => {
      mockDb.all.mockResolvedValue([]);

      await repository.findBySessionId("session-123");

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining("AND is_deleted = FALSE"),
        ["session-123"]
      );
    });
  });

  describe("search", () => {
    it("検索条件に基づいてメッセージを取得する", async () => {
      const params: MessageSearchParams = {
        session_id: "session-123",
        role: "user",
        is_summary: false,
        is_deleted: false,
        limit: 10,
        offset: 0,
      };

      await repository.search(params);

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining("WHERE session_id = ?"),
        expect.arrayContaining(["session-123", "user", false, false])
      );
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining("LIMIT ? OFFSET ?"),
        expect.arrayContaining([10, 0])
      );
    });

    it("部分的な検索条件でメッセージを取得する", async () => {
      const params: MessageSearchParams = {
        role: "assistant",
        is_summary: true,
      };

      await repository.search(params);

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining("WHERE role = ? AND is_summary = ?"),
        ["assistant", true]
      );
    });

    it("検索条件なしで全メッセージを取得する", async () => {
      const params: MessageSearchParams = {};

      await repository.search(params);

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining("SELECT * FROM messages"),
        []
      );
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.not.stringContaining("WHERE"),
        []
      );
    });
  });

  describe("markAsDeleted", () => {
    it("メッセージを論理削除する", async () => {
      const id = "msg-123";

      await repository.markAsDeleted(id);

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE messages SET is_deleted = TRUE"),
        [id]
      );
    });
  });

  describe("deleteBySessionId", () => {
    it("セッションに属する全メッセージを物理削除する", async () => {
      const sessionId = "session-123";

      await repository.deleteBySessionId(sessionId);

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM messages WHERE session_id = ?"),
        [sessionId]
      );
    });
  });

  describe("getSummaryTargets", () => {
    it("要約対象のメッセージを取得する", async () => {
      const mockMessages: MessageModel[] = [
        {
          id: "msg-1",
          session_id: "session-123",
          role: "user",
          content: "Old message 1",
          file_paths: null,
          token_count: 100,
          is_summary: false,
          original_message_ids: null,
          is_deleted: false,
          created_at: "2025-07-01 10:00:00",
        },
        {
          id: "msg-2",
          session_id: "session-123",
          role: "assistant",
          content: "Old message 2",
          file_paths: null,
          token_count: 150,
          is_summary: false,
          original_message_ids: null,
          is_deleted: false,
          created_at: "2025-07-01 10:01:00",
        },
      ];

      mockDb.all.mockResolvedValue(mockMessages);

      const result = await repository.getSummaryTargets("session-123", 5);

      expect(result).toHaveLength(2);
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining("WHERE session_id = ?"),
        expect.arrayContaining(["session-123", 5])
      );
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining("is_summary = FALSE"),
        expect.any(Array)
      );
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining("is_deleted = FALSE"),
        expect.any(Array)
      );
    });
  });

  describe("getMessageCount", () => {
    it("セッションのメッセージ数を取得する", async () => {
      mockDb.get.mockResolvedValue({ count: 10 });

      const result = await repository.getMessageCount("session-123");

      expect(result).toBe(10);
      expect(mockDb.get).toHaveBeenCalledWith(
        expect.stringContaining("SELECT COUNT(*) as count"),
        ["session-123"]
      );
    });

    it("メッセージがない場合は0を返す", async () => {
      mockDb.get.mockResolvedValue({ count: 0 });

      const result = await repository.getMessageCount("empty-session");

      expect(result).toBe(0);
    });
  });
});