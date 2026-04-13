"use client";

import React, { useState } from "react";
import { useKpi, useSummary, useTopTrains, useTimeline } from "@/hooks/useQueries";
import { formatSeconds, CATEGORY_LABELS, CATEGORY_HEX_COLORS } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";


export default function AnalyticsPage() {
  const queryClient = useQueryClient();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: kpi, isLoading } = useKpi();
  const { data: summary } = useSummary();
  const { data: topTrains = [] } = useTopTrains(5);
  const { data: timeline = [] } = useTimeline(14, dateFrom || undefined, dateTo || undefined);

  const resolutionRate =
    kpi && kpi.total_appeals > 0
      ? ((kpi.resolved_count / kpi.total_appeals) * 100).toFixed(1)
      : "0.0";

  const categoryData = summary?.by_category || {};
  const categoryTotal = Object.values(categoryData).reduce((a, b) => a + b, 0);
  const categoryEntries = Object.entries(categoryData).sort((a, b) => b[1] - a[1]);

  const maxTrainCount = topTrains.length > 0 ? topTrains[0].complaint_count : 1;

  const timelineMax = timeline.length > 0 ? Math.max(...timeline.map((t) => t.total), 1) : 1;

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["analytics"] });
  };

  const handleExport = () => {
    const rows = [["Дата", "Всего", "Жалобы", "Благодарности"]];
    timeline.forEach((t) => rows.push([t.day, String(t.total), String(t.complaints), String(t.gratitudes)]));
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ktzh-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-2xl font-extrabold font-headline text-slate-900 tracking-tight">Аналитика</h1>
          <p className="text-sm text-slate-500 mt-1">Статистика и KPI по обращениям</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-ktzh-blue focus:outline-none focus:ring-1 focus:ring-ktzh-blue/20"
              aria-label="Дата от"
            />
            <span className="text-slate-400 text-xs" aria-hidden="true">—</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-ktzh-blue focus:outline-none focus:ring-1 focus:ring-ktzh-blue/20"
              aria-label="Дата до"
            />
            {(dateFrom || dateTo) && (
              <button
                onClick={() => { setDateFrom(""); setDateTo(""); }}
                className="h-9 px-2 text-xs text-slate-500 hover:text-ktzh-blue transition-colors"
                aria-label="Сбросить фильтр дат"
              >✕</button>
            )}
          </div>
          <button
            onClick={handleExport}
            className="h-9 px-4 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Экспорт CSV
          </button>
          <button
            onClick={handleRefresh}
            className="h-9 px-4 rounded-lg bg-ktzh-dark text-white text-xs font-semibold hover:bg-ktzh-blue transition-colors flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            Обновить
          </button>
        </div>
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
          <div className="text-3xl font-extrabold text-slate-900 font-headline">
            {isLoading ? "..." : kpi?.total_appeals ?? "0"}
          </div>
        </div>

        <div className="bg-ktzh-dark rounded-xl shadow-sm p-5 text-white">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px] text-white/80" aria-hidden="true">fiber_new</span>
            </div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-white/60">Новые</span>
          </div>
          <div className="text-3xl font-extrabold font-headline">{kpi?.new_count ?? "0"}</div>
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

      <div className="grid grid-cols-12 gap-6 mb-6">
        {/* Timeline chart */}
        <div className="col-span-12 lg:col-span-8 bg-white rounded-xl border border-slate-200/80 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-bold text-slate-700">Обращения за 14 дней</h3>
              <p className="text-xs text-slate-500 mt-0.5">Входящий поток по дням</p>
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-ktzh-dark"></span>
                <span className="text-[10px] font-semibold text-slate-500 uppercase">Всего</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400" aria-hidden="true"></span>
                <span className="text-[10px] font-semibold text-slate-500 uppercase">Жалобы</span>
              </div>
            </div>
          </div>

          {timeline.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-sm text-slate-300">Нет данных</div>
          ) : (
            <div className="h-48 flex items-end gap-1.5">
              {timeline.map((point) => {
                const totalH = (point.total / timelineMax) * 100;
                const complaintH = (point.complaints / timelineMax) * 100;
                const dayLabel = point.day.slice(5);
                return (
                  <div key={point.day} className="flex-1 flex flex-col items-center gap-1 group relative">
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-0.5 rounded hidden group-hover:block whitespace-nowrap z-10">
                      {point.total} обр. / {point.complaints} жал.
                    </div>
                    <div className="w-full flex flex-col items-center" style={{ height: "100%" }}>
                      <div className="w-full flex-1" />
                      <div className="w-full rounded-t bg-ktzh-dark/20 relative" style={{ height: `${totalH}%`, minHeight: point.total > 0 ? "4px" : "0" }}>
                        <div className="absolute bottom-0 left-0 right-0 bg-red-400/60 rounded-t" style={{ height: `${complaintH > 0 ? (complaintH / totalH) * 100 : 0}%`, minHeight: point.complaints > 0 ? "2px" : "0" }} />
                      </div>
                    </div>
                    <span className="text-[8px] font-semibold text-slate-300 mt-1">{dayLabel}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Category distribution */}
        <div className="col-span-12 lg:col-span-4 bg-white rounded-xl border border-slate-200/80 shadow-sm p-6">
          <h3 className="text-sm font-bold text-slate-700 mb-1">По категориям</h3>
          <p className="text-xs text-slate-500 mb-6">Распределение обращений</p>

          {categoryTotal === 0 ? (
            <div className="h-40 flex items-center justify-center text-sm text-slate-300">Нет данных</div>
          ) : (
            <div className="space-y-4">
              {categoryEntries.map(([cat, count]) => {
                const pct = ((count / categoryTotal) * 100).toFixed(1);
                return (
                  <div key={cat}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CATEGORY_HEX_COLORS[cat] || "#94a3b8" }} />
                        <span className="text-xs font-semibold text-slate-600">{CATEGORY_LABELS[cat] || cat}</span>
                      </div>
                      <span className="text-xs font-bold text-slate-800">{count} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: CATEGORY_HEX_COLORS[cat] || "#94a3b8" }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Top trains & status breakdown */}
      <div className="grid grid-cols-12 gap-6">
        {/* Top trains */}
        <div className="col-span-12 lg:col-span-6 bg-white rounded-xl border border-slate-200/80 shadow-sm p-6">
          <h3 className="text-sm font-bold text-slate-700 mb-1">Топ поездов по жалобам</h3>
          <p className="text-xs text-slate-500 mb-6">Поезда с наибольшим количеством жалоб</p>

          {topTrains.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-sm text-slate-300">Нет данных</div>
          ) : (
            <div className="space-y-5">
              {topTrains.map((t, i) => {
                const pct = (t.complaint_count / maxTrainCount) * 100;
                return (
                  <div key={t.train_number}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-300 w-4">{i + 1}</span>
                        <span className="text-xs font-semibold text-slate-700">Поезд № {t.train_number}</span>
                      </div>
                      <span className="text-xs font-bold text-slate-800">{t.complaint_count} жал.</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-ktzh-dark transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Status breakdown */}
        <div className="col-span-12 lg:col-span-6 bg-white rounded-xl border border-slate-200/80 shadow-sm p-6">
          <h3 className="text-sm font-bold text-slate-700 mb-1">По статусам</h3>
          <p className="text-xs text-slate-500 mb-6">Распределение по текущему статусу</p>

          {!summary?.by_status || Object.keys(summary.by_status).length === 0 ? (
            <div className="h-40 flex items-center justify-center text-sm text-slate-300">Нет данных</div>
          ) : (
            <div className="space-y-4">
              {Object.entries(summary.by_status).sort((a, b) => b[1] - a[1]).map(([status, count]) => {
                const statusTotal = Object.values(summary.by_status).reduce((a, b) => a + b, 0);
                const pct = ((count / statusTotal) * 100).toFixed(1);
                const STATUS_LABELS: Record<string, string> = { new: "Новое", in_progress: "В работе", on_review: "На проверке", resolved: "Решено", closed: "Закрыто" };
                const STATUS_DOT_COLORS: Record<string, string> = { new: "#3b82f6", in_progress: "#eab308", on_review: "#a855f7", resolved: "#22c55e", closed: "#6b7280" };
                return (
                  <div key={status} className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: STATUS_DOT_COLORS[status] || "#94a3b8" }} />
                    <span className="text-xs font-semibold text-slate-600 w-24">{STATUS_LABELS[status] || status}</span>
                    <div className="flex-1 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: STATUS_DOT_COLORS[status] || "#94a3b8" }}
                      />
                    </div>
                    <span className="text-xs font-bold text-slate-800 w-16 text-right">{count} ({pct}%)</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
