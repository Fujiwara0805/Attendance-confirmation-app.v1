'use client';

/**
 * 外部ディスプレイ（拡張ディスプレイ）への全画面表示ユーティリティ。
 *
 * Chromium 系の Window Management API を使い、「ボタン一つで、接続中の外部
 * ディスプレイへざせきくん画面を全画面表示する」挙動を提供する。非対応ブラウザ
 * （Safari / Firefox）や 1 画面環境では現在の画面で全画面化にフォールバックする。
 *
 * - 検知（外部ディスプレイの有無）は許可不要の `screen.isExtended` で行う。
 * - 全画面化は `getScreenDetails()`（要許可）→ 外部画面を選んで
 *   `requestFullscreen({ screen })`。
 */

import { useEffect, useState } from 'react';

/** Window Management API（getScreenDetails）が使えるか。 */
export function isMultiScreenSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.getScreenDetails === 'function';
}

/**
 * ScreenDetails を**モジュールスコープにキャッシュ**する。
 *
 * `getScreenDetails()` は transient activation を要し、初回は許可プロンプトで
 * ユーザー操作が消費され得る。一度取得すれば ScreenDetails はライブで更新され続ける
 * ため、2 回目以降のボタン押下は同期パスで参照でき、`requestFullscreen` が確実に通る。
 * （`lib/captureStreamStore.ts` と同じモジュールスコープ保持の方針。）
 */
let cachedDetails: ScreenDetails | null = null;

export async function getCachedScreenDetails(): Promise<ScreenDetails | null> {
  if (!isMultiScreenSupported()) return null;
  if (cachedDetails) return cachedDetails;
  try {
    cachedDetails = await window.getScreenDetails!();
    return cachedDetails;
  } catch {
    // 許可拒否・非対応など。フォールバック側に任せる。
    return null;
  }
}

/**
 * 外部（拡張）ディスプレイを 1 つ選ぶ。
 * 優先順: 非内蔵かつ非プライマリ → 非内蔵 → 現在画面以外。1 画面なら null。
 */
export function pickExternalScreen(details: ScreenDetails): ScreenDetailed | null {
  const screens = details.screens ?? [];
  if (screens.length <= 1) return null;
  const current = details.currentScreen;
  return (
    screens.find((s) => !s.isInternal && !s.isPrimary) ??
    screens.find((s) => !s.isInternal) ??
    screens.find((s) => s !== current) ??
    null
  );
}

export type FullscreenTarget = 'external' | 'current' | 'none';

/**
 * 外部ディスプレイがあればそこへ、無ければ現在画面へ要素を全画面化する。
 * @returns どこに全画面化したか（'none' は全画面化に失敗）。
 */
export async function enterFullscreenPreferExternal(
  element: HTMLElement | null
): Promise<FullscreenTarget> {
  if (!element || typeof element.requestFullscreen !== 'function') return 'none';

  const details = await getCachedScreenDetails();
  const external = details ? pickExternalScreen(details) : null;

  if (external) {
    try {
      await element.requestFullscreen({ screen: external });
      return 'external';
    } catch {
      // 外部画面指定に失敗 → 現在画面へフォールバック。
    }
  }

  try {
    await element.requestFullscreen();
    return 'current';
  } catch {
    return 'none';
  }
}

/**
 * 外部（拡張）ディスプレイが接続されているかを購読する React フック。
 * 許可プロンプトを出さずに `screen.isExtended` を参照し、構成変化（接続/切断）にも追従する。
 */
export function useHasExternalDisplay(): boolean {
  const [hasExternal, setHasExternal] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.screen) return;
    const scr = window.screen;
    const update = () => setHasExternal(scr.isExtended === true);
    update();
    scr.addEventListener?.('change', update);
    return () => scr.removeEventListener?.('change', update);
  }, []);

  return hasExternal;
}
