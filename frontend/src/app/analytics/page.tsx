"use client";

import { useEffect, useState } from "react";
import {
  BarChart3,
  TrendingUp,
  Clock,
  Users,
  Train,
  Building2,
  Timer,
} from "lucide-react";
import api from "@/lib/api";
import { CATEGORY_LABELS, CATEGORY_COLORS, cn } from "@/lib/utils";

interface KPI {
  total_appeals: number;
  resolved_count: number;
  new_count: number;
  in_progress_count: number;
  avg_response_time_seconds: number | null;
  avg_resolution_time_seconds: number | null;
}

interface Summary {
  by_status: Record<string, number>;
  by_category: Record<string, number>;
}

interface TopTrain {
  train_number: number;
  appeal_count: number;
  complaint_count: number;
  gratitude_count: number;
}

interface BranchStat {
  branch_name: string;
  branch_code: string;
  total: number;
  new_count: number;
  in_progress_count: number;
  resolved_count: number;
}

interface OperatorStat {
  operator_id: string;
  full_name: string;
  role: string;
  assigned_total: number;
  resolved_count: number;
  avg_response_seconds: number | null;
}

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return "—";
  if (seconds < 60) return `${Math.round(seconds)} сек`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} мин`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.round((seconds % 3600) / 60);
  return `${hours} ч ${mins} мин`;
}

export default function AnalyticsPage() {
  const [kpi, setKpi] = useState<KPI | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [topTrains, setTopTrains] = useState<TopTrain[]>([]);
  const [branches, setBranches] = useState<BranchStat[]>([]);
  const [operators, setOperators] = useState<OperatorStat[]>([]);

  useEffect(() => {
    api.get("/analytics/dashboard/kpi").then((r) => setKpi(r.data)).catch(() => {});
    api.get("/analytics/dashboard/summary").then((r) => setSummary(r.data)).catch(() => {});
    api.get("/analytics/dashboard/top-trains?limit=10").then((r) => setTopTrains(r.data)).catch(() => {});
    api.get("/analytics/dashboard/by-branch").then((r) => setBranches(r.data)).catch(() => {});
    api.get("/analytics/dashboard/operator-performance").then((r) => setOperators(r.data)).catch(() => {});
  }, []);

  const resolutionRate =
    kpi && kpi.total_appeals > 0
      ? Math.round((kpi.resolved_count / kpi.total_appeals) * 100)
      : 0;

  return (
    <div>
      <h1 className="mb-8 text-2xl font-bold text-gray-900">Аналитика</h1>

      {/* KPI Cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {[
          { label: "Всего", value: kpi?.total_appeals, icon: BarChart3, bg: "bg-blue-100", fg: "text-blue-600" },
          { label: "Новые", value: kpi?.new_count, icon: Clock, bg: "bg-amber-100", fg: "text-amber-600" },
          { label: "В работе", value: kpi?.in_progress_count, icon: Users, bg: "bg-purple-100", fg: "text-purple-600" },
          { label: "Решено", value: `${kpi?.resolved_count ?? "—"} (${resolutionRate}%)`, icon: TrendingUp, bg: "bg-green-100", fg: "text-green-600" },
          { label: "Ср. ответ", value: formatDuration(kpi?.avg_response_time_seconds ?? null), icon: Timer, bg: "bg-cyan-100", fg: "text-cyan-600" },
          { label: "Ср. решение", value: formatDuration(kpi?.avg_resolution_time_seconds ?? null), icon: Timer, bg: "bg-rose-100", fg: "text-rose-600" },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", card.bg)}>
                <card.icon className={cn("h-5 w-5", card.fg)} />
              </div>
              <div>
                <p className="text-xs text-gray-500">{card.label}</p>
                <p className="text-lg font-bold text-gray-900">{card.value ?? "—"}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Categories */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">По категориям</h2>
          {summary?.by_category ? (
            <div className="space-y-3">
              {Object.entries(summary.by_category).map(([cat, count]) => {
                const max = Math.max(...Object.values(summary.by_category), 1);
                return (
                  <div key={cat}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", CATEGORY_COLORS[cat] || "bg-gray-100 text-gray-800")}>
                        {CATEGORY_LABELS[cat] || cat}
                      </span>
                      <span className="text-sm font-semibold">{count}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full rounded-full bg-ktzh-blue transition-all" style={{ width: `${(count / max) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400">Загрузка...</p>
          )}
        </div>

        {/* Top Trains */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Train className="h-5 w-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Топ поездов по обращениям</h2>
          </div>
          {topTrains.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-gray-100">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 text-xs uppercase text-gray-500">
                    <th className="px-3 py-2 text-left">Поезд</th>
                    <th className="px-3 py-2 text-right">Всего</th>
                    <th className="px-3 py-2 text-right">Жалоб</th>
                    <th className="px-3 py-2 text-right">Благодарн.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {topTrains.map((t) => (
                    <tr key={t.train_number} className="text-sm">
                      <td className="px-3 py-2 font-medium text-gray-900">#{t.train_number}</td>
                      <td className="px-3 py-2 text-right">{t.appeal_count}</td>
                      <td className="px-3 py-2 text-right text-red-600">{t.complaint_count}</td>
                      <td className="px-3 py-2 text-right text-green-600">{t.gratitude_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-400">Нет данных</p>
          )}
        </div>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* By Branch */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Нагрузка по филиалам</h2>
          </div>
          {branches.length > 0 ? (
            <div className="space-y-3">
              {branches.filter((b) => b.total > 0).map((b) => {
                const max = Math.max(...branches.map((x) => x.total), 1);
                return (
                  <div key={b.branch_code}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm text-gray-700">{b.branch_name}</span>
                      <div className="flex gap-3 text-xs">
                        <span className="text-blue-600">{b.new_count} нов.</span>
                        <span className="text-yellow-600">{b.in_progress_count} в раб.</span>
                        <span className="text-green-600">{b.resolved_count} реш.</span>
                        <span className="font-semibold">{b.total}</span>
                      </div>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full rounded-full bg-ktzh-blue transition-all" style={{ width: `${(b.total / max) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
              {branches.every((b) => b.total === 0) && (
                <p className="text-sm text-gray-400">Нет назначенных обращений</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400">Нет данных</p>
          )}
        </div>

        {/* Operator Performance */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Эффективность операторов</h2>
          </div>
          {operators.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-gray-100">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 text-xs uppercase text-gray-500">
                    <th className="px-3 py-2 text-left">Оператор</th>
                    <th className="px-3 py-2 text-right">Назначено</th>
                    <th className="px-3 py-2 text-right">Решено</th>
                    <th className="px-3 py-2 text-right">Ср. ответ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {operators.map((op) => (
                    <tr key={op.operator_id} className="text-sm">
                      <td className="px-3 py-2 font-medium text-gray-900">{op.full_name}</td>
                      <td className="px-3 py-2 text-right">{op.assigned_total}</td>
                      <td className="px-3 py-2 text-right text-green-600">{op.resolved_count}</td>
                      <td className="px-3 py-2 text-right text-gray-500">
                        {formatDuration(op.avg_response_seconds)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-400">Нет данных</p>
          )}
        </div>
      </div>
    </div>
  );
}
