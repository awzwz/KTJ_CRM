import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";

export interface Appeal {
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
  return_status: string | null;
  llm_category: string | null;
  llm_confidence: number | null;
  metadata_json: Record<string, unknown> | null;
  assigned_to: string | null;
  branch_id: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  first_response_at: string | null;
}

interface AppealsResponse {
  items: Appeal[];
  total: number;
}

export interface KpiData {
  total_appeals: number;
  resolved_count: number;
  new_count: number;
  in_progress_count: number;
  avg_response_time_seconds: number | null;
  avg_resolution_time_seconds: number | null;
}

export interface SummaryData {
  by_status: Record<string, number>;
  by_category: Record<string, number>;
}

export interface TopTrain {
  train_number: number;
  appeal_count: number;
  complaint_count: number;
  gratitude_count: number;
}

export interface TimelinePoint {
  day: string;
  total: number;
  complaints: number;
  gratitudes: number;
}

export interface AppealHistoryItem {
  id: string;
  old_status: string | null;
  new_status: string;
  changed_by: string | null;
  comment: string | null;
  changed_at: string;
}

export function useAppeals(params?: {
  skip?: number;
  limit?: number;
  status?: string;
  category?: string;
  search?: string;
  sort_by?: string;
  order?: "asc" | "desc";
  date_from?: string;
  date_to?: string;
}) {
  return useQuery({
    queryKey: ["appeals", params],
    queryFn: async () => {
      const query = new URLSearchParams();
      if (params?.skip != null) query.set("skip", String(params.skip));
      if (params?.limit != null) query.set("limit", String(params.limit));
      if (params?.status) query.set("status", params.status);
      if (params?.category) query.set("category", params.category);
      if (params?.search) query.set("search", params.search);
      if (params?.sort_by) query.set("sort_by", params.sort_by);
      if (params?.order) query.set("order", params.order);
      if (params?.date_from) query.set("date_from", params.date_from);
      if (params?.date_to) query.set("date_to", params.date_to);
      const qs = query.toString();
      const { data } = await api.get<AppealsResponse>(`/appeals${qs ? `?${qs}` : ""}`);
      return data;
    },
  });
}

export function useAppeal(id: string) {
  return useQuery({
    queryKey: ["appeals", id],
    queryFn: async () => {
      const { data } = await api.get<Appeal>(`/appeals/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useAppealHistory(id: string) {
  return useQuery({
    queryKey: ["appeals", id, "history"],
    queryFn: async () => {
      const { data } = await api.get<AppealHistoryItem[]>(`/appeals/${id}/history`);
      return data;
    },
    enabled: !!id,
  });
}

export function useUpdateAppeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, unknown> }) => {
      const { data } = await api.patch(`/appeals/${id}`, updates);
      return data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["appeals"] });
      queryClient.invalidateQueries({ queryKey: ["appeals", id] });
    },
  });
}

export function useCreateAppeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await api.post("/appeals", body);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appeals"] });
    },
  });
}

export function useKpi() {
  return useQuery({
    queryKey: ["analytics", "kpi"],
    queryFn: async () => {
      const { data } = await api.get<KpiData>("/analytics/dashboard/kpi");
      return data;
    },
  });
}

export function useSummary() {
  return useQuery({
    queryKey: ["analytics", "summary"],
    queryFn: async () => {
      const { data } = await api.get<SummaryData>("/analytics/dashboard/summary");
      return data;
    },
  });
}

export function useTopTrains(limit = 10) {
  return useQuery({
    queryKey: ["analytics", "top-trains", limit],
    queryFn: async () => {
      const { data } = await api.get<TopTrain[]>(`/analytics/dashboard/top-trains?limit=${limit}`);
      return data;
    },
  });
}

export function useTimeline(days = 30, dateFrom?: string, dateTo?: string) {
  return useQuery({
    queryKey: ["analytics", "timeline", days, dateFrom, dateTo],
    queryFn: async () => {
      const query = new URLSearchParams({ days: String(days) });
      if (dateFrom) query.set("date_from", dateFrom);
      if (dateTo) query.set("date_to", dateTo);
      const { data } = await api.get<TimelinePoint[]>(`/analytics/dashboard/timeline?${query}`);
      return data;
    },
  });
}

export function useBranches() {
  return useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const { data } = await api.get<Array<{ id: string; name: string; code: string; is_active: boolean }>>("/branches");
      return data;
    },
  });
}

export function useSystemHealth() {
  return useQuery({
    queryKey: ["systemHealth"],
    queryFn: async () => {
      try {
        const { data } = await api.get("/health");
        return data;
      } catch {
        return { status: "error" };
      }
    },
  });
}
