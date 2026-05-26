/** Normalize varied `/orders` list item shapes into table-ready fields. */

export type RawOrderRecord = Record<string, unknown>;

export type ParsedOrder = {
  id: string | number;
  status: string;
  paymentStatus: string;
  paymentLabel: string;
  amount: number;
  bv: number;
  createdAt?: string;
  memberName: string;
  memberId: string;
  memberEmail: string;
  address?: string;
  shiprocketOrderId?: string;
  shiprocketShipmentId?: string;
  trackingNumber?: string;
  trackingStatus?: string;
  courierName?: string;
  lastTrackedAt?: string;
};

function toNum(v: unknown): number {
  if (v == null || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function memberBlock(r: RawOrderRecord): Record<string, unknown> | null {
  const candidates = [
    r.member,
    r.user,
    r.customer,
    r.buyer,
    r.memberDetails,
    r.member_details,
    r.memberInfo,
    r.member_info,
    r.memberProfile,
    r.member_profile,
    r.memberData,
    r.member_data,
    r.customerDetails,
    r.customer_details,
  ];

  for (const c of candidates) {
    if (c && typeof c === "object") return c as Record<string, unknown>;
  }

  // Fallback: crawl nested objects to find a likely member/user payload.
  const seen = new Set<unknown>();
  const wantKeys = new Set([
    "fullName",
    "full_name",
    "name",
    "username",
    "user_name",
    "email",
    "emailId",
    "email_id",
    "memberId",
    "member_id",
    "memberID",
    "userId",
    "user_id",
    "customerId",
    "customer_id",
  ]);

  const queue: Array<{ v: unknown; depth: number }> = [{ v: r, depth: 0 }];
  while (queue.length) {
    const cur = queue.shift();
    if (!cur) continue;
    const { v, depth } = cur;
    if (!v || typeof v !== "object") continue;
    if (seen.has(v)) continue;
    seen.add(v);

    const o = v as Record<string, unknown>;
    if (Object.keys(o).some((k) => wantKeys.has(k))) return o;
    if (depth >= 3) continue;
    for (const child of Object.values(o)) {
      if (child && typeof child === "object") queue.push({ v: child, depth: depth + 1 });
    }
  }
  return null;
}

export function parseOrderRow(r: RawOrderRecord): ParsedOrder | null {
  const rawId = r.id ?? r.orderId ?? r.order_id;
  if (rawId == null || (typeof rawId !== "string" && typeof rawId !== "number")) return null;

  const id = rawId;
  const mb = memberBlock(r);

  const memberNameRaw =
    mb?.fullName ??
    mb?.full_name ??
    mb?.name ??
    mb?.username ??
    mb?.user_name ??
    r.memberName ??
    r.member_name ??
    r.customerName ??
    r.customer_name ??
    r.name;

  const memberIdRaw =
    mb?.memberId ??
    mb?.member_id ??
    mb?.memberID ??
    mb?.id ??
    r.memberId ??
    r.member_id ??
    r.memberID ??
    r.customerId ??
    r.customer_id ??
    r.userId ??
    r.user_id;

  const memberEmailRaw = mb?.email ?? mb?.email_id ?? mb?.emailId ?? r.memberEmail ?? r.member_email ?? r.email;

  const memberName = String(memberNameRaw ?? "").trim();
  const memberId = String(memberIdRaw ?? "").trim();
  const memberEmail = String(memberEmailRaw ?? "").trim();

  // Last resort: scan the whole order object for member fields.
  let fallbackName = memberName;
  let fallbackEmail = memberEmail;
  let fallbackId = memberId;
  if (!fallbackName || fallbackName === "—") {
    const scan = (o: unknown, depth = 0) => {
      if (!o || typeof o !== "object" || depth > 3) return;
      const obj = o as Record<string, unknown>;
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v === "string") {
          if (!fallbackEmail && k.toLowerCase().includes("email")) fallbackEmail = v;
          if (!fallbackName && (k.toLowerCase().includes("name") || k.toLowerCase().includes("full"))) fallbackName = v;
          if (!fallbackId && k.toLowerCase().includes("member") && k.toLowerCase().includes("id")) fallbackId = v;
        } else if (v && typeof v === "object") scan(v, depth + 1);
      }
    };
    scan(r, 0);
  }

  let status = String(r.status ?? r.orderStatus ?? r.order_status ?? "PENDING")
    .toUpperCase()
    .replace(/\s+/g, "_");
  /** Laravel enum uses `PROCESSING`; some payloads use `CONFIRMED`. */
  if (status === "CONFIRMED") status = "PROCESSING";

  const payRaw = r.paymentStatus ?? r.payment_status ?? r.paymentState ?? r.payment;
  let paymentStatus = typeof payRaw === "string" ? payRaw.toUpperCase().replace(/\s+/g, "_") : "";
  if (!paymentStatus) {
    if (r.paid === true || r.isPaid === true || r.is_paid === true) paymentStatus = "PAID";
    else if (r.refunded === true || r.isRefunded === true) paymentStatus = "REFUNDED";
    else paymentStatus = "PAID";
  }

  const createdAt =
    typeof r.createdAt === "string"
      ? r.createdAt
      : typeof r.created_at === "string"
        ? r.created_at
        : typeof r.placedAt === "string"
          ? r.placedAt
          : typeof r.placed_at === "string"
            ? r.placed_at
            : undefined;

  const amount = toNum(r.amount ?? r.total ?? r.totalAmount ?? r.grandTotal ?? r.total_amount ?? r.payableTotal);
  const bv = toNum(r.bv ?? r.totalBv ?? r.total_bv ?? r.businessVolume ?? r.points ?? 0);

  const paymentLabel = String(r.paymentMethod ?? r.payment_method ?? r.gateway ?? "mock").toLowerCase();

  const rawAddress = r.shippingAddress ?? r.shipping_address ?? r.address;
  let address = "";
  if (typeof rawAddress === "string") {
    address = rawAddress;
  } else if (rawAddress && typeof rawAddress === "object") {
    const addr = rawAddress as Record<string, unknown>;
    const parts = [
      addr.address || addr.shipping_address,
      addr.city,
      addr.state,
      addr.zip_code || addr.pincode || addr.zip || addr.zipcode,
    ].filter(Boolean);
    address = parts.join(", ");
  }

  return {
    id,
    status,
    paymentStatus,
    paymentLabel,
    amount,
    bv,
    createdAt,
    memberName: fallbackName || fallbackId || "—",
    memberId: fallbackId,
    memberEmail: fallbackEmail,
    address,
    shiprocketOrderId: r.shiprocketOrderId as string,
    shiprocketShipmentId: r.shiprocketShipmentId as string,
    trackingNumber: r.trackingNumber as string,
    trackingStatus: r.trackingStatus as string,
    courierName: r.courierName as string,
    lastTrackedAt: r.lastTrackedAt as string,
  };
}

export function formatOrderDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function formatRupeeOrder(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/** Human-readable label; API value for “confirmed” is `PROCESSING`. */
export function formatOrderStatusLabel(status: string): string {
  const s = status.toUpperCase().replace(/\s+/g, "_");
  if (s === "PROCESSING") return "Confirmed";
  return s.replace(/_/g, " ");
}

export function orderStatusBadgeClass(status: string): string {
  const s = status.toUpperCase();
  if (s === "PENDING") return "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200";
  if (s === "CANCELLED" || s === "CANCELED")
    return "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-200";
  if (s === "SHIPPED") return "bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200";
  if (s === "DELIVERED") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200";
  if (s === "PROCESSING" || s === "CONFIRMED")
    return "bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200";
  return "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-200";
}

export function paymentToneClass(ps: string): string {
  const p = ps.toUpperCase();
  if (p === "REFUNDED" || p === "FAILED")
    return "text-rose-600 dark:text-rose-400";
  if (p === "PAID" || p === "CAPTURED" || p === "COMPLETED")
    return "text-slate-900 dark:text-white";
  return "text-slate-800 dark:text-slate-200";
}
