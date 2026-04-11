import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const STATUS_LABELS: Record<string, string> = {
  new: "Новое",
  in_progress: "В работе",
  on_review: "На проверке",
  resolved: "Решено",
  closed: "Закрыто",
};

export const CATEGORY_LABELS: Record<string, string> = {
  gratitude: "Благодарность",
  lost_items: "Забытые вещи",
  ticket_return: "Возврат билета",
  complaint: "Жалоба",
  suggestion: "Предложение",
};

export const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-800",
  in_progress: "bg-yellow-100 text-yellow-800",
  on_review: "bg-purple-100 text-purple-800",
  resolved: "bg-green-100 text-green-800",
  closed: "bg-gray-100 text-gray-800",
};

export const CATEGORY_COLORS: Record<string, string> = {
  gratitude: "bg-emerald-100 text-emerald-800",
  lost_items: "bg-orange-100 text-orange-800",
  ticket_return: "bg-sky-100 text-sky-800",
  complaint: "bg-red-100 text-red-800",
  suggestion: "bg-indigo-100 text-indigo-800",
};
