import { api } from "./client";

export const heroSlidersApi = {
  list: () => api.get("/hero-sliders"),
  create: (payload: unknown) => api.post("/hero-sliders", payload),
  update: (id: string | number, payload: unknown) => api.put(`/hero-sliders/${id}`, payload),
  delete: (id: string | number) => api.delete(`/hero-sliders/${id}`),
  upload: (formData: FormData) => api.post("/media/hero-slider", formData),
};
