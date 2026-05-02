/** Category row returned by `/categories` list/detail. */

export type CategoryRow = {
  id: string | number;
  name: string;
  slug: string;
  description?: string | null;
  logo_url?: string | null;
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

export type CategoriesListParams = {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
};

export type CategoriesListMeta = {
  total: number;
  page: number;
  limit: number;
  pages: number;
};

export type CategoriesListResponse = {
  data: CategoryRow[];
  meta?: Partial<CategoriesListMeta> | null;
};
