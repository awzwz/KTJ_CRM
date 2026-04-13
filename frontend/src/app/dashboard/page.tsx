"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppeals, useKpi, type Appeal } from "@/hooks/useQueries";
import { STATUS_LABELS, CATEGORY_LABELS, STATUS_COLORS, CATEGORY_COLORS, SOURCE_LABELS, formatSeconds, cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";

export default function DashboardPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const { data: appealsData, isLoading } = useAppeals({
    limit: 30,
    status: statusFilter || undefined,
    category: categoryFilter || undefined,
  });
  const { data: kpi } = useKpi();

  const appeals = appealsData?.items || [];
  const total = appealsData?.total || 0;

  const resolutionRate =
    kpi && kpi.total_appeals > 0
      ? ((kpi.resolved_count / kpi.total_appeals) * 100).toFixed(1)
      : "0";

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-extrabold font-headline text-slate-900 tracking-tight">
          Панель управления
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Мониторинг обращений и классификация ИИ
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px] text-slate-500">inbox</span>
            </div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Всего</span>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 font-headline">{kpi?.total_appeals ?? "—"}</div>
        </div>

        <div className="bg-ktzh-dark rounded-xl shadow-sm p-5 text-white">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px] text-white/80" aria-hidden="true">fiber_new</span>
            </div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-white/60">Новые</span>
          </div>
          <div className="text-3xl font-extrabold font-headline">{kpi?.new_count ?? "—"}</div>
          <div className="mt-2 text-xs text-white/50">В работе: {kpi?.in_progress_count ?? 0}</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px] text-ktzh-blue">schedule</span>
            </div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Время ответа</span>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 font-headline">
            {formatSeconds(kpi?.avg_response_time_seconds)}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px] text-emerald-600">check_circle</span>
            </div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Решено</span>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 font-headline">{resolutionRate}%</div>
          <div className="mt-2 text-xs text-slate-500">{kpi?.resolved_count ?? 0} из {kpi?.total_appeals ?? 0}</div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-bold text-slate-700">Последние обращения</h3>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "h-8 px-3 rounded-lg text-xs font-medium border transition-colors",
              showFilters || statusFilter || categoryFilter
                ? "border-ktzh-blue text-ktzh-blue bg-blue-50/50"
                : "border-slate-200 text-slate-500 hover:border-slate-300"
            )}
          >
            <span className="material-symbols-outlined text-[14px] align-middle mr-1">filter_list</span>
            Фильтр
          </button>
          {(statusFilter || categoryFilter) && (
            <button onClick={() => { setStatusFilter(""); setCategoryFilter(""); }} className="text-xs text-slate-400 hover:text-ktzh-blue">
              Сбросить
            </button>
          )}
        </div>
        <span className="text-xs text-slate-500">{total} обращений</span>
      </div>

      {showFilters && (
        <div className="flex gap-3 mb-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white pl-3 pr-8 text-sm text-slate-600 focus:border-ktzh-blue focus:outline-none"
          >
            <option value="">Все статусы</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white pl-3 pr-8 text-sm text-slate-600 focus:border-ktzh-blue focus:outline-none"
          >
            <option value="">Все категории</option>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        <table className="w-full" role="table" aria-label="Последние обращения">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60">
              <th scope="col" className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">ID</th>
              <th scope="col" className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Тип</th>
              <th scope="col" className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 hidden lg:table-cell">Сообщение</th>
              <th scope="col" className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Статус</th>
              <th scope="col" className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 hidden md:table-cell">Источник</th>
              <th scope="col" className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Создано</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="py-16 text-center">
                <div className="inline-block h-6 w-6 animate-spin rounded-full border-[3px] border-ktzh-blue border-t-transparent" />
              </td></tr>
            ) : appeals.length === 0 ? (
              <tr><td colSpan={6} className="py-20 text-center">
                <span className="material-symbols-outlined text-3xl text-slate-200 block mb-2">inbox</span>
                <span className="text-sm text-slate-400 block mb-4">Обращений пока нет</span>
                <button
                  onClick={() => router.push("/appeals")}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-ktzh-dark text-white text-xs font-semibold rounded-lg hover:bg-ktzh-blue transition-colors"
                >
                  <span className="material-symbols-outlined text-[14px]">add</span>
                  Создать обращение
                </button>
              </td></tr>
            ) : (
              appeals.map((appeal: Appeal) => (
                <tr
                  key={appeal.id}
                  onClick={() => router.push(`/appeals/${appeal.id}`)}
                  className="border-b border-slate-50 last:border-0 hover:bg-ktzh-blue/[0.03] cursor-pointer transition-colors"
                >
                  <td className="px-5 py-3.5">
                    <span className="text-sm font-semibold text-ktzh-blue">#{appeal.id.split("-")[0]}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={cn("inline-block rounded-md px-2.5 py-1 text-xs font-semibold", CATEGORY_COLORS[appeal.category] || "bg-slate-100 text-slate-600")}>
                      {CATEGORY_LABELS[appeal.category] || appeal.category}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 max-w-xs hidden lg:table-cell">
                    <p className="text-[13px] text-slate-500 leading-snug line-clamp-1">
                      {appeal.client_message || <span className="italic text-slate-300">Нет текста</span>}
                    </p>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={cn("inline-block rounded-md px-2.5 py-1 text-xs font-semibold", STATUS_COLORS[appeal.status] || "bg-slate-100 text-slate-600")}>
                      {STATUS_LABELS[appeal.status] || appeal.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 hidden md:table-cell">
                    <span className="text-xs text-slate-500">{SOURCE_LABELS[appeal.source] || appeal.source}</span>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                    <time dateTime={appeal.created_at}>{formatDistanceToNow(new Date(appeal.created_at), { addSuffix: true, locale: ru })}</time>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Bottom KPI summary */}
      <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-surface-container-lowest p-6 rounded-2xl whisper-shadow">
          <div className="flex justify-between items-center mb-6">
            <h4 className="font-headline font-bold text-primary">Статус обращений</h4>
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <span className="text-[10px] font-bold w-20 text-on-surface-variant uppercase">Новые</span>
              <div className="flex-1 bg-surface-container h-2 rounded-full overflow-hidden">
                <div className="bg-blue-500 h-full transition-all duration-500" style={{ width: kpi?.total_appeals ? `${(kpi.new_count / kpi.total_appeals) * 100}%` : "0%" }} />
              </div>
              <span className="text-[10px] font-bold text-on-surface w-8 text-right">{kpi?.new_count ?? 0}</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-[10px] font-bold w-20 text-on-surface-variant uppercase">В работе</span>
              <div className="flex-1 bg-surface-container h-2 rounded-full overflow-hidden">
                <div className="bg-yellow-500 h-full transition-all duration-500" style={{ width: kpi?.total_appeals ? `${(kpi.in_progress_count / kpi.total_appeals) * 100}%` : "0%" }} />
              </div>
              <span className="text-[10px] font-bold text-on-surface w-8 text-right">{kpi?.in_progress_count ?? 0}</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-[10px] font-bold w-20 text-on-surface-variant uppercase">Решено</span>
              <div className="flex-1 bg-surface-container h-2 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: kpi?.total_appeals ? `${(kpi.resolved_count / kpi.total_appeals) * 100}%` : "0%" }} />
              </div>
              <span className="text-[10px] font-bold text-on-surface w-8 text-right">{kpi?.resolved_count ?? 0}</span>
            </div>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-6 rounded-2xl whisper-shadow">
          <div className="flex justify-between items-center mb-6">
            <h4 className="font-headline font-bold text-primary">Показатели скорости</h4>
          </div>
          <div className="flex items-center justify-around">
            <div className="text-center">
              <p className="text-[10px] font-bold text-on-surface-variant uppercase">Ср. время ответа</p>
              <p className="text-2xl font-black font-headline text-primary">{formatSeconds(kpi?.avg_response_time_seconds)}</p>
            </div>
            <div className="h-10 w-[1px] bg-slate-200"></div>
            <div className="text-center">
              <p className="text-[10px] font-bold text-on-surface-variant uppercase">Ср. время решения</p>
              <p className="text-2xl font-black font-headline text-primary">{formatSeconds(kpi?.avg_resolution_time_seconds)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
