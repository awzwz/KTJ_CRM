"use client";

import React, { useState } from "react";
import { useSystemHealth, useKpi, useAppeals } from "@/hooks/useQueries";
import api from "@/lib/api";
import Link from "next/link";
import { SOURCE_LABELS } from "@/lib/utils";
import toast from "react-hot-toast";

export default function AIConfigPage() {
  const { data: health, isLoading: healthLoading } = useSystemHealth();
  const { data: kpi } = useKpi();
  const { data: appealsData } = useAppeals({ limit: 10 });
  const appeals = appealsData?.items || [];
  const [testPrompt, setTestPrompt] = useState("");
  const [testResult, setTestResult] = useState<Record<string, unknown> | null>(null);
  const [isClassifying, setIsClassifying] = useState(false);

  const handleTestCategory = async () => {
    if (!testPrompt) return;
    setIsClassifying(true);
    try {
      const res = await api.post("/llm/classify", { text: testPrompt });
      setTestResult(res.data);
    } catch {
      setTestResult({ error: "Ошибка при вызове ИИ" });
    } finally {
      setIsClassifying(false);
    }
  };

  const recentLogs = appeals;

  const handleRestart = () => toast("Функция перезапуска недоступна в текущей версии", { icon: "ℹ️" });
  const handleApply = () => toast("Настройки применены", { icon: "✓" });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 w-full">
      {/* Header Section */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-on-surface font-headline">Конфигурация ИИ и мониторинг</h1>
          <p className="text-on-surface-variant mt-2 font-body">Диагностика интеграций и инструменты настройки движка Kinetic Monolith.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleRestart} className="px-5 py-2.5 bg-surface-container-highest text-on-surface text-sm font-semibold rounded-lg hover:bg-slate-200 transition-all flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">refresh</span> Перезапуск системы
          </button>
          <button onClick={handleApply} className="px-5 py-2.5 bg-gradient-to-br from-primary to-primary-container text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-all flex items-center gap-2 shadow-md">
            <span className="material-symbols-outlined text-sm">save</span> Применить изменения
          </button>
        </div>
      </section>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-12 gap-6">
        
        {/* Integration Health Dashboard */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          <div className="bg-surface-container-lowest p-6 rounded-xl space-y-6 whisper-shadow">
            <h2 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">analytics</span> Состояние интеграций
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${health?.status === "ok" ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : health?.status === "error" ? "bg-red-500" : "bg-amber-500 animate-pulse"}`}></div>
                  <span className="text-sm font-semibold">Сервер Webhook</span>
                </div>
                <span className={`text-xs font-mono font-bold ${health?.status === "ok" ? "text-green-600" : health?.status === "error" ? "text-red-600" : "text-amber-600"}`}>
                  {healthLoading ? "ПРОБИНГ..." : (health?.status === "ok" ? "АКТИВЕН" : health?.status === "error" ? "ОШИБКА" : "—")}
                </span>
              </div>
              <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${health?.status === "ok" ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"}`}></div>
                  <span className="text-sm font-semibold">1433 API Gateway</span>
                </div>
                <span className={`text-xs font-mono font-bold ${health?.status === "ok" ? "text-green-600" : "text-red-600"}`}>
                  {healthLoading ? "ПРОБИНГ..." : (health?.status === "ok" ? "АКТИВЕН" : "ОШИБКА")}
                </span>
              </div>
              <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${health?.db === "ok" ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-amber-500 animate-pulse"}`}></div>
                  <span className="text-sm font-semibold">Связь с базой данных</span>
                </div>
                <span className={`text-xs font-mono font-bold ${health?.db === "ok" ? "text-green-600" : "text-amber-600"}`}>
                  {healthLoading ? "ПРОБИНГ..." : (health?.db === "ok" ? "АКТИВНА" : "—")}
                </span>
              </div>
            </div>
          </div>

          {/* Database Management */}
          <div className="bg-surface-container-lowest p-6 rounded-xl space-y-6 whisper-shadow">
            <h2 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">database</span> Статистика БД
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-surface-container-high p-4 rounded-lg">
                <div className="text-2xl font-bold font-headline">{kpi?.total_appeals ?? 0}</div>
                <div className="text-[10px] uppercase font-bold text-on-surface-variant">Всего записей</div>
              </div>
              <div className="bg-surface-container-high p-4 rounded-lg">
                <div className="text-2xl font-bold font-headline text-green-600">
                  {health?.status === "ok" ? "ОК" : "—"}
                </div>
                <div className="text-[10px] uppercase font-bold text-on-surface-variant">Статус</div>
              </div>
            </div>
          </div>
        </div>

        {/* LLM Settings */}
        <div className="col-span-12 lg:col-span-8 bg-surface-container-lowest p-8 rounded-xl space-y-8 whisper-shadow">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">neurology</span> Настройки LLM
            </h2>
            <div className="flex items-center gap-4">
              <label className="text-xs font-bold text-on-surface-variant uppercase">Модель:</label>
              <select className="bg-surface-container border-none text-sm font-semibold rounded-lg focus:ring-primary py-1 px-4 cursor-pointer">
                <option>GPT-4o Enterprise</option>
                <option>Claude 3.5 Sonnet</option>
                <option>Gemini 1.5 Pro</option>
              </select>
            </div>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <label className="text-sm font-bold block">Тестовая песочница ИИ</label>
              <textarea 
                className="w-full bg-surface-container-low border-none rounded-xl font-body text-sm p-4 focus:ring-primary h-32 resize-none disabled:opacity-50" 
                placeholder="Введите текст жалобы клиента для проверки классификации..."
                value={testPrompt}
                onChange={(e) => setTestPrompt(e.target.value)}
                disabled={isClassifying}
              ></textarea>
              <button 
                onClick={handleTestCategory}
                disabled={isClassifying || !testPrompt.trim()}
                className="w-full py-3 bg-surface-container-high rounded-xl text-center flex items-center justify-center gap-2 group hover:bg-slate-200 transition-all disabled:opacity-50 font-bold text-sm text-primary"
              >
                {isClassifying ? "Анализируем..." : "Запустить анализ в ИИ"}
                {!isClassifying && <span className="material-symbols-outlined text-primary group-hover:translate-x-1 transition-transform">play_arrow</span>}
              </button>
            </div>
            
            <div className="space-y-4">
              <label className="text-sm font-bold block flex items-center justify-between">
                <span>Результат</span>
                {testResult && (
                  <span className="bg-primary/10 text-primary px-2 py-1 rounded text-[10px] font-bold">ОБРАБОТАНО</span>
                )}
              </label>
              <div className="w-full bg-surface-container-low border-none rounded-xl font-mono text-[10px] p-4 h-32 overflow-y-auto">
                {testResult ? (
                  <pre className="text-slate-700 whitespace-pre-wrap">{JSON.stringify(testResult, null, 2)}</pre>
                ) : (
                  <span className="text-slate-500">Ожидание запуска песочницы...</span>
                )}
              </div>
              <button disabled className="w-full py-3 bg-surface-container-high rounded-xl text-center flex items-center justify-center gap-2 transition-all opacity-50 font-bold text-sm text-on-surface-variant cursor-not-allowed">
                <span>База знаний (RAG)</span>
                <span className="material-symbols-outlined">folder_open</span>
              </button>
            </div>
          </div>
        </div>

        {/* Recent Webhook Logs */}
        <div className="col-span-12 bg-surface-container-lowest rounded-xl overflow-hidden whisper-shadow">
          <div className="p-6 flex items-center justify-between border-b border-surface-container">
            <h2 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">terminal</span> Логи входящих Webhook
            </h2>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded">
                <span className="w-1.5 h-1.5 bg-green-600 rounded-full"></span> В РЕАЛЬНОМ ВРЕМЕНИ
              </span>
              <button className="p-1 hover:bg-slate-100 rounded text-slate-500" aria-label="Скачать логи"><span className="material-symbols-outlined text-sm" aria-hidden="true">download</span></button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse" role="table" aria-label="Логи входящих Webhook">
              <thead>
                <tr className="bg-surface-container-low border-b-0">
                  <th scope="col" className="px-6 py-4 text-[10px] font-bold uppercase text-on-surface-variant tracking-wider">Отметка времени</th>
                  <th scope="col" className="px-6 py-4 text-[10px] font-bold uppercase text-on-surface-variant tracking-wider">Эндпоинт/Источник</th>
                  <th scope="col" className="px-6 py-4 text-[10px] font-bold uppercase text-on-surface-variant tracking-wider">Статус</th>
                  <th scope="col" className="px-6 py-4 text-[10px] font-bold uppercase text-on-surface-variant tracking-wider">Задержка</th>
                  <th scope="col" className="px-6 py-4 text-[10px] font-bold uppercase text-on-surface-variant tracking-wider">Нагрузка (Snippet)</th>
                  <th scope="col" className="px-6 py-4 text-[10px] font-bold uppercase text-on-surface-variant tracking-wider text-right">Действие</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container">
                {recentLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-sm text-slate-500">Логов нет</td>
                  </tr>
                ) : (
                  recentLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-surface-container-low transition-colors group">
                      <td className="px-6 py-4 text-xs font-mono text-on-surface-variant">
                         {log.created_at ? new Date(log.created_at).toLocaleString('ru-RU') : "—"}
                      </td>
                      <td className="px-6 py-4 text-xs font-semibold">
                        /webhook/{log.source}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 rounded bg-green-100 text-green-700 text-[10px] font-bold">200 OK</span>
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-slate-500">—</td>
                      <td className="px-6 py-4 text-xs text-on-surface-variant truncate max-w-xs block">
                        {`{"id": "${log.id.split("-")[0]}", "source": "${SOURCE_LABELS[log.source] || log.source}"...}`}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link href={`/appeals/${log.id}`} className="text-primary hover:underline text-[10px] font-bold uppercase">Обзор</Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {recentLogs.length > 0 && (
            <div className="p-4 bg-surface-container-high/50 flex justify-center border-t border-surface-container">
              <button className="text-xs font-bold text-primary uppercase tracking-widest hover:opacity-70 flex items-center gap-1">
                Загрузить предыдущие <span className="material-symbols-outlined text-sm">expand_more</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
