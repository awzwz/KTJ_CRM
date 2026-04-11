"use client";

import { useEffect, useState } from "react";
import { Plus, Shield, Building2 } from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth";

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

export default function SettingsPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({
    email: "",
    password: "",
    full_name: "",
    role: "operator",
  });

  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (isAdmin) {
      api.get("/users?limit=100").then((r) => setUsers(r.data.items)).catch(() => {});
      api.get("/branches").then((r) => setBranches(r.data)).catch(() => {});
    }
  }, [isAdmin]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/users", newUser);
      setShowAddUser(false);
      setNewUser({ email: "", password: "", full_name: "", role: "operator" });
      const { data } = await api.get("/users?limit=100");
      setUsers(data.items);
    } catch { /* handled */ }
  };

  if (!isAdmin) {
    return (
      <div>
        <h1 className="mb-8 text-2xl font-bold text-gray-900">Настройки</h1>
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">
            Настройки доступны только администраторам.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-8 text-2xl font-bold text-gray-900">Настройки</h1>

      <div className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              Пользователи
            </h2>
          </div>
          <button
            onClick={() => setShowAddUser(!showAddUser)}
            className="flex items-center gap-2 rounded-lg bg-ktzh-blue px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-ktzh-dark"
          >
            <Plus className="h-4 w-4" /> Добавить
          </button>
        </div>

        {showAddUser && (
          <form
            onSubmit={handleAddUser}
            className="mb-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <input
                type="text"
                placeholder="ФИО"
                value={newUser.full_name}
                onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                required
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-ktzh-blue focus:outline-none"
              />
              <input
                type="email"
                placeholder="Email"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                required
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-ktzh-blue focus:outline-none"
              />
              <input
                type="password"
                placeholder="Пароль"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                required
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-ktzh-blue focus:outline-none"
              />
              <select
                value={newUser.role}
                onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-ktzh-blue focus:outline-none"
              >
                {Object.entries(ROLE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="mt-4 rounded-lg bg-ktzh-blue px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-ktzh-dark"
            >
              Создать пользователя
            </button>
          </form>
        )}

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">ФИО</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Роль</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Статус</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{u.full_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{u.email}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{ROLE_LABELS[u.role] || u.role}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${u.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                      {u.is_active ? "Активен" : "Отключен"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <div className="mb-4 flex items-center gap-2">
          <Building2 className="h-5 w-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">Филиалы</h2>
        </div>
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Название</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Код</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Тип</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Статус</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {branches.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{b.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{b.code}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{b.branch_type}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${b.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                      {b.is_active ? "Активен" : "Отключен"}
                    </span>
                  </td>
                </tr>
              ))}
              {branches.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">
                    Филиалы не настроены
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
