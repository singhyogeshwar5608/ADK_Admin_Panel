import { api } from "./client";

export const productsApi = {
  list: () => api.get("/products"),
  get: (id: string | number) => api.get(`/products/${id}`),
  create: (payload: unknown) => api.post("/products", payload),
  patch: (id: string | number, payload: any) =>
    api.patch(`/products/${id}`, payload),
  delete: (id: string | number) => api.delete(`/products/${id}`),
  uploadMedia: (formData: FormData) => api.post("/media/products", formData),
};
