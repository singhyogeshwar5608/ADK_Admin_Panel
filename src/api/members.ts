import { api } from "./client";

export const membersApi = {
  list: () => api.get("/members"),
  get: (id: string | number) => api.get(`/members/${id}`),
  create: (payload: unknown) => api.post("/members", payload),
  patch: (id: string | number, payload: unknown) => api.patch(`/members/${id}`, payload),
  delete: (id: string | number) => api.delete(`/members/${id}`),
  tree: (id: string | number, depth = 3) =>
    api.get(`/members/${id}/tree`, { params: { depth } }),
  /** Returns public URL string for `profileImage` on create (bundle `Nd`). */
  uploadProfilePhoto: async (file: File) => {
    const body = new FormData();
    body.append("file", file);
    const { data } = await api.post<unknown>("/media/members/profile", body);
    const d = data as { file?: { url?: string }; url?: string };
    return d.file?.url ?? d.url ?? "";
  },
};
