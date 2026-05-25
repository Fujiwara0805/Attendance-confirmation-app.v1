import type { ReactNode } from 'react';

/**
 * ルーム配下の共通 Layout。
 *
 * 注意:
 *   画面共有 MediaStream は `lib/captureStreamStore` のモジュールスコープ
 *   シングルトンで保持しているため、この Layout には保持責務を持たせない。
 *   モジュールスコープのほうがどんな再マウントにも耐えるため、画面共有が
 *   stage <-> present の遷移で確実に維持される。
 */
export default function RoomLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
