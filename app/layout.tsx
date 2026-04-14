import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rise to Fame — K-Pop Producer & Fan",
  description:
    "自分がプロデューサーになる、あるいは推しと生きる。K-Pop カルチャー体験ゲーム。",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="font-display antialiased">
        {/*
          ゲームは横画面前提。ホーム画面は `fixed inset-0` で自前にフル幅を取る。
          メニュー内の各サブページ (ファンホーム / 設定 等) は画面幅が広い端末でも
          読みやすいように中央寄せの最大幅だけ指定する。max-w-md だと横画面では
          左端に寄りすぎるため、max-w-4xl + 水平センターに変更。
        */}
        <div className="mx-auto max-w-4xl min-h-screen relative">{children}</div>
      </body>
    </html>
  );
}
