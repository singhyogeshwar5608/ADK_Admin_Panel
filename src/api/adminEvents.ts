import { api } from "./client";

export type AdminEventsListParams = {
  page?: number;
  /** Page size; Laravel `AdkEventController@index` expects `limit`. */
  limit?: number;
  search?: string;
  start_date?: string;
  end_date?: string;
};

export const adminEventsApi = {
  list: (params?: AdminEventsListParams) =>
    api.get("/admin/events", { params: params && Object.keys(params).length ? params : undefined }),
  create: (payload: unknown) => api.post("/admin/events", payload),
  update: (id: string | number, payload: unknown) => api.put(`/admin/events/${id}`, payload),
  delete: (id: string | number) => api.delete(`/admin/events/${id}`),
};
