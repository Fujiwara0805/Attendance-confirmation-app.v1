// 「スクリーンを開く」共通挙動（Canva の発表者ツール風）。
//
// 操作用のステージ管理画面（Q&Aタブ固定）をポップアップで開きつつ、
// 今いるウィンドウ自体をスクリーン画面（present）へ遷移させる。
// → 今の窓がプロジェクター投影用スクリーンに、ポップアップが手元の操作窓になる。
//
// ホスト管理画面・ルーム管理(admin)画面の両方から呼ばれるため共通化している。
//
// 注意: 以前ここで `requestFullscreen()` を呼んで自窓を全画面化していたが、
// 全画面要求がクリックのユーザー操作（transient activation）を消費してしまい、
// 直後の `window.open`（操作ポップアップ）がブロックされて表示されなくなる。
// また単一モニターでは全画面がポップアップを覆い隠してしまう。そのため自動全画面は
// 行わず、スクリーンの全画面化は present 画面の「全画面」ボタン（外部ディスプレイ対応）
// から行う。
//
// `navigate` にクライアント遷移（router.push）を渡すと、ドキュメントが再読み込み
// されないため画面共有ストリーム等を保持できる。省略時は window.location でのフルリロード。
export function openScreenWithControl(roomCode: string, navigate?: (url: string) => void) {
  if (typeof window === 'undefined') return;

  // 1. 手元操作用のステージ管理ポップアップを開く（最優先。activation を消費しない）。
  window.open(
    `/rooms/${roomCode}/host?tab=questions`,
    `zasekikun-qa-${roomCode}`,
    'popup,width=1280,height=720'
  );

  // 2. このウィンドウはスクリーン画面（present）へ遷移（プロジェクター投影用）。
  const presentUrl = `/rooms/${roomCode}/present`;
  if (navigate) navigate(presentUrl);
  else window.location.href = presentUrl;
}
