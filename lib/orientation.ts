"use client";

/**
 * 横画面への自動回転ユーティリティ。
 *
 * ブラウザサポート:
 * - Android Chrome/Edge/Samsung Internet: fullscreen + screen.orientation.lock('landscape') で成功
 * - iOS Safari (通常のWebページ): screen.orientation.lock が存在しない / 例外。
 *   → iOS では PWA としてホーム追加してもらう必要がある (ベストエフォート)
 * - デスクトップ: そもそも回転概念が薄いのでロック不要 (何もしない)
 *
 * 失敗しても害はなく、縦のままなら従来の「画面を横にしてね」ヒントを出す。
 */

export async function lockLandscape(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const docEl = document.documentElement;
    // fullscreen は多くのモバイルで orientation.lock の前提条件
    if (
      !document.fullscreenElement &&
      typeof docEl.requestFullscreen === "function"
    ) {
      await docEl.requestFullscreen().catch(() => undefined);
    }
    const s = screen as unknown as {
      orientation?: {
        lock?: (o: string) => Promise<void>;
        type?: string;
      };
    };
    if (s.orientation && typeof s.orientation.lock === "function") {
      await s.orientation.lock("landscape");
      return true;
    }
  } catch {
    // user gesture がない / iOS Safari など未対応 → 失敗してもOK
  }
  return false;
}

export function isPortrait(): boolean {
  if (typeof window === "undefined") return false;
  const s = screen as unknown as { orientation?: { type?: string } };
  if (s.orientation?.type) return s.orientation.type.startsWith("portrait");
  return window.innerHeight > window.innerWidth;
}

export function onOrientationChange(cb: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const handler = () => cb();
  window.addEventListener("orientationchange", handler);
  window.addEventListener("resize", handler);
  const s = screen as unknown as {
    orientation?: { addEventListener?: (type: string, cb: () => void) => void;
      removeEventListener?: (type: string, cb: () => void) => void;
    };
  };
  s.orientation?.addEventListener?.("change", handler);
  return () => {
    window.removeEventListener("orientationchange", handler);
    window.removeEventListener("resize", handler);
    s.orientation?.removeEventListener?.("change", handler);
  };
}
