"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import SideNavBar from "./SideNavBar";
import TopNavBar from "./TopNavBar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/login";
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (isLogin) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <SideNavBar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex-1 md:ml-64 flex flex-col min-h-[100vh]">
        <TopNavBar onMenuClick={() => setSidebarOpen(true)} />
        <div className="flex-1 relative z-0">{children}</div>
      </main>
    </div>
  );
}
