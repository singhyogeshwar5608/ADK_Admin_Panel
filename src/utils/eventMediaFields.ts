/** Parse event media list payloads (`data` array + optional `meta`). */

export type EventMediaMeta = {
  page: number;
  limit: number;
  total: number;
  pages: number;
};

export type EventMediaRow = {
  id: string | number;
  title: string;
  caption: string;
  mediaType: string;
  fileUrl: string;
  mimeType?: string;
  isActive: boolean;
  uploadedAt?: string;
  updatedAt?: string;
};

function toBool(v: unknown, fallback = true): boolean {
  if (v === true || v === false) return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return fallback;
}

function rowFromRecord(r: Record<string, unknown>): EventMediaRow | null {
  const rid = r.id ?? r._id;
  if (rid == null || (typeof rid !== "string" && typeof rid !== "number")) return null;
  const id = rid;
  const fileUrl =
    typeof r.fileUrl === "string"
      ? r.fileUrl
      : typeof r.file_url === "string"
        ? r.file_url
        : typeof r.url === "string"
          ? r.url
          : "";
  if (!fileUrl) return null;
  const mt = String(r.mediaType ?? r.media_type ?? r.type ?? "").toUpperCase();
  const mimeType = typeof r.mimeType === "string" ? r.mimeType : typeof r.mime_type === "string" ? r.mime_type : undefined;

  let mediaType = mt || "IMAGE";
  if (!mt && mimeType?.startsWith("video/")) mediaType = "VIDEO";
  else if (!mt && mimeType?.startsWith("image/")) mediaType = "IMAGE";

  return {
    id,
    title: String(r.title ?? "").trim() || "Untitled",
    caption: String(r.caption ?? r.description ?? "").trim(),
    mediaType,
    fileUrl,
    mimeType,
    isActive: toBool(r.isActive ?? r.is_active, true),
    uploadedAt: typeof r.uploadedAt === "string" ? r.uploadedAt : typeof r.uploaded_at === "string" ? r.uploaded_at : undefined,
    updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : typeof r.updated_at === "string" ? r.updated_at : undefined,
  };
}

const defaultMeta: EventMediaMeta = { page: 1, limit: 12, total: 0, pages: 1 };

export function parseEventMediaListPayload(payload: unknown): { rows: EventMediaRow[]; meta: EventMediaMeta } {
  if (!payload || typeof payload !== "object") {
    return { rows: [], meta: defaultMeta };
  }
  const o = payload as Record<string, unknown>;

  let raw: unknown[] = [];
  if (Array.isArray(payload)) raw = payload;
  else if (Array.isArray(o.data)) raw = o.data as unknown[];
  else if (Array.isArray(o.items)) raw = o.items;

  const rows = raw
    .map((x) => (x && typeof x === "object" ? rowFromRecord(x as Record<string, unknown>) : null))
    .filter(Boolean) as EventMediaRow[];

  let meta = { ...defaultMeta, total: rows.length };
  const m = o.meta;
  if (m && typeof m === "object") {
    const mo = m as Record<string, unknown>;
    meta = {
      page: Number(mo.page ?? 1) || 1,
      limit: Number(mo.limit ?? 12) || 12,
      total: Number(mo.total ?? rows.length) || rows.length,
      pages: Math.max(1, Number(mo.pages ?? Math.ceil(rows.length / (Number(mo.limit) || 12))) || 1),
    };
  }

  return { rows, meta };
}

export function isVideoRow(r: Pick<EventMediaRow, "mediaType" | "mimeType">): boolean {
  const t = r.mediaType.toUpperCase();
  if (t === "VIDEO") return true;
  return r.mimeType?.startsWith("video/") ?? false;
}

export function formatMediaDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
