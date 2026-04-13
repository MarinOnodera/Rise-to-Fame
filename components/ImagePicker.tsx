"use client";

import { useRef, useState } from "react";

/**
 * 写真アップロード用の軽量コンポーネント。
 * - モバイルでは capture="user" でフロントカメラを起動
 * - クライアント側で 1024px に長辺リサイズして base64 化 (APIへの転送量節約)
 * - JPEG エンコードで ~85% 品質。個人情報は保存せず、base64 を onPick に渡すだけ。
 */
export function ImagePicker({
  onPick,
  disabled,
  label = "写真を選ぶ",
}: {
  onPick: (dataUrl: string) => void;
  disabled?: boolean;
  label?: string;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleFile(f: File) {
    setErr(null);
    if (!f.type.startsWith("image/")) {
      setErr("画像ファイルを選んでください");
      return;
    }
    if (f.size > 12 * 1024 * 1024) {
      setErr("12MB 以下の画像にしてください");
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await resizeToDataUrl(f, 1024, 0.85);
      onPick(dataUrl);
    } catch (e) {
      setErr("画像の読み込みに失敗しました");
      console.warn(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <input
        ref={ref}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          // 同じファイルを再選択できるようにリセット
          e.currentTarget.value = "";
        }}
      />
      <button
        type="button"
        disabled={disabled || busy}
        className="btn-primary disabled:opacity-50"
        onClick={() => ref.current?.click()}
      >
        {busy ? "読み込み中..." : label}
      </button>
      {err && <div className="text-kpink text-xs">{err}</div>}
    </div>
  );
}

async function resizeToDataUrl(
  file: File,
  maxSide: number,
  quality: number
): Promise<string> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) {
    // フォールバック: そのまま dataURL
    return await readAsDataUrl(file);
  }
  const ratio = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * ratio);
  const h = Math.round(bitmap.height * ratio);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return await readAsDataUrl(file);
  ctx.drawImage(bitmap, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}
