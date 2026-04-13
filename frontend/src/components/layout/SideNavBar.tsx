"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import clsx from "clsx";
import { CATEGORY_LABELS } from "@/lib/utils";
import { useCreateAppeal } from "@/hooks/useQueries";
import toast from "react-hot-toast";

export default function SideNavBar({ open, onClose }: { open?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const createAppeal = useCreateAppeal();
  const [showNewForm, setShowNewForm] = useState(false);
  const [newCategory, setNewCategory] = useState("complaint");
  const [newMessage, setNewMessage] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const firstModalFocusRef = useRef<HTMLSelectElement>(null);

  const navItems = [
    { name: "Дашборд", href: "/dashboard", icon: "dashboard" },
    { name: "Обращения", href: "/appeals", icon: "inbox" },
    { name: "Аналитика", href: "/analytics", icon: "monitoring" },
    { name: "ИИ Конфигурация", href: "/settings/ai", icon: "settings_input_component" },
    { name: "Настройки", href: "/settings", icon: "settings" },
  ];

  // Escape закрывает модал и сайдбар
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (showNewForm) { setShowNewForm(false); return; }
      if (open) onClose?.();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [showNewForm, open, onClose]);

  // Фокус на первый элемент при открытии модала
  useEffect(() => {
    if (showNewForm) {
      setTimeout(() => firstModalFocusRef.current?.focus(), 50);
    }
  }, [showNewForm]);

  const handleCreateAppeal = () => {
    if (!newMessage.trim()) return;
    createAppeal.mutate(
      {
        category: newCategory,
        source: "phone_1433",
        client_message: newMessage,
        client_phone: newPhone || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Обращение создано");
          setShowNewForm(false);
          setNewMessage("");
          setNewPhone("");
          router.push("/appeals");
        },
        onError: () => toast.error("Не удалось создать обращение"),
      },
    );
  };

  return (
    <>
      <aside
        aria-label="Боковое меню"
        className={clsx(
          "fixed left-0 top-0 h-full w-64 flex flex-col py-6 bg-surface-container border-r-0 z-50 transition-transform duration-200",
          "md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className="px-6 mb-8 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3" onClick={onClose}>
            <div className="w-10 h-10 bg-primary-gradient rounded-lg flex items-center justify-center text-white" aria-hidden="true">
              <span className="material-symbols-outlined">train</span>
            </div>
            <div>
              <h1 className="text-xl font-black text-primary font-headline uppercase tracking-tighter">KTZ CRM</h1>
              <p className="text-[10px] font-semibold tracking-wider uppercase text-on-surface-variant">Система обращений</p>
            </div>
          </Link>
          <button
            onClick={onClose}
            className="md:hidden p-1.5 text-on-surface-variant hover:text-primary rounded-lg transition-colors"
            aria-label="Закрыть боковое меню"
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
          </button>
        </div>

        <div className="px-4 mb-6">
          <button
            onClick={() => setShowNewForm(true)}
            className="w-full bg-primary-gradient text-white py-3 px-4 rounded-xl font-headline font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-all"
            aria-haspopup="dialog"
          >
            <span className="material-symbols-outlined" aria-hidden="true">add</span>
            Новое обращение
          </button>
        </div>

        <nav aria-label="Основная навигация" className="flex-1 px-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onClose}
                aria-current={isActive ? "page" : undefined}
                className={clsx(
                  "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                  isActive
                    ? "text-primary font-bold bg-slate-300/50"
                    : "text-on-surface-variant font-medium hover:text-primary hover:bg-slate-300/50",
                )}
              >
                <span className="material-symbols-outlined" aria-hidden="true">{item.icon}</span>
                <span className="text-xs font-semibold tracking-wider uppercase">{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* New appeal modal */}
      {showNewForm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-appeal-title"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40"
          onClick={(e) => { if (e.target === e.currentTarget) setShowNewForm(false); }}
        >
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 id="new-appeal-title" className="font-headline font-bold text-lg text-primary mb-4">Новое обращение</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="new-appeal-category" className="text-xs font-bold text-slate-500 block mb-1">Категория</label>
                <select
                  id="new-appeal-category"
                  ref={firstModalFocusRef}
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ktzh-blue/30"
                >
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="new-appeal-phone" className="text-xs font-bold text-slate-500 block mb-1">Телефон клиента</label>
                <input
                  id="new-appeal-phone"
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="+7..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ktzh-blue/30"
                />
              </div>
              <div>
                <label htmlFor="new-appeal-message" className="text-xs font-bold text-slate-500 block mb-1">
                  Сообщение <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <textarea
                  id="new-appeal-message"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Опишите обращение..."
                  required
                  aria-required="true"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm h-24 resize-none focus:outline-none focus:ring-2 focus:ring-ktzh-blue/30"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowNewForm(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm py-2.5 rounded-lg transition-colors"
                >
                  Отмена
                </button>
                <button
                  onClick={handleCreateAppeal}
                  disabled={!newMessage.trim() || createAppeal.isPending}
                  className="flex-1 bg-primary hover:bg-primary/90 text-white font-bold text-sm py-2.5 rounded-lg transition-colors disabled:opacity-50"
                >
                  {createAppeal.isPending ? "Создание..." : "Создать"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
