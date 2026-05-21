import { api } from "./client";

export const productsApi = {
  list: () => api.get("/products"),
  get: (id: string | number) => api.get(`/products/${id}`),
  create: (payload: unknown) => api.post("/products", payload),
  patch: (id: string | number, payload: any) =>
    api.post(`/products/${id}`, { ...payload, _method: "PATCH" }),
  delete: (id: string | number) => api.post(`/products/${id}`, { _method: "DELETE" }),
  uploadMedia: (formData: FormData) => api.post("/media/products", formData),
};
