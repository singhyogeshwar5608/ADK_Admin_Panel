import { normalizeList } from "@/utils/normalizeList";

export type AdmEventRow = {
  id: string | number;
  leaderName: string;
  meetingDate: string;
  meetingTime: string;
  storeName: string;
  address: string;
  state: string;
  city: string;
  leaderMobile: string;
  storeMobile: string;
  notes: string;
};

export type AdmEventsMeta = {
  currentPage: number;
  perPage: number;
  total: number;
  lastPage: number;
};

function asStr(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return "";
}

function parseOne(r: Record<string, unknown>): AdmEventRow | null {
  const rawId = r.id ?? r._id;
  if (rawId == null) return null;
  const id =
    typeof rawId === "string" || typeof rawId === "number" ? rawId : String(rawId);

  return {
    id,
    leaderName: asStr(r.leaderName ?? r.leader_name ?? r.leader ?? ""),
    meetingDate: asStr(r.meetingDate ?? r.meeting_date ?? r.date ?? ""),
    meetingTime: asStr(r.meetingTime ?? r.meeting_time ?? r.time ?? ""),
    storeName: asStr(r.storeName ?? r.store_name ?? ""),
    address: asStr(r.address ?? ""),
    state: asStr(r.state ?? ""),
    city: asStr(r.city ?? ""),
    leaderMobile: asStr(r.leaderMobile ?? r.leader_mobile ?? ""),
    storeMobile: asStr(r.storeMobile ?? r.store_mobile ?? ""),
    notes: asStr(r.notes ?? ""),
  };
}

/** Format YYYY-MM-DD for display dd-mm-yyyy */
export function formatEventDate(dateStr: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr.trim());
  if (!m) return dateStr.trim() || "—";
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/** Format API time (`HH:mm` or `HH:mm:ss`) for list UI as `h:mm AM/PM`. */
export function formatEventTime(timeStr: string): string {
  const t = timeStr.trim();
  if (!t) return "—";
  const parts = t.split(":");
  const H = Number(parts[0]);
  const M = Number(parts[1]);
  if (!Number.isFinite(H) || !Number.isFinite(M) || H < 0 || H > 23 || M < 0 || M > 59) return t || "—";
  const meridiem = H < 12 ? "AM" : "PM";
  let h12 = H % 12;
  if (h12 === 0) h12 = 12;
  return `${h12}:${String(M).padStart(2, "0")} ${meridiem}`;
}

export function parseAdminEventsEnvelope(payload: unknown): {
  rows: AdmEventRow[];
  meta: AdmEventsMeta;
} {
  const rows = normalizeList(payload)
    .map((r) => parseOne(r))
    .filter(Boolean) as AdmEventRow[];

  let meta: AdmEventsMeta = {
    currentPage: 1,
    perPage: 15,
    total: rows.length,
    lastPage: 1,
  };

  if (payload && typeof payload === "object" && "meta" in payload) {
    const m = (payload as Record<string, unknown>).meta;
    if (m && typeof m === "object") {
      const mm = m as Record<string, unknown>;
      const currentPage = Number(mm.currentPage ?? mm.page ?? 1) || 1;
      const perPage = Number(mm.perPage ?? mm.per_page ?? 15) || 15;
      const total = Number(mm.total ?? rows.length) || rows.length;
      const lastPage = Math.max(
        1,
        Number(mm.lastPage ?? mm.last_page ?? Math.ceil(total / perPage)) ||
          Math.ceil(total / perPage) ||
          1,
      );
      meta = { currentPage, perPage, total, lastPage };
    }
  }

  return { rows, meta };
}
