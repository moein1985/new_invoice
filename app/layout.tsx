import type { Metadata } from "next";
import "./globals.css";
import { TRPCProvider } from "@/lib/trpc";
import { AuthProvider } from "@/components/auth-provider";

export const metadata: Metadata = {
  title: "سیستم مدیریت فاکتور",
  description: "سیستم جامع مدیریت فاکتور و اسناد مالی",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl">
      <body className="antialiased">
        <AuthProvider>
          <TRPCProvider>
            {children}
          </TRPCProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
