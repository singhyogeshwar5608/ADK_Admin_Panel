import { api } from "./client";
import type { CatalogueListParams, CatalogueListResponse, CatalogueReorderPayload } from "@/types/catalogue";

export const catalogueApi = {
  list: (params: CatalogueListParams = {}) =>
    api.get<CatalogueListResponse>("/catalogue", { params: buildListParams(params) }),
  /** Multipart: `title`, `is_active` ("1"|"0"), optional `published_at`, `image` file */
  create: (formData: FormData) => api.post<unknown>("/catalogue", formData),
  delete: (id: string | number) => api.delete(`/catalogue/${id}`),
  reorder: (payload: CatalogueReorderPayload) => api.patch("/catalogue/reorder", payload),
};

function buildListParams(e: CatalogueListParams): Record<string, string | number> {
  const t: Record<string, string | number> = {
    page: e.page ?? 1,
    limit: e.limit ?? 20,
  };
  if (e.search) t.search = e.search;
  if (e.isActive && e.isActive !== "all") {
    t.is_active = e.isActive === "active" ? 1 : 0;
  }
  return t;
}
