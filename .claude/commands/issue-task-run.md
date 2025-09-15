---
description: Github Issueからタスクを実行し、プルリクエスト作成します[/issue-task-run xxx]
---

## context

- プロジェクト目的
  Claude Code の操作履歴を管理し、Claudeに操作履歴情報を提供する MCP サーバーを開発する
- このプロンプトは、そのプロジェクト内のサブタスクを実行するためのものである
- Pull Requestテンプレートは以下を利用
  @.github/pull_request_template.md

## 📋 ルール

### コミット

**重要**: 1コミットの中には一つのコンテキストにマッチするファイルのみを含め、マイクロコミットを意識する

### タスク完了時の手順

**重要**: タスクを完了した際は、必ず以下の手順を実行してください：

1. **タスクをチェック** - `- [ ]` を `- [x]` に変更
2. **完了日を追記** - `✅ **完了** (YYYY-MM-DD)` を追加
3. **関連ファイルを明記** - 作成・修正したファイル名を記載

### TDD実装ルール

1. **Red-Green-Refactorサイクル厳守**
   - テストを先に書く（Red）
   - 最小限の実装でテストを通す（Green）
   - コードを改善する（Refactor）

### 開発ワークフロー - Build-Test-Execute Cycle

**最重要**: コード変更後は必ずこのサイクルを実行する

1. **ビルド・実行・確認**:
   ```bash
   npm run clean                    # 既存成果物をクリア（必須）
   npm run build                    # TypeScriptをコンパイル
   node dist/index.js [command]     # 実際のCLI動作確認
   # ESモジュール実行テスト（Node.js環境確認）
   node -e "import('./dist/index.js').then(() => console.log('✅ ES module import OK')).catch(err => { console.error('❌ ES module error:', err.message); process.exit(1); })"
   # stdin入力テスト（実際の使用パターン） - macOSではgtimeout、Linuxではtimeout
   echo '{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}' | (timeout 3s node dist/index.js 2>/dev/null || gtimeout 3s node dist/index.js 2>/dev/null || echo "✅ CLI execution OK")
   ```

2. **品質チェック** (コミット前必須):
   ```bash
   npx jest --clearCache           # Jestキャッシュクリア（CI環境模擬）
   npm run typecheck               # TypeScript型チェック
   npm run lint                    # ESLint準拠確認
   npm test                        # テスト実行
   npm test -- --coverage --watchAll=false  # カバレッジテスト（CI環境テスト）
   ```

3. **自動修正** (エラー発生時):
   ```bash
   npm run lint:fix                # Lintエラー自動修正
   npm run format                  # コード整形
   ```

**なぜ必須か**:
- TypeScriptは事前コンパイルが必要
- 実際のCLI動作はテストだけでは検証できない
- ユーザー向け機能は手動確認が不可欠
- ESモジュールの依存関係はCI環境でのみ検出される場合がある
- カバレッジテストで隠れた依存関係問題を発見できる
- **クリーンビルドでキャッシュや古い成果物による誤判定を防止**
- **Jestキャッシュクリアでテスト環境とCI環境の状態を統一**

### テストの実行

**重要**: プロジェクト特有のテスト戦略

**推奨テスト実行方法**:
- 全テストを実行: `npm test` (このプロジェクトでは高速)
- 特定テストのみ: `npm test src/session-discovery.test.ts`
- ウォッチモード: `npm run test:watch`

### 技術スタック
- **言語**: Node.js + TypeScript (ES modules)
- **テスト**: jest + ts-jest
- **品質**: eslint + prettier

### CI環境同等テストのポイント

**重要**: 以下の点でローカル環境とCI環境で差が生じやすい

1. **キャッシュの影響**:
   - `npm run clean` でビルド成果物をクリア（0.1秒程度）
   - `npx jest --clearCache` でJestキャッシュをクリア

2. **ESモジュール拡張子**:
   - ビルド後のdistファイルに`.js`拡張子が正しく追加されているか
   - `fix-imports.js`スクリプトが正常動作しているか

3. **依存関係**:
   - カバレッジテスト実行時にのみ必要な依存関係の不足
   - `npm test -- --coverage --watchAll=false` で検出

4. **実行環境**:
   - 実際のNode.js実行での動作確認
   - stdin入力を伴うCLI動作の確認

**clean実行タイミング**:
- 構造的変更時（ファイル追加/削除、インポート変更）
- CI環境で問題発生時
- 依存関係変更時（package.json等）
- 疑わしい時は迷わず実行（コストは0.1秒程度）

## 処理フロー

### タスク作成 (Task Tool使用)
- ghコマンドを使って github issue #$ARGUMENTS を参照
- **重要**: issueに「🔍 仕様明確化」セクションがある場合、「質問と回答」を必ず参照して実装方針を確認
- このissueの内容を良く理解してタスク化してください
- TDDメソッドを使用してタスク化
- タスクはTodosで保持
- 作成したtodoをissueのコメントに追加
  - すでにissueのコメントにtodoがあった場合、内容を適切に更新
  - 追加でコメントがあり、修正指示の場合、修正指示を反映したtodoをコメント追加

### 初期設定 (Task Tool使用)
- `git fetch -a -p` を実行
- origin/developからブランチを作成
- [skip ci]付きの空コミット作成
- issueにopenされているpull requestが紐づいて存在している場合
  - 実装済み内容を確認し、実装を継続するようにする
- ghコマンドを使って pull request作成（todoをチェックリスト化）
  - pull requestのテンプレート: @.github/PULL_REQUEST_TEMPLATE.md

### タスク実行 (各処理ごとにTask Toolを個別に使用)
- 実行前に `## 📋 ルール` の内容を復唱する
- 各タスクを順次実行
- TDD実装ルールに従い、テストファーストで開発
- **必須**: コード変更毎にBuild-Test-Execute Cycleを実行
  1. `npm run clean` でクリーンアップ
  2. `npm run build` でビルド
  3. `node dist/index.js [command]` で実際動作確認
  4. ESモジュール実行テスト実行
  5. stdin入力テスト実行
  6. `npx jest --clearCache` でキャッシュクリア
  7. 品質チェック (`typecheck`, `lint`, `test`, カバレッジテスト) を実行
- 完了後にコミット・プッシュ
- PRチェックリストを更新（ `- [ ]` → `- [x]` ）
- 完了日と関連ファイルを記載
- 未完了タスクがなくなるまで繰り返し
- タスクの戻り値として、実施した内容とPR更新結果を報告
- 次のタスクの実行に必要な情報は、それまでに実行したタスクの戻り値等を適切に使用する

### 終了処理
- 全部終わったらプッシュ
- 完了メッセージをpull requestのコメントに追加