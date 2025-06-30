# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

このプロジェクトは Electron ベースの Claude API クライアントアプリケーションです。React + TypeScript でフロントエンド、Node.js でメインプロセスを構築し、SQLite でデータを永続化する構成になっています。

## アーキテクチャ

### 全体構成

```
Electron アプリケーション
├── Main Process (Node.js)
│   ├── @anthropic-ai/sdk
│   ├── SQLite (会話履歴)
│   ├── File System Access
│   ├── 設定管理
│   └── IPC通信
└── Renderer Process (React)
    ├── React + TypeScript
    ├── Tailwind CSS + Headless UI
    ├── React Router
    └── SWR
```

### ディレクトリ構造（予定）

```
claude-chat-app/
├── src/
│   ├── main/                      # メインプロセス
│   │   ├── index.ts              # エントリーポイント
│   │   ├── config/
│   │   │   └── appConfig.ts      # 設定管理
│   │   ├── database/
│   │   │   ├── database.ts       # データベース接続
│   │   │   ├── migrator.ts       # マイグレーション
│   │   │   └── schema.sql        # スキーマ定義
│   │   ├── services/
│   │   │   ├── chatService.ts    # チャット機能
│   │   │   ├── fileService.ts    # ファイル処理
│   │   │   └── summaryService.ts # メッセージ要約
│   │   └── ipc/
│   │       └── chatHandlers.ts   # IPC通信
│   └── renderer/                  # レンダラープロセス
│       ├── components/            # UIコンポーネント
│       ├── pages/                 # ページコンポーネント
│       ├── hooks/                 # カスタムフック
│       ├── stores/                # 状態管理
│       ├── types/                 # TypeScript型定義
│       └── utils/                 # ユーティリティ
├── contexts/                      # プロジェクトコンテキスト
│   └── context.md
├── package.json
├── tsconfig.json
├── tsconfig.main.json
└── vite.config.ts
```

## 主要機能

### 1. Claude API 統合

- Anthropic Messages API を使用したチャット機能
- マルチモーダル対応（テキスト + 画像）
- トークン制限対策のための会話要約機能

### 2. セッション管理

- SQLite を使用した会話履歴の永続化
- セッション作成・切り替え・削除機能
- 検索とフィルタリング

### 3. ファイル処理

- 複数ファイルの選択・添付
- ドラッグ&ドロップ対応
- 画像ファイルの base64 エンコード
- テキストファイルのコードブロック形式での送信

### 4. プロジェクトコンテキスト

- context.md の自動読み込み
- 設定可能なファイルパス
- 毎回の API 呼び出し時に最新内容を取得

## 技術スタック

### フレームワーク・ライブラリ

- **Electron**: デスクトップアプリケーション
- **React 18**: UI フレームワーク
- **TypeScript**: 型安全な開発
- **SQLite3**: ローカルデータベース
- **@anthropic-ai/sdk**: Claude API クライアント

### UI/UX

- **React Router v6**: ルーティング
- **SWR**: データ取得とキャッシュ
- **Tailwind CSS**: スタイリング
- **Headless UI**: アクセシブルな UI コンポーネント
- **Phosphor Icons**: アイコンライブラリ

### 開発ツール

- **Vite**: レンダラープロセスのビルドツール
- **TypeScript Compiler**: メインプロセスのビルド
- **concurrently**: 開発サーバーの並行実行

## データベース設計

### 主要テーブル

- **sessions**: チャットセッション管理
- **messages**: メッセージ履歴（role, content, file_paths を JSON 形式で保存）
- **schema_version**: データベースマイグレーション管理

### 重要な設計原則

- ファイルはパス参照で管理（IPC の制限による）
- トークン数の記録で要約機能をサポート
- 外部キー制約でデータ整合性を保証

## セキュリティ考慮事項

### API キー管理

- API キーはメインプロセスのみで扱う
- レンダラープロセスには渡さない
- 設定ファイルは `app.getPath('userData')` に保存

### ファイル処理

- ファイルパス経由でのアクセスのみ
- 適切なバリデーションの実装
- セキュリティ上の制限の考慮

## 開発時の注意点

### IPC 通信

- ファイルオブジェクトは直接渡せないため、ファイルパスで受け渡し
- メインプロセスでファイル読み込み・変換を実行
- エラーハンドリングを適切に実装

### パフォーマンス最適化

- 大量のセッション・メッセージに対する仮想スクロール
- 古いセッションの遅延読み込み
- ファイルキャッシュの実装

### UI 設計

- 3 ペイン構成（チャットセッション、メイン、ファイル管理）
- 折りたたみ・リサイズ対応
- レスポンシブデザイン

## 実装優先順位

1. プロジェクト構造の作成とセットアップ
2. 設定管理システムの実装
3. データベース初期化とマイグレーション機能
4. 基本的な IPC 通信の確立
5. UI コンポーネントの実装
6. Claude API 統合
7. ファイル処理機能
8. メッセージ要約機能

## 開発開始時の準備

このプロジェクトはまだ実装開始前の状態です。開発を始める際は：

1. 必要な依存関係のインストール
2. TypeScript 設定ファイルの作成
3. Electron + Vite の設定
4. 基本的なプロジェクト構造の構築

から始めてください。

## Documentation

- **claude_chat_app_design.md** アプリケーション仕様と技術構成が記載されている。
- **claude_chat_app_spec.md** アプリケーションの設定ファイルに関する仕様が記載されている。
- **ui_layout_options.md** UI レイアウトが記載されている。
