import type { MemberRole } from "@/types/member";

export interface NavItem {
  label: string;
  path: string;
  /** When true, only shown to `ADMIN` (bundle: `staff` flag). */
  staff?: boolean;
}

/** Reconstructed from bundle `Ep` array. */
export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", path: "/dashboard" },
  { label: "Members", path: "/members" },
  { label: "Products", path: "/products", staff: true },
  { label: "Categories", path: "/categories", staff: true },
  { label: "Delivery Centers", path: "/delivery-centers", staff: true },
  { label: "Product Catalogue", path: "/catalogue", staff: true },
  { label: "Hero Slider", path: "/hero-slider", staff: true },
  { label: "Event Media", path: "/event-media", staff: true },
  { label: "ADK Events", path: "/adk-events", staff: true },
  { label: "Media Links", path: "/social-links", staff: true },
  { label: "Binary Tree", path: "/binary-tree" },
  { label: "MLM Income", path: "/mlm-income" },
  { label: "Orders", path: "/orders" },
  { label: "Settings", path: "/settings" },
];

export function navItemsForRole(role: MemberRole | undefined): NavItem[] {
  if (role === "ADMIN") return NAV_ITEMS;
  return NAV_ITEMS.filter((item) => item.staff === true);
}
