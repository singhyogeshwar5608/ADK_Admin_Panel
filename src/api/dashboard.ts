import { api } from "./client";

export const dashboardApi = {
  reports: () => api.get("/reports/dashboard"),
};
