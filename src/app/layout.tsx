import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MURATA 調査報告書システム",
  description: "現場写真と音声入力から調査報告書を自動生成",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="bg-gray-100 min-h-screen">{children}</body>
    </html>
  );
}
