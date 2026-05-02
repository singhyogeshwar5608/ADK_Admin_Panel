import { normalizeList } from "@/utils/normalizeList";

export type DeliveryCenterRow = {
  id: string | number;
  name: string;
  owner_name: string;
  location: string;
  mobile_number: string;
  is_active: boolean;
};

export function parseDeliveryCenterPayload(payload: unknown): DeliveryCenterRow[] {
  const rows = normalizeList(payload);
  const out: DeliveryCenterRow[] = [];
  for (const r of rows) {
    const rawId = r.id ?? r._id;
    if (rawId == null) continue;
    const id =
      typeof rawId === "string" || typeof rawId === "number" ? rawId : String(rawId);
    out.push({
      id,
      name: String(r.name ?? ""),
      owner_name: String(r.owner_name ?? r.ownerName ?? ""),
      location: String(r.location ?? ""),
      mobile_number: String(r.mobile_number ?? r.mobileNumber ?? ""),
      is_active: Boolean(r.is_active ?? r.isActive ?? true),
    });
  }
  return out;
}
