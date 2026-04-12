import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rise to Fame — K-Pop Producer & Fan",
  description:
    "自分がプロデューサーになる、あるいは推しと生きる。K-Pop カルチャー体験ゲーム。",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="font-display antialiased">
        <div className="mx-auto max-w-md min-h-screen relative">{children}</div>
      </body>
    </html>
  );
}
