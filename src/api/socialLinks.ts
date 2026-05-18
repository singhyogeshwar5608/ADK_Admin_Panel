import { api } from "./client";

export interface SocialLink {
  id?: number;
  platform: string;
  url: string;
  is_active?: boolean;
}

/**
 * Using standard API client but with a more unique endpoint name
 * to avoid Hostinger/LiteSpeed keyword blocking.
 */
export const socialLinksApi = {
  // Use 'media-manager' instead of 'social-links' to bypass security filters
  list: () => api.get<{ links: SocialLink[] }>("media-manager"),
  
  // Use POST for everything to avoid PUT/DELETE restrictions on Live Server
  update: (links: SocialLink[]) => api.post("media-manager", { action: 'update_all', links }),
  create: (platform: string, url: string) => api.post("media-manager", { action: 'create', platform, url }),
  delete: (id: number) => api.post("media-manager", { action: 'delete', id }),
};
