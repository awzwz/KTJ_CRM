"use client";

import { useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/lib/auth";

interface WSNotification {
  type: string;
  data: Record<string, unknown>;
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8008";

export function useWebSocket(onMessage: (notification: WSNotification) => void) {
  const { user } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const connect = useCallback(() => {
    if (!user?.id) return;

    const ws = new WebSocket(`${WS_URL}/ws/notifications?user_id=${user.id}`);

    ws.onopen = () => {
      console.log("[WS] Connected");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WSNotification;
        if (data.type === "pong") return;
        onMessage(data);
      } catch {
        /* ignore parse errors */
      }
    };

    ws.onclose = () => {
      console.log("[WS] Disconnected, reconnecting in 3s...");
      reconnectTimer.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };

    wsRef.current = ws;

    // Keepalive ping every 30s
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send("ping");
      }
    }, 30000);

    return () => clearInterval(pingInterval);
  }, [user?.id, onMessage]);

  useEffect(() => {
    const cleanup = connect();
    return () => {
      cleanup?.();
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return wsRef;
}
