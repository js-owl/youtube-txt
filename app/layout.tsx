import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "TubeSum — Суть видео за пару секунд",
  description:
    "Вставьте ссылку на YouTube-видео, чтобы получить краткое содержание за пару секунд.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" className={inter.variable}>
      <body className="font-sans bg-background text-foreground min-h-screen flex flex-col">
        {children}
      </body>
    </html>
  );
}
