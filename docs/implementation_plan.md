# Claude APIクライアント実装計画書

## プロジェクト概要

本プロジェクトは、Electron + React + TypeScript を用いたClaude APIクライアントアプリケーションの実装計画書です。
3ペイン構成のUIでチャット機能、ファイル管理、セッション管理を提供し、SQLiteによるデータ永続化を行います。

## 実装方針

- **TDD（Test Driven Development）**: t-wadaのテスト駆動開発手法に従い、テスト先行で実装
- **段階的実装**: 1コンポーネント/機能ずつ完成させる
- **最大5関数単位**: 内部処理は最大5関数を目安として実装
- **UI優先**: 画面実装はコンポーネント単位で進行

---

## フェーズ1: データベース層実装 🎯

### TASK1: データベース設計・スキーマ定義
**優先度**: 高 | **TDD**: 適用

#### SUBTASK1-1: スキーマ設計の検討・決定
- 既存のCLAUDE.mdスキーマ設計の確認・見直し
- ファイル情報の保存方法決定（別テーブル vs JSONフィールド）
- 外部キー制約・インデックス設計

#### SUBTASK1-2: SQLスキーマファイル作成
- `src/main/database/schema.sql` ファイル作成
- sessions, messages, schema_version テーブル定義
- 初期データ・制約条件の設定

#### SUBTASK1-3: マイグレーション設計
- バージョン管理方式の決定
- マイグレーション実行ロジックの設計
- ロールバック機能の検討

### TASK2: データベース接続・基盤実装
**優先度**: 高 | **TDD**: 適用

#### SUBTASK2-1: SQLiteデータベース接続クラス（TDD）
- `src/main/database/database.ts` 実装
- テストケース先行作成
- 接続・切断・エラーハンドリング実装

#### SUBTASK2-2: マイグレーション機能実装
- `src/main/database/migrator.ts` 実装
- バージョン管理・実行機能
- テストケース作成

#### SUBTASK2-3: 基本的なCRUD操作テスト
- データベース操作の基本テスト作成
- パフォーマンステスト
- エラーケーステスト

### TASK3: データアクセス層実装
**優先度**: 高 | **TDD**: 適用

#### SUBTASK3-1: SessionRepository実装（TDD）
- `src/main/database/repositories/sessionRepository.ts` 作成
- CRUD操作（作成・取得・更新・削除）
- テストケース先行作成

#### SUBTASK3-2: MessageRepository実装（TDD）
- `src/main/database/repositories/messageRepository.ts` 作成
- メッセージの保存・取得・ページネーション
- ファイル情報の関連付け処理

#### SUBTASK3-3: エラーハンドリング・バリデーション
- データベース例外処理
- 入力値検証機能
- ログ出力機能

---

## フェーズ2: 基本画面UI実装（構造・見た目のみ） 🎨

### TASK4: 既存コンポーネント削除・クリーンアップ
**優先度**: 中 | **TDD**: 部分適用

#### SUBTASK4-1: ConfigModal.tsx削除
- `src/renderer/components/ConfigModal.tsx` 削除
- 関連するimport・state削除

#### SUBTASK4-2: ChatInterface.tsx削除
- `src/renderer/components/ChatInterface.tsx` 削除
- 関連するimport・state削除

#### SUBTASK4-3: App.tsx関連コード削除
- ConfigModal・ChatInterface関連コードの削除
- 不要なstate・関数の削除

### TASK5: 新規UIコンポーネント作成
**優先度**: 中 | **TDD**: 適用

#### SUBTASK5-1: Headerコンポーネント作成
- `src/renderer/components/Header.tsx` 作成
- 固定高さ60px、APIキー状態表示機能
- 設定ボタン・エラー表示エリア実装

#### SUBTASK5-2: LeftSidebarコンポーネント作成
- `src/renderer/components/LeftSidebar.tsx` 作成
- セッション一覧表示の基本構造
- 新規セッション作成ボタン

#### SUBTASK5-3: RightSidebarコンポーネント作成
- `src/renderer/components/RightSidebar.tsx` 作成
- ファイルアップロードエリアの基本構造
- ファイル一覧表示領域

#### SUBTASK5-4: CenterAreaコンポーネント作成
- `src/renderer/components/CenterArea.tsx` 作成
- メッセージ表示エリアの基本構造
- メッセージ入力フォーム

#### SUBTASK5-5: MainLayoutコンポーネント作成
- `src/renderer/components/MainLayout.tsx` 作成
- 3ペイン配置の実装
- 基本的なレスポンシブ対応

### TASK6: 基本レイアウト統合
**優先度**: 中 | **TDD**: 部分適用

#### SUBTASK6-1: App.tsxでのMainLayout統合
- App.tsxでのMainLayout統合
- 基本的なprops渡し実装

#### SUBTASK6-2: 基本的なスタイリング適用
- Tailwind CSSでの基本スタイル
- UI仕様書に基づくレイアウト調整

---

## フェーズ3: リクエスト処理機能の永続化対応 📡

### TASK7: ChatServiceの永続化対応
**優先度**: 高 | **TDD**: 適用
- 既存ChatServiceにデータベース連携機能追加
- セッション管理の永続化実装
- メッセージ履歴保存・読み込み機能

### TASK8: UI側での永続化連携
**優先度**: 高 | **TDD**: 適用
- CenterAreaでのメッセージ表示機能
- LeftSidebarでのセッション一覧表示
- リアルタイム更新機能

### TASK9: メッセージ送受信機能統合
**優先度**: 高 | **TDD**: 適用
- メッセージ入力・送信機能
- Claude APIレスポンス受信・表示
- 永続化処理との統合

---

## フェーズ4: ファイル機能実装・バグ修正 📎

### TASK10: ファイル処理基盤実装
**優先度**: 中 | **TDD**: 適用
- ファイル選択機能（テスト先行）
- ファイル読み込み・変換機能
- ファイル情報の永続化

### TASK11: UI側ファイル機能実装
**優先度**: 中 | **TDD**: 適用
- RightSidebarでのファイル管理機能
- ドラッグ&ドロップの基本実装
- ファイル一覧表示

### TASK12: メッセージ送信時のファイル添付
**優先度**: 中 | **TDD**: 適用
- ファイル付きメッセージ送信
- ファイル情報の表示・管理
- Claude APIとの統合

---

## フェーズ5: 初期設定機能実装 ⚙️

### TASK13: 設定画面コンポーネント作成
**優先度**: 低 | **TDD**: 適用
- 新しい設定画面コンポーネント（テスト先行）
- Claude API・AWS Bedrock設定UI
- Headerからのアクセス機能

### TASK14: 初回起動時フロー実装
**優先度**: 低 | **TDD**: 適用
- APIキー未設定時の誘導
- 設定完了チェック機能
- 初回セットアップガイド

---

## 品質保証・テスト戦略

### テスト方針
- **単体テスト**: 各関数・コンポーネントのテスト
- **統合テスト**: コンポーネント間の連携テスト
- **E2Eテスト**: ユーザーシナリオに基づくテスト

### テストフレームワーク
- **Vitest**: JavaScript/TypeScriptテスト
- **React Testing Library**: Reactコンポーネントテスト
- **@testing-library/jest-dom**: DOM操作テスト

### テストカバレッジ目標
- **メインプロセス**: 90%以上
- **レンダラープロセス**: 80%以上
- **統合テスト**: 主要シナリオ100%

---

## 実装時の注意点・制約事項

### セキュリティ
- APIキーはメインプロセスのみで扱う
- レンダラープロセスには機密情報を渡さない
- ファイルアクセスの適切な制限

### パフォーマンス
- 大量データに対する仮想スクロール対応
- ファイルキャッシュの実装
- メモリリーク対策

### 互換性
- Electron最新版対応
- TypeScript strict mode対応
- Node.js LTS版対応

---

## 進捗管理

### 完了基準
各タスクは以下の基準で完了とする：
1. テストコードが先行実装されている
2. 実装コードがテストをパスする
3. コードレビューが完了している
4. ドキュメントが更新されている

### マイルストーン
- [x] **M1**: データベース層実装完了
- [ ] **M2**: 基本UI実装完了
- [ ] **M3**: チャット機能実装完了
- [ ] **M4**: ファイル機能実装完了
- [ ] **M5**: 全機能統合完了

---

**作成日**: 2025-06-30  
**最終更新**: 2025-06-30  
**バージョン**: 1.0