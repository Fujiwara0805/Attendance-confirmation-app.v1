# ざせきくん（attendance-management）

リアルタイム Q&A・投票（投票/クイズ/ランキング/ブレスト）・出席管理・招待フォームをひとつにしたイベント運営サービス。参加者はアプリ・ログイン不要で QR コードから参加し、結果はスクリーンにリアルタイム投影される。

## 技術スタック

- Next.js (App Router) / React / TypeScript
- UI: Tailwind CSS + shadcn/ui + Framer Motion
- DB・Realtime: Supabase（`lib/supabase.ts`）
- 課金: Stripe（`lib/subscription.ts`）。PDF 生成: Gotenberg（`lib/gotenberg.ts`）。デプロイ: Vercel

## コマンド

- `npm run dev` — 開発サーバ
- `npm run build` — 本番ビルド
- `npm run lint` — Lint
- 型チェック: `npx tsc --noEmit`（typecheck スクリプトは未定義）

テストスイートは無い。検証は typecheck + build + 該当フローの実操作で行う。

## ディレクトリ構成

- `app/` — App Router。`rooms/`=ルーム（ホスト操作・投影）、`attendance/` `checkin/` `invitation/`=参加者向け、`admin/`=管理、`api/`=Route Handlers
- `lib/` — ドメインロジック（`pollModes.ts`、`sessionReport.ts`、`screenWindow.ts`、`captureStreamStore.ts` など）
- `components/` `hooks/` `types/`。デザイン方針は `DESIGN.md`
- `tasks/` — ローカル作業メモ（gitignore 済み）。`lessons.md` に過去の教訓あり

## プロジェクト固有の注意

- 組織（エンタープライズ）機能: プラン解決は `lib/subscription.ts` の `getUserSubscription` に一元化（組織サブスク優先→個人にフォールバック）。個人サブスクの操作は `getPersonalSubscription` を使う。Stripe の組織サブスクは `metadata.productType='org_subscription'` で識別し、webhook 各ハンドラの先頭で分岐する（個人パスに落とすとオーナー個人のプランを誤上書きする）。シート = メンバー数 + 未受諾招待数、1ユーザー1組織（DB unique index）

- 投影ウィンドウの遠隔操作など揮発的な状態は Supabase Realtime の broadcast チャネル（`room-screen-${id}` / `room-control-${id}`）で渡す。DB に書かない
- 別ウィンドウから画面共有・ファイル選択を発火する機能は transient activation 制約に注意（詳細: `tasks/lessons.md`）
- 無料プランのレポート閲覧期限は「ルーム作成 + 30日」の既存ゲートを流用する
- Supabase の DB 操作・マイグレーションは Supabase MCP ツール経由で行う
- コミットメッセージは日本語・絵文字プレフィックス（既存履歴のスタイルに合わせる）
