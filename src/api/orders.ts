import { api } from "./client";

export const ordersApi = {
  list: () => api.get("/orders"),
  refund: (id: string | number) => api.post(`/orders/${id}/refund`),
  status: (id: string | number, payload: unknown) => api.post(`/orders/${id}/status`, payload),
  syncTracking: (id: string | number) => api.post(`/orders/${id}/sync-tracking`),
};
