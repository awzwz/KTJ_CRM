"use client";

import { useCallback } from "react";
import toast, { Toaster } from "react-hot-toast";
import { useWebSocket } from "@/hooks/useWebSocket";
import { CATEGORY_LABELS } from "@/lib/utils";

export default function NotificationToast() {
  const handleNotification = useCallback(
    (notification: { type: string; data: Record<string, unknown> }) => {
      const { type, data } = notification;

      if (type === "appeal.created") {
        const category = data.category as string;
        const train = data.train_number;
        toast(
          `Новое обращение: ${CATEGORY_LABELS[category] || category}${train ? ` (поезд #${train})` : ""}`,
          { icon: "📩", duration: 5000 },
        );
      } else if (type === "appeal.updated") {
        const oldStatus = data.old_status as string;
        const newStatus = data.new_status as string;
        if (oldStatus !== newStatus) {
          toast(`Статус обращения изменён: ${oldStatus} → ${newStatus}`, {
            icon: "🔄",
            duration: 4000,
          });
        }
      }
    },
    [],
  );

  useWebSocket(handleNotification);

  return (
    <Toaster
      position="top-right"
      toastOptions={{
        style: {
          background: "#fff",
          border: "1px solid #e5e7eb",
          boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
          borderRadius: "12px",
          padding: "12px 16px",
          fontSize: "14px",
        },
      }}
    />
  );
}
