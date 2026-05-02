import { api } from "./client";

export const eventMediaApi = {
  list: (params?: Record<string, string | number | boolean | undefined>) =>
    api.get("/event-media", { params }),
  create: (payload: unknown) => api.post("/event-media", payload),
  bulk: (payload: unknown) => api.post("/event-media/bulk", payload),
  upload: (formData: FormData) => api.post("/event-media/upload", formData),
  patch: (id: string | number, payload: unknown) => api.patch(`/event-media/${id}`, payload),
  delete: (id: string | number) => api.delete(`/event-media/${id}`),
};
