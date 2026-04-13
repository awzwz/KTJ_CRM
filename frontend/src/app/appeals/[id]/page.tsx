"use client";

import React, { use, useState, useEffect, useRef } from "react";
import { useAppeal, useUpdateAppeal, useAppealHistory, useBranches } from "@/hooks/useQueries";
import { STATUS_LABELS, CATEGORY_LABELS, STATUS_COLORS, CATEGORY_COLORS, SOURCE_LABELS, VALID_TRANSITIONS } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import toast from "react-hot-toast";

export default function AppealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: appeal, isLoading } = useAppeal(id);
  const { data: history = [] } = useAppealHistory(id);
  const { data: branches = [] } = useBranches();
  const updateMutation = useUpdateAppeal();

  const [noteText, setNoteText] = useState("");
  const [showBranchSelect, setShowBranchSelect] = useState(false);
  const branchListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showBranchSelect) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowBranchSelect(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [showBranchSelect]);

  useEffect(() => {
    if (showBranchSelect) {
      const firstBtn = branchListRef.current?.querySelector("button");
      firstBtn?.focus();
    }
  }, [showBranchSelect]);

  if (isLoading) return <div className="p-8 text-center text-slate-500">Загрузка деталей обращения...</div>;
  if (!appeal) return <div className="p-8 text-center text-slate-500">Обращение не найдено</div>;

  const allowedTransitions = VALID_TRANSITIONS[appeal.status] || [];
  const meta = (appeal.metadata_json || {}) as Record<string, unknown>;
  const employeeName = meta.person_name as string | undefined;
  const clientName = meta.client_name as string | undefined;

  const handleStatusChange = (newStatus: string) => {
    updateMutation.mutate(
      { id: appeal.id, updates: { status: newStatus } },
      {
        onSuccess: () => toast.success(`Статус изменён на "${STATUS_LABELS[newStatus] || newStatus}"`),
        onError: () => toast.error("Не удалось изменить статус"),
      },
    );
  };

  const handleAssignBranch = (branchId: string) => {
    updateMutation.mutate(
      { id: appeal.id, updates: { branch_id: branchId } },
      {
        onSuccess: () => {
          toast.success("Филиал назначен");
          setShowBranchSelect(false);
        },
        onError: () => toast.error("Не удалось назначить филиал"),
      },
    );
  };

  const handleAddNote = () => {
    if (!noteText.trim()) return;
    const existingNotes = (meta.notes as Array<{ text: string; at: string }>) || [];
    const updatedNotes = [...existingNotes, { text: noteText.trim(), at: new Date().toISOString() }];
    updateMutation.mutate(
      { id: appeal.id, updates: { metadata_json: { ...meta, notes: updatedNotes } } },
      {
        onSuccess: () => {
          toast.success("Заметка добавлена");
          setNoteText("");
        },
        onError: () => toast.error("Не удалось добавить заметку"),
      },
    );
  };

  const notes = (meta.notes as Array<{ text: string; at: string }>) || [];

  return (
    <div className="p-8 max-w-[1600px] mx-auto w-full">
      {/* Breadcrumbs & Stage */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 text-on-surface-variant text-sm mb-1">
            <span className="hover:text-primary cursor-pointer">Обращения</span>
            <span className="material-symbols-outlined text-xs">chevron_right</span>
            <span className="font-bold text-on-surface">#{appeal.id.split("-")[0]}</span>
          </div>
          <h2 className="text-3xl font-extrabold text-primary tracking-tight">Эскалация маршрута</h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-surface-container-high border-none rounded-lg text-sm font-bold text-primary px-4 py-2">
            Статус: {STATUS_LABELS[appeal.status] || appeal.status}
          </div>
          <div className="bg-primary/10 text-primary px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest">
            {CATEGORY_LABELS[appeal.category] || appeal.category}
          </div>
        </div>
      </div>

      {/* Business Process Stepper */}
      <div className="bg-surface-container-lowest p-8 rounded-xl mb-8 whisper-shadow">
        <div className="flex items-center justify-between px-4 relative">
          <div className="absolute top-1/2 left-0 w-full h-[4px] bg-outline-variant -translate-y-1/2 z-0"></div>
          {/* Step 1 */}
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white ring-8 ring-surface-container-lowest">
              <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
            </div>
            <span className="mt-3 text-[10px] font-bold uppercase tracking-wider text-primary">Прием</span>
          </div>
          {/* Step 2 */}
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white ring-8 ring-surface-container-lowest">
              <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>sync</span>
            </div>
            <span className="mt-3 text-[10px] font-bold uppercase tracking-wider text-primary">Обработка</span>
          </div>
          {/* Step 3 (Current) */}
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-8 h-8 bg-surface-container-highest rounded-full flex items-center justify-center text-on-surface-variant ring-8 ring-surface-container-lowest border-2 border-primary">
              <div className="w-2 h-2 bg-primary rounded-full"></div>
            </div>
            <span className="mt-3 text-[10px] font-bold uppercase tracking-wider text-on-surface">Ревью</span>
          </div>
          {/* Step 4 */}
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-8 h-8 bg-surface-container-highest rounded-full flex items-center justify-center text-on-surface-variant ring-8 ring-surface-container-lowest">
              <span className="material-symbols-outlined text-sm">local_shipping</span>
            </div>
            <span className="mt-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Решение</span>
          </div>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-12 gap-8">
        {/* Left Column: Request Details & Log */}
        <div className="col-span-12 lg:col-span-8 space-y-8">
          {/* Request Content */}
          <section aria-labelledby="appeal-text-heading" className="bg-surface-container-lowest p-8 rounded-xl whisper-shadow border border-slate-100/50">
            <div className="flex items-center justify-between mb-6">
              <h3 id="appeal-text-heading" className="text-xl font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-primary" aria-hidden="true">mail</span>
                Текст обращения
              </h3>
              <span className="text-xs text-on-surface-variant font-medium">Получено: {appeal.created_at ? formatDistanceToNow(new Date(appeal.created_at), { addSuffix: true, locale: ru }) : "—"} через {SOURCE_LABELS[appeal.source] || appeal.source}</span>
            </div>
            <div className="bg-surface-container-low p-6 rounded-lg mb-6 leading-relaxed text-on-surface text-sm">
              <p>{appeal.client_message || "Текст обращения отсутствует"}</p>
            </div>
            
            {appeal.auto_response && (
              <div className="mt-6 p-4 bg-emerald-50 rounded-xl border border-emerald-100 mb-6 text-sm">
                <span className="text-[10px] text-emerald-600 font-bold uppercase block mb-2">Авто-ответ (отправлен клиенту)</span>
                <p className="text-emerald-800">{appeal.auto_response}</p>
              </div>
            )}
            
          </section>

          {/* Internal Activity Log */}
          <section aria-labelledby="activity-log-heading" className="bg-surface-container-lowest p-8 rounded-xl whisper-shadow border border-slate-100/50">
            <h3 id="activity-log-heading" className="text-xl font-bold mb-8 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary" aria-hidden="true">history</span>
              Журнал активности
            </h3>
            
            <div className="space-y-8 relative before:absolute before:left-[15px] before:top-2 before:bottom-2 before:w-[2px] before:bg-outline-variant">
              {history.length === 0 && notes.length === 0 ? (
                <div className="pl-10 text-sm text-slate-400">Журнал пока пуст</div>
              ) : null}

              {/* Automatic System Transition Demo Log Item */}
              {appeal.branch_id && (
                <div className="relative pl-10">
                  <div className="absolute left-0 top-1 w-8 h-8 bg-surface-container-highest rounded-full flex items-center justify-center border-4 border-surface-container-lowest z-10">
                    <span className="material-symbols-outlined text-[14px]">assignment_ind</span>
                  </div>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm"><span className="font-bold">Система</span> назначила обращение на <span className="font-bold">Филиал: {branches.find((b) => b.id === appeal.branch_id)?.name || appeal.branch_id.split("-")[0]}</span></p>
                      <p className="text-xs text-on-surface-variant mt-1">Только что</p>
                    </div>
                  </div>
                </div>
              )}

              {history.map((h, i) => (
                <div key={h.id} className="relative pl-10">
                  <div className="absolute left-0 top-1 w-8 h-8 bg-tertiary-fixed rounded-full flex items-center justify-center border-4 border-surface-container-lowest z-10">
                    <span className="material-symbols-outlined text-[14px] text-tertiary">priority_high</span>
                  </div>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-bold text-tertiary-container">Статус изменен на "{STATUS_LABELS[h.new_status] || h.new_status}"</p>
                      {h.comment && <p className="text-xs mt-1 text-slate-600">({h.comment})</p>}
                      <p className="text-xs text-on-surface-variant mt-1">{formatDistanceToNow(new Date(h.changed_at), { addSuffix: true, locale: ru })}</p>
                    </div>
                  </div>
                </div>
              ))}

              {notes.map((n, i) => (
                <div key={i} className="relative pl-10">
                  <div className="absolute left-0 top-1 w-8 h-8 bg-primary-fixed rounded-full flex items-center justify-center border-4 border-surface-container-lowest z-10">
                    <span className="material-symbols-outlined text-[14px] text-primary">comment</span>
                  </div>
                  <div className="flex items-start justify-between">
                    <div className="bg-surface-container-low p-4 rounded-lg flex-1">
                      <p className="text-sm font-bold">Оператор <span className="font-normal text-on-surface-variant ml-2">Система</span></p>
                      <p className="text-sm mt-1">{n.text}</p>
                      <p className="text-xs text-on-surface-variant mt-2">{formatDistanceToNow(new Date(n.at), { addSuffix: true, locale: ru })}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 pt-8 border-t border-surface-container">
              <label htmlFor="note-input" className="sr-only">Комментарий или заметка</label>
              <textarea 
                id="note-input"
                className="w-full bg-surface-container-low border-none rounded-xl p-4 text-sm focus:ring-2 focus:ring-primary/20 min-h-[100px]" 
                placeholder="Добавить комментарий или внутреннюю заметку..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) handleAddNote(); }}
              ></textarea>
              <div className="flex justify-end mt-4">
                <button 
                  onClick={handleAddNote}
                  disabled={!noteText.trim()}
                  className="px-6 py-2 bg-surface-container-high font-bold text-xs uppercase tracking-widest rounded-lg hover:bg-slate-300 transition-all disabled:opacity-40"
                >
                  ДОБАВИТЬ ЗАМЕТКУ
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: AI Insights & Customer Info */}
        <div className="col-span-12 lg:col-span-4 space-y-8">
          {/* AI Insights Panel */}
          <section className="bg-primary text-white p-8 rounded-xl shadow-2xl relative overflow-hidden">
            <div className="absolute -right-10 -top-10 opacity-10">
              <span className="material-symbols-outlined text-[200px]" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-6">
                <span className="material-symbols-outlined text-primary-container">psychology</span>
                <h3 className="text-xl font-bold headline">Командный центр ИИ</h3>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-white/10 backdrop-blur-md p-4 rounded-lg">
                  <div className="text-[10px] font-bold uppercase tracking-wider opacity-60">Классификация</div>
                  <div className="text-sm font-bold mt-1 leading-tight">{CATEGORY_LABELS[appeal.llm_category || ""] || "Не определено"}</div>
                </div>
                <div className="bg-white/10 backdrop-blur-md p-4 rounded-lg">
                  <div className="text-[10px] font-bold uppercase tracking-wider opacity-60">Уверенность</div>
                  <div className="text-sm font-bold mt-1">
                    {appeal.llm_confidence != null ? `${Math.round(appeal.llm_confidence * 100)}%` : "—"}
                  </div>
                </div>
              </div>

              {appeal.auto_response ? (
                <div className="space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-2">Авто-ответ ИИ</div>
                  <div className="bg-white/5 border border-white/10 p-4 rounded-lg">
                    <p className="text-xs italic">"{appeal.auto_response}"</p>
                  </div>
                </div>
              ) : (
                <div className="bg-white/5 border border-white/10 p-4 rounded-lg text-xs opacity-60 text-center">
                  Авто-ответ не сгенерирован
                </div>
              )}
            </div>
          </section>

          {/* Customer Information */}
          <section aria-labelledby="client-profile-heading" className="bg-surface-container-lowest p-8 rounded-xl whisper-shadow border border-slate-100/50">
            <h3 id="client-profile-heading" className="text-xl font-bold mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary" aria-hidden="true">person</span>
              Профиль клиента
            </h3>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-xl bg-surface-container-high flex items-center justify-center">
                <span className="material-symbols-outlined text-3xl text-on-surface-variant">person</span>
              </div>
              <div>
                <div className="text-lg font-bold">{clientName || appeal.client_phone || "Неизвестный клиент"}</div>
                <div className="text-xs text-on-surface-variant">{appeal.source ? (SOURCE_LABELS[appeal.source] || appeal.source) : "—"}</div>
              </div>
            </div>

            <div className="space-y-4 text-sm">
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Телефон</span>
                <span className="font-medium">{appeal.client_phone || "—"}</span>
              </div>
              {appeal.train_number && (
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Поезд</span>
                  <span className="font-medium">№{appeal.train_number}{appeal.car_number ? `, вагон ${appeal.car_number}` : ""}</span>
                </div>
              )}
              {employeeName && (
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Упомянутый сотрудник</span>
                  <span className="font-medium">{employeeName}</span>
                </div>
              )}
              {appeal.station_name && (
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Станция</span>
                  <span className="font-medium">{appeal.station_name}</span>
                </div>
              )}
              {appeal.ticket_number && (
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Билет</span>
                  <span className="font-medium">{appeal.ticket_number}</span>
                </div>
              )}
            </div>
          </section>

          {/* Action Sidebar */}
          <section aria-label="Действия" className="space-y-3">
            <button className="w-full py-4 bg-gradient-to-r from-primary to-primary-container text-white rounded-xl font-bold text-sm shadow-xl flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all">
              <span className="material-symbols-outlined text-sm" aria-hidden="true">reply</span>
              Ответить клиенту
            </button>
            <button 
              onClick={() => setShowBranchSelect(!showBranchSelect)}
              aria-expanded={showBranchSelect}
              aria-haspopup="listbox"
              className="w-full py-4 bg-surface-container-high text-on-surface-variant rounded-xl font-bold text-sm flex items-center justify-center gap-3 hover:bg-slate-300 transition-all"
            >
              <span className="material-symbols-outlined text-sm" aria-hidden="true">account_tree</span>
              Назначить филиалу
            </button>
            
            {showBranchSelect && (
              <div
                ref={branchListRef}
                role="listbox"
                aria-label="Выбор филиала"
                className="bg-surface-container-lowest p-4 rounded-xl whisper-shadow border border-slate-100/50 mt-2"
              >
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {branches.filter((b) => b.is_active).map((b) => (
                    <button
                      key={b.id}
                      role="option"
                      aria-selected={appeal.branch_id === b.id}
                      onClick={() => handleAssignBranch(b.id)}
                      className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-ktzh-blue/30"
                    >
                      {b.name} <span className="text-xs text-slate-500">({b.code})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 mt-3">
              <button 
                onClick={() => handleStatusChange("on_review")}
                aria-label="Эскалировать обращение"
                className="py-3 bg-tertiary-container/10 text-on-tertiary-container rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-tertiary-container/20 transition-all"
              >
                <span className="material-symbols-outlined text-xs" aria-hidden="true">warning</span>
                Эскалировать
              </button>
              <button 
                onClick={() => handleStatusChange("closed")}
                aria-label="Закрыть обращение"
                className="py-3 bg-on-surface/5 text-on-surface rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-on-surface/10 transition-all"
              >
                <span className="material-symbols-outlined text-xs" aria-hidden="true">check_circle</span>
                Закрыть
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
