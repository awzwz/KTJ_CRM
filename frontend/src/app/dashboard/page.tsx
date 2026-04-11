"use client";

import { useEffect, useState } from "react";
import {
  MessageSquare,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from "lucide-react";
import api from "@/lib/api";
import { CATEGORY_LABELS, STATUS_LABELS } from "@/lib/utils";

interface DashboardSummary {
  by_status: Record<string, number>;
  by_category: Record<string, number>;
}

interface KPI {
  total_appeals: number;
  resolved_count: number;
  avg_response_time_seconds: number | null;
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [kpi, setKpi] = useState<KPI | null>(null);

  useEffect(() => {
    api.get("/analytics/dashboard/summary").then((r) => setSummary(r.data)).catch(() => {});
    api.get("/analytics/dashboard/kpi").then((r) => setKpi(r.data)).catch(() => {});
  }, []);

  const statCards = [
    {
      label: "Всего обращений",
      value: kpi?.total_appeals ?? "—",
      icon: MessageSquare,
      color: "bg-blue-500",
    },
    {
      label: "Решено",
      value: kpi?.resolved_count ?? "—",
      icon: CheckCircle2,
      color: "bg-green-500",
    },
    {
      label: "Ср. время ответа",
      value: kpi?.avg_response_time_seconds
        ? `${Math.round(kpi.avg_response_time_seconds / 60)} мин`
        : "—",
      icon: Clock,
      color: "bg-yellow-500",
    },
    {
      label: "Новые",
      value: summary?.by_status?.new ?? "—",
      icon: AlertTriangle,
      color: "bg-red-500",
    },
  ];

  return (
    <div>
      <h1 className="mb-8 text-2xl font-bold text-gray-900">Дашборд</h1>

      <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{card.label}</p>
                <p className="mt-1 text-3xl font-bold text-gray-900">
                  {card.value}
                </p>
              </div>
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-xl ${card.color}`}
              >
                <card.icon className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            По статусам
          </h2>
          {summary?.by_status ? (
            <div className="space-y-3">
              {Object.entries(summary.by_status).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">
                    {STATUS_LABELS[status] || status}
                  </span>
                  <span className="text-sm font-semibold text-gray-900">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">Загрузка...</p>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            По категориям
          </h2>
          {summary?.by_category ? (
            <div className="space-y-3">
              {Object.entries(summary.by_category).map(([cat, count]) => (
                <div key={cat} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">
                    {CATEGORY_LABELS[cat] || cat}
                  </span>
                  <span className="text-sm font-semibold text-gray-900">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">Загрузка...</p>
          )}
        </div>
      </div>
    </div>
  );
}
