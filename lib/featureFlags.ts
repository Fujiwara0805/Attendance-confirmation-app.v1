// 機能フラグ（クライアント安全：サーバ専用 import を持たない軽量モジュール）。
//
// 組織・エンタープライズ機能は「Coming Soon」として UI の入口のみ無効化する。
// バックエンド（API Route / lib/organization.ts / Stripe webhook の org 分岐 / DB テーブル）は
// 温存しているため、下記フラグを false に戻すだけで UI 導線を含めて再開できる。
export const ORG_FEATURE_COMING_SOON = true;
