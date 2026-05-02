import { api } from "./client";

export const deliveryCentersApi = {
  list: () => api.get("/delivery-centers"),
  get: (id: string | number) => api.get(`/delivery-centers/${id}`),
  create: (payload: unknown) => api.post("/delivery-centers", payload),
  patch: (id: string | number, payload: unknown) => api.patch(`/delivery-centers/${id}`, payload),
  delete: (id: string | number) => api.delete(`/delivery-centers/${id}`),
};
