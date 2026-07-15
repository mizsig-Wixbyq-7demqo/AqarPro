import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AqarPro — عقار برو",
  description: "إدارة العقارات المؤجرة وقياس صحتها التشغيلية وتدفقها النقدي وفجوة الإيجار.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body><a className="skip-link" href="#main-content">انتقل إلى المحتوى الرئيسي</a>{children}</body>
    </html>
  );
}
