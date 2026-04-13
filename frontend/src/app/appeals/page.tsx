"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppeals, useUpdateAppeal, type Appeal } from "@/hooks/useQueries";
import {
  cn,
  STATUS_LABELS,
  CATEGORY_LABELS,
  STATUS_COLORS,
  CATEGORY_COLORS,
  SOURCE_LABELS,
} from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import toast from "react-hot-toast";

function MessagePreview({ text }: { text: string | null }) {
  if (!text) return <span className="text-slate-300 italic">Нет текста</span>;
  const truncated = text.length > 90 ? text.slice(0, 90) + "..." : text;
  return <span className="text-slate-500">{truncated}</span>;
}

type SortField = "created_at" | "status" | "category";

function SortableHeader({
  label,
  field,
  sortBy,
  order,
  onSort,
  className,
}: {
  label: string;
  field: SortField;
  sortBy: SortField;
  order: "asc" | "desc";
  onSort: (f: SortField) => void;
  className?: string;
}) {
  const isActive = sortBy === field;
  return (
    <th
      scope="col"
      className={cn("px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 cursor-pointer select-none hover:text-slate-600 transition-colors", className)}
      onClick={() => onSort(field)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSort(field); } }}
      tabIndex={0}
      role="columnheader"
      aria-sort={isActive ? (order === "asc" ? "ascending" : "descending") : "none"}
    >
      <span className="flex items-center gap-1">
        {label}
        <span className="text-[10px] opacity-60">
          {isActive ? (order === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </span>
    </th>
  );
}

export default function AppealsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState<SortField>("created_at");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState("");
  const limit = 20;

  const updateAppeal = useUpdateAppeal();
  const searchQuery = searchParams.get("search") || "";

  useEffect(() => { setPage(0); }, [searchQuery]);

  const { data, isLoading, isError } = useAppeals({
    skip: page * limit,
    limit,
    status: statusFilter || undefined,
    category: categoryFilter || undefined,
    search: searchQuery || undefined,
    sort_by: sortBy,
    order,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  });

  const appeals = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setOrder("desc");
    }
    setPage(0);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === appeals.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(appeals.map((a) => a.id)));
    }
  };

  const handleBulkStatusChange = async () => {
    if (!bulkStatus || selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    try {
      await Promise.all(ids.map((id) => updateAppeal.mutateAsync({ id, updates: { status: bulkStatus } })));
      toast.success(`Статус изменён для ${ids.length} обращений`);
      setSelectedIds(new Set());
      setBulkStatus("");
    } catch {
      toast.error("Не удалось изменить статус некоторых обращений");
    }
  };

  const hasActiveFilters = statusFilter || categoryFilter || dateFrom || dateTo;

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 font-headline tracking-tight">Обращения</h1>
          <p className="text-sm text-slate-500 mt-1">
            {total} {total === 1 ? "обращение" : "обращений"}
            {searchQuery && (
              <span className="ml-2 inline-flex items-center gap-1 text-ktzh-blue font-medium">
                — поиск: «{searchQuery}»
                  <button
                    onClick={() => router.push("/appeals")}
                    className="ml-1 text-slate-500 hover:text-red-400 transition-colors"
                    aria-label="Сбросить поиск"
                  >✕</button>
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
          aria-label="Фильтр по статусу"
          className="h-9 rounded-lg border border-slate-200 bg-white pl-3 pr-8 text-sm text-slate-700 focus:border-ktzh-blue focus:outline-none focus:ring-1 focus:ring-ktzh-blue/20"
        >
          <option value="">Все статусы</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <select
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setPage(0); }}
          aria-label="Фильтр по категории"
          className="h-9 rounded-lg border border-slate-200 bg-white pl-3 pr-8 text-sm text-slate-700 focus:border-ktzh-blue focus:outline-none focus:ring-1 focus:ring-ktzh-blue/20"
        >
          <option value="">Все категории</option>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(0); }}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-ktzh-blue focus:outline-none focus:ring-1 focus:ring-ktzh-blue/20"
            aria-label="Дата от"
          />
          <span className="text-slate-400 text-xs" aria-hidden="true">—</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(0); }}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-ktzh-blue focus:outline-none focus:ring-1 focus:ring-ktzh-blue/20"
            aria-label="Дата до"
          />
        </div>

        {hasActiveFilters && (
          <button
            onClick={() => { setStatusFilter(""); setCategoryFilter(""); setDateFrom(""); setDateTo(""); setPage(0); }}
            className="h-9 px-3 text-xs font-medium text-slate-500 hover:text-ktzh-blue transition-colors"
          >
            Сбросить всё
          </button>
        )}
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 mb-4 bg-ktzh-dark/5 border border-ktzh-blue/20 rounded-lg px-4 py-2.5">
          <span className="text-sm font-semibold text-ktzh-dark">Выбрано: {selectedIds.size}</span>
          <div className="h-4 w-px bg-slate-300" />
          <select
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value)}
            className="h-8 rounded-lg border border-slate-200 bg-white pl-3 pr-8 text-sm text-slate-700 focus:border-ktzh-blue focus:outline-none"
          >
            <option value="">Изменить статус...</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <button
            onClick={handleBulkStatusChange}
            disabled={!bulkStatus || updateAppeal.isPending}
            className="h-8 px-4 bg-ktzh-dark text-white text-xs font-semibold rounded-lg disabled:opacity-40 hover:bg-ktzh-blue transition-colors"
          >
            Применить
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            Отмена
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        <table className="w-full" role="table" aria-label="Таблица обращений">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60">
              <th scope="col" className="pl-5 pr-2 py-3.5 w-8" aria-label="Выбрать все">
                <input
                  type="checkbox"
                  checked={appeals.length > 0 && selectedIds.size === appeals.length}
                  onChange={toggleSelectAll}
                  className="rounded border-slate-300 accent-ktzh-blue cursor-pointer"
                />
              </th>
              <SortableHeader label="Категория" field="category" sortBy={sortBy} order={order} onSort={handleSort} />
              <SortableHeader label="Статус" field="status" sortBy={sortBy} order={order} onSort={handleSort} />
              <th scope="col" className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 hidden lg:table-cell">Сообщение</th>
              <th scope="col" className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Поезд</th>
              <th scope="col" className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 hidden md:table-cell">Источник</th>
              <SortableHeader label="Дата" field="created_at" sortBy={sortBy} order={order} onSort={handleSort} />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="py-16 text-center">
                  <div className="inline-block h-6 w-6 animate-spin rounded-full border-[3px] border-ktzh-blue border-t-transparent" />
                </td>
              </tr>
            ) : isError ? (
              <tr>
                <td colSpan={7} className="py-16 text-center">
                  <span className="material-symbols-outlined text-3xl text-red-300 block mb-2">error</span>
                  <span className="text-sm text-red-400 block mb-3">Не удалось загрузить обращения</span>
                  <button onClick={() => window.location.reload()} className="text-xs text-ktzh-blue hover:underline">Повторить</button>
                </td>
              </tr>
            ) : appeals.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-20 text-center">
                  <span className="material-symbols-outlined text-3xl text-slate-200 block mb-2">inbox</span>
                  <span className="text-sm text-slate-400 block mb-4">Обращений не найдено</span>
                  <button
                    onClick={() => router.push("/appeals")}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-ktzh-dark text-white text-xs font-semibold rounded-lg hover:bg-ktzh-blue transition-colors"
                  >
                    <span className="material-symbols-outlined text-[14px]">add</span>
                    Создать обращение
                  </button>
                </td>
              </tr>
            ) : (
              appeals.map((appeal: Appeal) => (
                <tr
                  key={appeal.id}
                  className={cn(
                    "border-b border-slate-50 last:border-0 transition-colors",
                    selectedIds.has(appeal.id) ? "bg-ktzh-blue/[0.05]" : "hover:bg-ktzh-blue/[0.03]"
                  )}
                >
                  <td className="pl-5 pr-2 py-3.5" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(appeal.id)}
                      onChange={() => toggleSelect(appeal.id)}
                      className="rounded border-slate-300 accent-ktzh-blue cursor-pointer"
                    />
                  </td>
                  <td className="px-5 py-3.5 cursor-pointer" onClick={() => router.push(`/appeals/${appeal.id}`)}>
                    <span className={cn("inline-block rounded-md px-2.5 py-1 text-xs font-semibold", CATEGORY_COLORS[appeal.category] || "bg-slate-100 text-slate-600")}>
                      {CATEGORY_LABELS[appeal.category] || appeal.category}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 cursor-pointer" onClick={() => router.push(`/appeals/${appeal.id}`)}>
                    <span className={cn("inline-block rounded-md px-2.5 py-1 text-xs font-semibold", STATUS_COLORS[appeal.status] || "bg-slate-100 text-slate-600")}>
                      {STATUS_LABELS[appeal.status] || appeal.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 max-w-xs hidden lg:table-cell cursor-pointer" onClick={() => router.push(`/appeals/${appeal.id}`)}>
                    <div className="text-[13px] leading-snug line-clamp-2">
                      <MessagePreview text={appeal.client_message} />
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-slate-600 tabular-nums cursor-pointer" onClick={() => router.push(`/appeals/${appeal.id}`)}>
                    {appeal.train_number ?? "—"}
                  </td>
                  <td className="px-5 py-3.5 hidden md:table-cell cursor-pointer" onClick={() => router.push(`/appeals/${appeal.id}`)}>
                    <span className="text-xs text-slate-500">
                      {SOURCE_LABELS[appeal.source] || appeal.source}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-slate-500 whitespace-nowrap cursor-pointer" onClick={() => router.push(`/appeals/${appeal.id}`)}>
                    <time dateTime={appeal.created_at}>{formatDistanceToNow(new Date(appeal.created_at), { addSuffix: true, locale: ru })}</time>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-5 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Страница {page + 1} из {totalPages}
          </p>
          <nav className="flex gap-1.5" aria-label="Пагинация">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              aria-label="Предыдущая страница"
              className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">chevron_left</span>
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              aria-label="Следующая страница"
              className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">chevron_right</span>
            </button>
          </nav>
        </div>
      )}
    </div>
  );
}
