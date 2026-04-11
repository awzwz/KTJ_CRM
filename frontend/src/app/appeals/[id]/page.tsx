"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, User, Train, Calendar, MessageSquare } from "lucide-react";
import api from "@/lib/api";
import {
  cn,
  STATUS_LABELS,
  CATEGORY_LABELS,
  STATUS_COLORS,
  CATEGORY_COLORS,
} from "@/lib/utils";

interface AppealDetail {
  id: string;
  category: string;
  subcategory: string | null;
  status: string;
  source: string;
  train_number: number | null;
  event_date: string | null;
  language: string;
  client_phone: string | null;
  client_message: string | null;
  auto_response: string | null;
  car_number: number | null;
  seat_number: number | null;
  station_name: string | null;
  cashier_name: string | null;
  item_description: string | null;
  ticket_number: string | null;
  assigned_to: string | null;
  branch_id: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export default function AppealDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [appeal, setAppeal] = useState<AppealDetail | null>(null);
  const [newStatus, setNewStatus] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    api.get(`/appeals/${id}`).then((r) => {
      setAppeal(r.data);
      setNewStatus(r.data.status);
    }).catch((err) => {
      if (err.response?.status === 404) {
        setError("Обращение не найдено");
      } else {
        setError("Ошибка загрузки обращения. Попробуйте позже.");
      }
    });
  }, [id, router]);

  const handleStatusChange = async () => {
    if (!appeal || newStatus === appeal.status) return;
    try {
      const { data } = await api.patch(`/appeals/${id}`, { status: newStatus });
      setAppeal(data);
    } catch { /* handled by interceptor */ }
  };

  if (error) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <p className="text-sm text-red-500">{error}</p>
        <button
          onClick={() => router.push("/appeals")}
          className="rounded-lg bg-ktzh-blue px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-ktzh-dark"
        >
          Назад к списку
        </button>
      </div>
    );
  }

  if (!appeal) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-ktzh-blue border-t-transparent" />
      </div>
    );
  }

  const infoItems = [
    { icon: Train, label: "Поезд", value: appeal.train_number },
    { icon: Calendar, label: "Дата события", value: appeal.event_date },
    { icon: User, label: "Телефон", value: appeal.client_phone },
    { icon: MessageSquare, label: "Источник", value: appeal.source === "whatsapp" ? "WhatsApp" : "1433" },
  ];

  return (
    <div>
      <button
        onClick={() => router.push("/appeals")}
        className="mb-6 flex items-center gap-2 text-sm text-gray-600 transition-colors hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" /> Назад к списку
      </button>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <span
              className={cn(
                "rounded-full px-3 py-1 text-sm font-medium",
                CATEGORY_COLORS[appeal.category],
              )}
            >
              {CATEGORY_LABELS[appeal.category] || appeal.category}
            </span>
            <span
              className={cn(
                "rounded-full px-3 py-1 text-sm font-medium",
                STATUS_COLORS[appeal.status],
              )}
            >
              {STATUS_LABELS[appeal.status] || appeal.status}
            </span>
          </div>
          <p className="text-xs text-gray-500">
            ID: {appeal.id}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-ktzh-blue focus:outline-none"
          >
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <button
            onClick={handleStatusChange}
            disabled={newStatus === appeal.status}
            className="rounded-lg bg-ktzh-blue px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-ktzh-dark disabled:opacity-40"
          >
            Обновить
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Сообщение клиента
            </h2>
            <p className="whitespace-pre-wrap text-sm text-gray-700">
              {appeal.client_message || "Текст обращения не указан"}
            </p>
          </div>

          {appeal.auto_response && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                Автоответ
              </h2>
              <p className="whitespace-pre-wrap text-sm text-gray-700">
                {appeal.auto_response}
              </p>
            </div>
          )}

          {appeal.item_description && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                Описание забытой вещи
              </h2>
              <p className="text-sm text-gray-700">{appeal.item_description}</p>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Информация
            </h2>
            <dl className="space-y-3">
              {infoItems.map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <item.icon className="h-4 w-4 text-gray-400" />
                  <dt className="text-sm text-gray-500">{item.label}:</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    {item.value || "—"}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {(appeal.car_number || appeal.seat_number || appeal.station_name || appeal.cashier_name || appeal.ticket_number) && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                Дополнительно
              </h2>
              <dl className="space-y-2">
                {appeal.car_number && (
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500">Вагон</dt>
                    <dd className="text-sm font-medium">{appeal.car_number}</dd>
                  </div>
                )}
                {appeal.seat_number && (
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500">Место</dt>
                    <dd className="text-sm font-medium">{appeal.seat_number}</dd>
                  </div>
                )}
                {appeal.station_name && (
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500">Вокзал</dt>
                    <dd className="text-sm font-medium">{appeal.station_name}</dd>
                  </div>
                )}
                {appeal.cashier_name && (
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500">Кассир</dt>
                    <dd className="text-sm font-medium">{appeal.cashier_name}</dd>
                  </div>
                )}
                {appeal.ticket_number && (
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500">Номер билета</dt>
                    <dd className="text-sm font-medium">{appeal.ticket_number}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Временные метки
            </h2>
            <dl className="space-y-2">
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Создано</dt>
                <dd className="text-sm font-medium">
                  {new Date(appeal.created_at).toLocaleString("ru-RU")}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Обновлено</dt>
                <dd className="text-sm font-medium">
                  {new Date(appeal.updated_at).toLocaleString("ru-RU")}
                </dd>
              </div>
              {appeal.resolved_at && (
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Решено</dt>
                  <dd className="text-sm font-medium">
                    {new Date(appeal.resolved_at).toLocaleString("ru-RU")}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
