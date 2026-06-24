/**
 * Window Management API (Multi-Screen Window Placement) の最小型宣言。
 *
 * 標準の DOM lib にはまだ含まれないため、`window.getScreenDetails()` /
 * `screen.isExtended` / `Element.requestFullscreen({ screen })` を型安全に使えるよう
 * 必要な分だけアンビエント宣言する。Chromium 系のみ実装。
 *
 * 仕様: https://www.w3.org/TR/window-management/
 */

interface ScreenDetailed extends Screen {
  /** 仮想スクリーン座標系における左端 (CSS px)。 */
  readonly left: number;
  /** 仮想スクリーン座標系における上端 (CSS px)。 */
  readonly top: number;
  /** 作業領域（タスクバー等を除く）の左端。 */
  readonly availLeft: number;
  /** 作業領域の上端。 */
  readonly availTop: number;
  /** OS 上のプライマリディスプレイか。 */
  readonly isPrimary: boolean;
  /** デバイス内蔵ディスプレイ（ノートPC本体画面など）か。 */
  readonly isInternal: boolean;
  /** ディスプレイ名（取得できない場合は空文字）。 */
  readonly label: string;
  /** デバイスピクセル比。 */
  readonly devicePixelRatio: number;
}

interface ScreenDetails extends EventTarget {
  /** 接続中の全ディスプレイ。 */
  readonly screens: ScreenDetailed[];
  /** ブラウザウィンドウが現在表示されているディスプレイ。 */
  readonly currentScreen: ScreenDetailed;
  onscreenschange: ((this: ScreenDetails, ev: Event) => unknown) | null;
  oncurrentscreenchange: ((this: ScreenDetails, ev: Event) => unknown) | null;
}

interface Window {
  /** ディスプレイ構成を取得（要 transient activation ＋ window-management 許可）。 */
  getScreenDetails?(): Promise<ScreenDetails>;
}

interface Screen {
  /**
   * 複数ディスプレイへ拡張されているか。
   * 許可不要で参照でき、構成変化時は screen の 'change' イベントが発火する。
   */
  readonly isExtended?: boolean;
  /** ディスプレイ構成の変化（接続/切断など）で発火。 */
  onchange?: ((this: Screen, ev: Event) => unknown) | null;
  addEventListener?(
    type: 'change',
    listener: (this: Screen, ev: Event) => unknown,
    options?: boolean | AddEventListenerOptions
  ): void;
  removeEventListener?(
    type: 'change',
    listener: (this: Screen, ev: Event) => unknown,
    options?: boolean | EventListenerOptions
  ): void;
}

interface FullscreenOptions {
  /** 指定ディスプレイ上で全画面化する（Window Management API 拡張）。 */
  screen?: ScreenDetailed;
}
