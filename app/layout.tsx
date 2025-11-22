import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PPT 设计大师 - AI 辅助课件设计',
  description: '使用 Gemini AI 辅助生成精美的 PPT 课件',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
