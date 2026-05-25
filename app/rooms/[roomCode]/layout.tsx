'use client';

import type { ReactNode } from 'react';

/**
 * ルーム配下の共通 Layout。
 *
 * MediaStream と共有映像用 video DOM は `lib/captureStreamStore` の
 * モジュールスコープに保持する。Layout はルーム配下のクライアント遷移を維持する。
 */
export default function RoomLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
