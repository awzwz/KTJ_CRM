"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth";
import toast from "react-hot-toast";

interface UserItem {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

interface Branch {
  id: string;
  name: string;
  code: string;
  branch_type: string;
  is_active: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Админ",
  operator: "Оператор",
  controller: "Контролер",
  branch_manager: "Руководитель",
};

const emptyUser = { email: "", password: "", full_name: "", role: "operator" };
const emptyBranch = { name: "", code: "", branch_type: "regional" };

export default function SettingsPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);

  // User form state
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [userForm, setUserForm] = useState(emptyUser);
  const [userLoading, setUserLoading] = useState(false);

  // Branch form state
  const [showBranchForm, setShowBranchForm] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [branchForm, setBranchForm] = useState(emptyBranch);
  const [branchLoading, setBranchLoading] = useState(false);

  const isAdmin = user?.role === "admin";

  const fetchUsers = () => api.get("/users?limit=100").then((r) => setUsers(r.data.items)).catch(() => {});
  const fetchBranches = () => api.get("/branches").then((r) => setBranches(r.data)).catch(() => {});

  useEffect(() => {
    if (isAdmin) { fetchUsers(); fetchBranches(); }
  }, [isAdmin]);

  // --- User handlers ---
  const openNewUser = () => {
    setEditingUser(null);
    setUserForm(emptyUser);
    setShowUserForm(true);
  };

  const openEditUser = (u: UserItem) => {
    setEditingUser(u);
    setUserForm({ email: u.email, full_name: u.full_name, role: u.role, password: "" });
    setShowUserForm(true);
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserLoading(true);
    try {
      if (editingUser) {
        const updates: Record<string, string> = { full_name: userForm.full_name, role: userForm.role };
        if (userForm.password) updates.password = userForm.password;
        await api.patch(`/users/${editingUser.id}`, updates);
        toast.success("Пользователь обновлён");
      } else {
        await api.post("/users", userForm);
        toast.success("Пользователь создан");
      }
      setShowUserForm(false);
      fetchUsers();
    } catch {
      toast.error("Не удалось сохранить пользователя");
    } finally {
      setUserLoading(false);
    }
  };

  const handleToggleUser = async (u: UserItem) => {
    try {
      await api.patch(`/users/${u.id}`, { is_active: !u.is_active });
      toast.success(u.is_active ? "Пользователь деактивирован" : "Пользователь активирован");
      fetchUsers();
    } catch {
      toast.error("Не удалось изменить статус");
    }
  };

  // --- Branch handlers ---
  const openNewBranch = () => {
    setEditingBranch(null);
    setBranchForm(emptyBranch);
    setShowBranchForm(true);
  };

  const openEditBranch = (b: Branch) => {
    setEditingBranch(b);
    setBranchForm({ name: b.name, code: b.code, branch_type: b.branch_type });
    setShowBranchForm(true);
  };

  const handleBranchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBranchLoading(true);
    try {
      if (editingBranch) {
        await api.patch(`/branches/${editingBranch.id}`, branchForm);
        toast.success("Филиал обновлён");
      } else {
        await api.post("/branches", branchForm);
        toast.success("Филиал создан");
      }
      setShowBranchForm(false);
      fetchBranches();
    } catch {
      toast.error("Не удалось сохранить филиал");
    } finally {
      setBranchLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
        <h1 className="text-2xl font-extrabold text-slate-900 font-headline tracking-tight mb-6">Настройки</h1>
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-6">
          <p className="text-sm text-slate-500">Настройки доступны только администраторам.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
      <h1 className="text-2xl font-extrabold text-slate-900 font-headline tracking-tight mb-8">Настройки</h1>

      {/* Users */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px] text-slate-500">shield_person</span>
            </div>
            <h2 className="text-sm font-bold text-slate-700">Пользователи</h2>
            <span className="text-xs text-slate-500">{users.length}</span>
          </div>
          <button
            onClick={openNewUser}
            className="flex items-center gap-2 rounded-lg bg-ktzh-dark px-4 py-2 text-xs font-semibold text-white hover:bg-ktzh-blue transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            Добавить
          </button>
        </div>

        {showUserForm && (
          <form onSubmit={handleUserSubmit} className="mb-4 bg-white rounded-xl border border-slate-200/80 shadow-sm p-5">
            <h3 className="text-sm font-bold text-slate-700 mb-4">
              {editingUser ? `Редактировать: ${editingUser.full_name}` : "Новый пользователь"}
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <input
                type="text"
                placeholder="ФИО"
                value={userForm.full_name}
                onChange={(e) => setUserForm({ ...userForm, full_name: e.target.value })}
                required
                className="h-9 rounded-lg border border-slate-200 px-3 text-sm focus:border-ktzh-blue focus:outline-none focus:ring-1 focus:ring-ktzh-blue/20"
              />
              <input
                type="email"
                placeholder="Email"
                value={userForm.email}
                onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                required={!editingUser}
                disabled={!!editingUser}
                className="h-9 rounded-lg border border-slate-200 px-3 text-sm focus:border-ktzh-blue focus:outline-none focus:ring-1 focus:ring-ktzh-blue/20 disabled:bg-slate-50 disabled:text-slate-400"
              />
              <input
                type="password"
                placeholder={editingUser ? "Новый пароль (необязательно)" : "Пароль"}
                value={userForm.password}
                onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                required={!editingUser}
                className="h-9 rounded-lg border border-slate-200 px-3 text-sm focus:border-ktzh-blue focus:outline-none focus:ring-1 focus:ring-ktzh-blue/20"
              />
              <select
                value={userForm.role}
                onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                className="h-9 rounded-lg border border-slate-200 px-3 text-sm focus:border-ktzh-blue focus:outline-none focus:ring-1 focus:ring-ktzh-blue/20"
              >
                {Object.entries(ROLE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                type="submit"
                disabled={userLoading}
                className="rounded-lg bg-ktzh-blue px-4 py-2 text-xs font-semibold text-white hover:bg-ktzh-dark transition-colors disabled:opacity-50"
              >
                {userLoading ? "Сохранение..." : editingUser ? "Сохранить" : "Создать пользователя"}
              </button>
              <button
                type="button"
                onClick={() => setShowUserForm(false)}
                className="rounded-lg bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Отмена
              </button>
            </div>
          </form>
        )}

        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
          <table className="w-full" role="table" aria-label="Таблица пользователей">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60">
                <th scope="col" className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">ФИО</th>
                <th scope="col" className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Email</th>
                <th scope="col" className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Роль</th>
                <th scope="col" className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Статус</th>
                <th scope="col" className="px-5 py-3.5 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">Действия</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-3.5 text-sm font-medium text-slate-800">{u.full_name}</td>
                  <td className="px-5 py-3.5 text-sm text-slate-500">{u.email}</td>
                  <td className="px-5 py-3.5 text-sm text-slate-500">{ROLE_LABELS[u.role] || u.role}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-block rounded-md px-2.5 py-1 text-xs font-semibold ${u.is_active ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                      {u.is_active ? "Активен" : "Отключен"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEditUser(u)}
                        className="p-1.5 text-slate-500 hover:text-ktzh-blue hover:bg-blue-50 rounded-lg transition-colors"
                        aria-label={`Редактировать ${u.full_name}`}
                      >
                        <span className="material-symbols-outlined text-[16px]" aria-hidden="true">edit</span>
                      </button>
                      <button
                        onClick={() => handleToggleUser(u)}
                        className={`p-1.5 rounded-lg transition-colors ${u.is_active ? "text-slate-500 hover:text-red-500 hover:bg-red-50" : "text-slate-500 hover:text-emerald-600 hover:bg-emerald-50"}`}
                        aria-label={u.is_active ? `Деактивировать ${u.full_name}` : `Активировать ${u.full_name}`}
                      >
                        <span className="material-symbols-outlined text-[16px]" aria-hidden="true">{u.is_active ? "person_off" : "person"}</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-12 text-center text-sm text-slate-500">Нет пользователей</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Branches */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px] text-slate-500">domain</span>
            </div>
            <h2 className="text-sm font-bold text-slate-700">Филиалы</h2>
            <span className="text-xs text-slate-500">{branches.length}</span>
          </div>
          <button
            onClick={openNewBranch}
            className="flex items-center gap-2 rounded-lg bg-ktzh-dark px-4 py-2 text-xs font-semibold text-white hover:bg-ktzh-blue transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            Добавить
          </button>
        </div>

        {showBranchForm && (
          <form onSubmit={handleBranchSubmit} className="mb-4 bg-white rounded-xl border border-slate-200/80 shadow-sm p-5">
            <h3 className="text-sm font-bold text-slate-700 mb-4">
              {editingBranch ? `Редактировать: ${editingBranch.name}` : "Новый филиал"}
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <input
                type="text"
                placeholder="Название филиала"
                value={branchForm.name}
                onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })}
                required
                className="h-9 rounded-lg border border-slate-200 px-3 text-sm focus:border-ktzh-blue focus:outline-none focus:ring-1 focus:ring-ktzh-blue/20"
              />
              <input
                type="text"
                placeholder="Код (напр. ALA)"
                value={branchForm.code}
                onChange={(e) => setBranchForm({ ...branchForm, code: e.target.value.toUpperCase() })}
                required
                maxLength={10}
                className="h-9 rounded-lg border border-slate-200 px-3 text-sm font-mono focus:border-ktzh-blue focus:outline-none focus:ring-1 focus:ring-ktzh-blue/20"
              />
              <select
                value={branchForm.branch_type}
                onChange={(e) => setBranchForm({ ...branchForm, branch_type: e.target.value })}
                className="h-9 rounded-lg border border-slate-200 px-3 text-sm focus:border-ktzh-blue focus:outline-none focus:ring-1 focus:ring-ktzh-blue/20"
              >
                <option value="regional">Региональный</option>
                <option value="central">Центральный</option>
              </select>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                type="submit"
                disabled={branchLoading}
                className="rounded-lg bg-ktzh-blue px-4 py-2 text-xs font-semibold text-white hover:bg-ktzh-dark transition-colors disabled:opacity-50"
              >
                {branchLoading ? "Сохранение..." : editingBranch ? "Сохранить" : "Создать филиал"}
              </button>
              <button
                type="button"
                onClick={() => setShowBranchForm(false)}
                className="rounded-lg bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Отмена
              </button>
            </div>
          </form>
        )}

        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
          <table className="w-full" role="table" aria-label="Таблица филиалов">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60">
                <th scope="col" className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Название</th>
                <th scope="col" className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Код</th>
                <th scope="col" className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Тип</th>
                <th scope="col" className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Статус</th>
                <th scope="col" className="px-5 py-3.5 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">Действия</th>
              </tr>
            </thead>
            <tbody>
              {branches.map((b) => (
                <tr key={b.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-3.5 text-sm font-medium text-slate-800">{b.name}</td>
                  <td className="px-5 py-3.5 text-sm text-slate-500 font-mono">{b.code}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-block rounded-md px-2.5 py-1 text-xs font-semibold ${b.branch_type === "central" ? "bg-blue-50 text-ktzh-blue" : "bg-slate-100 text-slate-600"}`}>
                      {b.branch_type === "central" ? "Центральный" : "Региональный"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-block rounded-md px-2.5 py-1 text-xs font-semibold ${b.is_active ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                      {b.is_active ? "Активен" : "Отключен"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => openEditBranch(b)}
                      className="p-1.5 text-slate-500 hover:text-ktzh-blue hover:bg-blue-50 rounded-lg transition-colors"
                      aria-label={`Редактировать ${b.name}`}
                    >
                      <span className="material-symbols-outlined text-[16px]" aria-hidden="true">edit</span>
                    </button>
                  </td>
                </tr>
              ))}
              {branches.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-12 text-center text-sm text-slate-500">Филиалы не настроены</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
