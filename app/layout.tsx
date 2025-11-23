import type { Metadata } from "next";
import "./globals.css";
import { TRPCProvider } from "@/lib/trpc";
import { AuthProvider } from "@/components/auth-provider";
import { ErrorBoundary } from "@/components/error-boundary";
import { ToastProvider } from "@/components/ui/toast-provider";
import { ThemeProvider } from "@/components/theme-provider";

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
      <body>
        <ThemeProvider>
          <ErrorBoundary>
            <AuthProvider>
              <TRPCProvider>
                <ToastProvider>
                  {children}
                </ToastProvider>
              </TRPCProvider>
            </AuthProvider>
          </ErrorBoundary>
        </ThemeProvider>
      </body>
    </html>
  );
}
