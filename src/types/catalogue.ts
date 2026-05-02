/** Normalized catalogue page row (maps snake_case and camelCase from API). */

export type CatalogueRow = {
  id: number;
  title: string;
  imageUrl: string;
  imagePath: string;
  orderIndex: number;
  isActive: boolean;
  publishedAt: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type CatalogueListParams = {
  page?: number;
  limit?: number;
  search?: string;
  /** `"all"` omits filter; `"active"` / `"inactive"` maps to `is_active` 1/0 */
  isActive?: "all" | "active" | "inactive";
};

export type CatalogueListResponse = {
  data: Record<string, unknown>[];
  meta?: Record<string, unknown>;
};

export type CatalogueReorderPayload = {
  order: { id: number; orderIndex: number }[];
};
