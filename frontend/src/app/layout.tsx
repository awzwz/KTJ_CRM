import type { Metadata } from "next";
import "./globals.css";
import ReactQueryProvider from "@/components/providers/ReactQueryProvider";
import AppShell from "@/components/layout/AppShell";
import ErrorBoundary from "@/components/providers/ErrorBoundary";

export const metadata: Metadata = {
  title: "КТЖ CRM — Система обращений",
  description: "CRM система для управления обращениями клиентов КТЖ",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" className="light">
      <body>
        <ReactQueryProvider>
          <ErrorBoundary>
            <AppShell>{children}</AppShell>
          </ErrorBoundary>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
