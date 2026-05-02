import { api } from "./client";

export const settingsApi = {
  get: () => api.get("/settings"),
  put: (payload: unknown) => api.put("/settings", payload),
};
