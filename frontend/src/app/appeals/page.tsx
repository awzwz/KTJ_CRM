"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Filter, ChevronLeft, ChevronRight } from "lucide-react";
import api from "@/lib/api";
import {
  cn,
  STATUS_LABELS,
  CATEGORY_LABELS,
  STATUS_COLORS,
  CATEGORY_COLORS,
} from "@/lib/utils";

interface Appeal {
  id: string;
  category: string;
  subcategory: string | null;
  status: string;
  source: string;
  train_number: number | null;
  client_phone: string | null;
  assigned_to: string | null;
  branch_id: string | null;
  created_at: string;
}

interface AppealsResponse {
  items: Appeal[];
  total: number;
}

export default function AppealsPage() {
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const limit = 20;

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("skip", String(page * limit));
    params.set("limit", String(limit));
    if (statusFilter) params.set("status", statusFilter);
    if (categoryFilter) params.set("category", categoryFilter);

    setLoading(true);
    setError(null);
    api
      .get<AppealsResponse>(`/appeals?${params}`)
      .then((r) => {
        setAppeals(r.data.items);
        setTotal(r.data.total);
      })
      .catch(() => {
        setError("Не удалось загрузить обращения. Проверьте подключение к серверу.");
      })
      .finally(() => setLoading(false));
  }, [page, statusFilter, categoryFilter]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Обращения</h1>
        <span className="text-sm text-gray-500">Всего: {total}</span>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(0);
            }}
            className="rounded-lg border border-gray-300 py-2 pl-9 pr-8 text-sm focus:border-ktzh-blue focus:outline-none"
          >
            <option value="">Все статусы</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(0);
            }}
            className="rounded-lg border border-gray-300 py-2 pl-9 pr-8 text-sm focus:border-ktzh-blue focus:outline-none"
          >
            <option value="">Все категории</option>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Категория
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Статус
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Поезд
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Телефон
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Источник
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Дата
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {appeals.map((appeal) => (
              <tr
                key={appeal.id}
                className="transition-colors hover:bg-gray-50"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/appeals/${appeal.id}`}
                    className="inline-block"
                  >
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-xs font-medium",
                        CATEGORY_COLORS[appeal.category] || "bg-gray-100 text-gray-800",
                      )}
                    >
                      {CATEGORY_LABELS[appeal.category] || appeal.category}
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-medium",
                      STATUS_COLORS[appeal.status] || "bg-gray-100 text-gray-800",
                    )}
                  >
                    {STATUS_LABELS[appeal.status] || appeal.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {appeal.train_number || "—"}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {appeal.client_phone || "—"}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {appeal.source === "whatsapp" ? "WhatsApp" : "1433"}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {new Date(appeal.created_at).toLocaleDateString("ru-RU", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
              </tr>
            ))}
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center">
                  <div className="inline-block h-6 w-6 animate-spin rounded-full border-4 border-ktzh-blue border-t-transparent" />
                </td>
              </tr>
            )}
            {error && !loading && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-red-500">
                  {error}
                </td>
              </tr>
            )}
            {!loading && !error && appeals.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-400">
                  Обращений не найдено
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Страница {page + 1} из {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded-lg border border-gray-300 p-2 text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="rounded-lg border border-gray-300 p-2 text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
