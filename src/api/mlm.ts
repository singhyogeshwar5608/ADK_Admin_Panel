import { api } from "./client";

export const mlmApi = {
  income: (memberId: string | number) => api.get(`/mlm/income/${memberId}`),
  matching: (memberId: string | number) => api.get(`/mlm/income/${memberId}/matching`),
  statistics: (memberId: string | number) => api.get(`/mlm/income/${memberId}/statistics`),
  transactions: (memberId: string | number) => api.get(`/mlm/income/${memberId}/transactions`),
};
