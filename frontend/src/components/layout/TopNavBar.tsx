"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";

const BREADCRUMB_LABELS: Record<string, string> = {
  dashboard: "Панель управления",
  appeals: "Обращения",
  analytics: "Аналитика",
  settings: "Настройки",
  ai: "AI модели",
};

function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  return (
    <nav aria-label="Навигационная цепочка" className="flex items-center gap-1 text-sm">
      {segments.map((seg, i) => {
        const isLast = i === segments.length - 1;
        const label = BREADCRUMB_LABELS[seg] || (seg.length > 8 ? `#${seg.slice(0, 8)}` : seg);
        return (
          <React.Fragment key={i}>
            {i > 0 && <span className="text-slate-300 mx-1" aria-hidden="true">/</span>}
            <span
              className={isLast ? "font-semibold text-slate-700" : "text-slate-500"}
              aria-current={isLast ? "page" : undefined}
            >
              {label}
            </span>
          </React.Fragment>
        );
      })}
    </nav>
  );
}

export default function TopNavBar({ onMenuClick }: { onMenuClick?: () => void }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const handleSearch = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && searchQuery.trim()) {
      router.push(`/appeals?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery("");
    }
  };

  // Escape закрывает user-меню
  useEffect(() => {
    if (!showUserMenu) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowUserMenu(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [showUserMenu]);

  const initials = user?.full_name
    ? user.full_name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()
    : "U";

  return (
    <header className="flex justify-between items-center px-4 md:px-8 w-full h-14 top-0 sticky z-40 bg-white/80 backdrop-blur-md border-b border-slate-100">
      <div className="flex items-center gap-3 md:gap-6 flex-1">
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 text-slate-500 hover:text-ktzh-blue hover:bg-blue-50/60 rounded-lg transition-all"
          aria-label="Открыть боковое меню"
          aria-expanded={undefined}
        >
          <span className="material-symbols-outlined text-[22px]" aria-hidden="true">menu</span>
        </button>
        <Breadcrumbs />
        <div className="relative w-full max-w-sm ml-auto">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]" aria-hidden="true">
            search
          </span>
          <input
            className="w-full bg-slate-50 border border-transparent rounded-lg py-2 pl-10 pr-4 text-sm focus:bg-white focus:border-slate-200 focus:ring-1 focus:ring-ktzh-blue/20 placeholder:text-slate-400 transition-all duration-200"
            placeholder="Поиск обращений..."
            type="search"
            aria-label="Поиск обращений"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearch}
          />
        </div>
      </div>
      <div className="flex items-center gap-2 ml-4">
        <button
          onClick={() => router.push("/appeals")}
          className="p-2 text-slate-400 hover:text-ktzh-blue hover:bg-blue-50/60 rounded-lg transition-all"
          aria-label="Перейти к обращениям"
        >
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">inbox</span>
        </button>
        <div className="h-6 w-px bg-slate-200 mx-1" aria-hidden="true" />
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2.5 hover:bg-slate-50 rounded-lg px-2 py-1.5 transition-colors"
            aria-label={`Меню пользователя ${user?.full_name || ""}`}
            aria-haspopup="true"
            aria-expanded={showUserMenu}
          >
            <div className="text-right hidden sm:block">
              <p className="text-xs font-semibold text-slate-700">{user?.full_name || "Пользователь"}</p>
              <p className="text-[10px] text-slate-500 font-medium">{user?.role || ""}</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-ktzh-dark flex items-center justify-center text-white font-bold text-[11px]" aria-hidden="true">
              {initials}
            </div>
          </button>
          {showUserMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} aria-hidden="true" />
              <div
                role="menu"
                aria-label="Меню пользователя"
                className="absolute right-0 top-full mt-1.5 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 w-48 z-50"
              >
                <div className="px-4 py-2 border-b border-slate-100">
                  <p className="text-sm font-medium text-slate-800">{user?.full_name}</p>
                  <p className="text-xs text-slate-500">{user?.email}</p>
                </div>
                <button
                  role="menuitem"
                  onClick={logout}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  Выйти
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
