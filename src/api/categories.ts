import { api } from "./client";
import type { CategoriesListParams, CategoriesListResponse } from "@/types/category";

export const categoriesApi = {
  list: (params: CategoriesListParams = {}) =>
    api.get<CategoriesListResponse>("/categories", { params }),
  create: (payload: unknown) => api.post<{ category: unknown }>("/categories", payload),
  patch: (id: string | number, payload: unknown) =>
    api.patch<{ category: unknown }>(`/categories/${id}`, payload),
  delete: (id: string | number) => api.delete(`/categories/${id}`),
  uploadLogo: (formData: FormData) => api.post<unknown>("/media/categories/logo", formData),
};
