import { api } from "./client";

export interface SocialLink {
  id?: number;
  platform: string;
  url: string;
  is_active?: boolean;
}

export const socialLinksApi = {
  list: () => api.get<{ links: SocialLink[] }>("social-links"),
  update: (links: SocialLink[]) => api.put<{ message: string; links: SocialLink[] }>("social-links", { links }),
  create: (platform: string, url: string) => api.post<{ message: string; link: SocialLink }>("social-links", { platform, url }),
  delete: (id: number) => api.delete<{ message: string }>(`social-links/${id}`),
};
