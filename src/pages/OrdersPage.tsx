import { ordersApi } from "@/api/orders";
import { LoadingScreen } from "@/components/LoadingScreen";
import { normalizeList } from "@/utils/normalizeList";
import {
  formatOrderDate,
  formatOrderStatusLabel,
  formatRupeeOrder,
  orderStatusBadgeClass,
  parseOrderRow,
  paymentToneClass,
  type ParsedOrder,
  type RawOrderRecord,
} from "@/utils/orderFields";
import { parseApiError } from "@/utils/parseApiError";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Truck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const PAGE_SIZE = 10;

const PAYMENT_FILTERS = ["ALL", "PAID", "REFUNDED", "PENDING", "FAILED"] as const;

const TH =
  "px-4 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500 sm:px-5 dark:text-slate-400";

/** Matches `OrderStatusUpdateRequest` in Laravel (`PROCESSING`, not `CONFIRMED`). */
const API_ORDER_STATUSES = ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"] as const;

function statusValuesForSelect(current: string): string[] {
  const u = current.toUpperCase().replace(/\s+/g, "_");
  const normalized = u === "CONFIRMED" ? "PROCESSING" : u;
  const set = new Set<string>([...API_ORDER_STATUSES]);
  if (normalized && !set.has(normalized)) set.add(normalized);
  return Array.from(set);
}

export function OrdersPage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["orders"],
    queryFn: async () => (await ordersApi.list()).data,
  });

  const [orderFilter, setOrderFilter] = useState<string>("ALL");
  const [paymentFilter, setPaymentFilter] = useState<(typeof PAYMENT_FILTERS)[number]>("ALL");
  const [memberSearch, setMemberSearch] = useState("");
  const [page, setPage] = useState(1);

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string | number; status: string }) => ordersApi.status(id, { status }),
    onSuccess: () => {
      toast.success("Status updated");
      void qc.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (e) => toast.error(parseApiError(e)),
  });

  const syncMut = useMutation({
    mutationFn: (id: string | number) => ordersApi.syncTracking(id),
    onSuccess: () => {
      toast.success("Tracking status synced");
      void qc.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (e) => toast.error(parseApiError(e)),
  });

  const rawRows = useMemo(() => normalizeList(q.data ?? null) as RawOrderRecord[], [q.data]);
  const parsed = useMemo(
    () => rawRows.map((r) => parseOrderRow(r)).filter(Boolean) as ParsedOrder[],
    [rawRows],
  );

  const filtered = useMemo(() => {
    let list = [...parsed];
    if (orderFilter !== "ALL") {
      list = list.filter((o) => o.status === orderFilter.toUpperCase());
    }
    if (paymentFilter !== "ALL") {
      list = list.filter((o) => o.paymentStatus === paymentFilter.toUpperCase());
    }
    const qv = memberSearch.trim().toLowerCase();
    if (qv) {
      list = list.filter(
        (o) =>
          o.memberName.toLowerCase().includes(qv) ||
          o.memberEmail.toLowerCase().includes(qv) ||
          o.memberId.toLowerCase().includes(qv),
      );
    }
    return list;
  }, [parsed, orderFilter, paymentFilter, memberSearch]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, page), pageCount);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [orderFilter, paymentFilter, memberSearch]);

  useEffect(() => {
    setPage((p) => Math.min(p, pageCount));
  }, [pageCount]);

  if (q.isLoading && !q.data) return <LoadingScreen message="Loading orders…" />;

  if (q.isError) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-white p-6 dark:border-rose-400/30 dark:bg-slate-950">
        <p className="mb-4 font-semibold text-rose-600">Unable to load orders.</p>
        <button
          type="button"
          onClick={() => void q.refetch()}
          className="rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white"
        >
          Retry
        </button>
      </div>
    );
  }

  const orderFilterOptions = ["ALL", ...new Set(parsed.map((o) => o.status))].sort();

  const filterSelectClass =
    "h-10 min-w-[180px] rounded-full border border-slate-200 bg-white/80 px-4 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 dark:border-white/10 dark:bg-slate-900/60 dark:text-white";
  const filterInputClass =
    "h-10 w-full rounded-full border border-slate-200 bg-white/80 px-4 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/15 dark:border-white/10 dark:bg-slate-900/60 dark:text-white";

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-slate-400">Logistics</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Orders</h1>
        <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
          Monitor fulfillment, payments, and refunds in real time.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white/70 p-3 shadow-sm backdrop-blur-sm dark:border-white/5 dark:bg-slate-950/60">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <select value={orderFilter} onChange={(e) => setOrderFilter(e.target.value)} className={filterSelectClass}>
            {orderFilterOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt === "ALL" ? "ALL" : formatOrderStatusLabel(opt)}
              </option>
            ))}
          </select>
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value as (typeof PAYMENT_FILTERS)[number])}
            className={filterSelectClass}
          >
            {PAYMENT_FILTERS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <input
            type="search"
            placeholder="Search member"
            value={memberSearch}
            onChange={(e) => setMemberSearch(e.target.value)}
            className={filterInputClass}
          />
        </div>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {pageItems.map((o) => (
          <div
            key={String(o.id)}
            className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-white/5 dark:bg-slate-950"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-bold text-slate-900 dark:text-white">#{String(o.id)}</p>
                <p className="text-xs text-slate-500">{formatOrderDate(o.createdAt)}</p>
              </div>
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${orderStatusBadgeClass(o.status)}`}
              >
                {formatOrderStatusLabel(o.status)}
              </span>
            </div>
            <p className="mt-2 font-semibold text-slate-900 dark:text-white">{o.memberName}</p>
            <p className="text-xs text-slate-500">
              {o.memberId || "—"} · {o.memberEmail || "—"}
            </p>
            {o.address && (
              <p className="mt-1 text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
                {o.address}
              </p>
            )}
            <p className="mt-2 font-semibold text-slate-900 dark:text-white">
              {formatRupeeOrder(o.amount)} · BV {o.bv || "—"}
            </p>

            {(o.shiprocketOrderId || o.trackingNumber) && (
              <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50/50 p-2.5 dark:border-white/5 dark:bg-white/[0.02]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="space-y-1">
                    {o.shiprocketOrderId && (
                      <p className="text-[10px] font-bold text-slate-500 uppercase">
                        SR ID: <span className="text-slate-900 dark:text-white">{o.shiprocketOrderId}</span>
                      </p>
                    )}
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-900 dark:text-white">
                      <Truck size={12} className="text-slate-400" />
                      <span>{o.trackingNumber || "AWB Pending"}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => syncMut.mutate(o.id)}
                    disabled={syncMut.isPending}
                    className="rounded-lg bg-white px-2 py-1 text-[10px] font-bold uppercase text-slate-500 shadow-sm dark:bg-slate-900"
                  >
                    Sync
                  </button>
                </div>
                {o.trackingStatus && (
                  <p className="mt-1.5 text-[10px] font-bold uppercase text-indigo-600 dark:text-indigo-400">
                    {o.trackingStatus}
                  </p>
                )}
              </div>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              <select
                value={o.status === "CONFIRMED" ? "PROCESSING" : o.status}
                disabled={statusMut.isPending}
                onChange={(e) => statusMut.mutate({ id: o.id, status: e.target.value })}
                className="rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold dark:border-white/10 dark:bg-slate-900 dark:text-white"
              >
                {statusValuesForSelect(o.status).map((s) => (
                  <option key={s} value={s}>
                    {formatOrderStatusLabel(s)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
        {pageItems.length === 0 ? (
          <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center text-slate-500 dark:border-white/5 dark:bg-slate-950">
            No orders match your filters.
          </div>
        ) : null}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:border-white/5 dark:bg-slate-950 md:block dark:shadow-none">
        <div className="overflow-x-auto">
          <table className="min-w-[1000px] w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/90 dark:border-white/5 dark:bg-white/[0.03]">
                <th className={TH}>Order</th>
                <th className={TH}>Member</th>
                <th className={TH}>Totals</th>
                <th className={TH}>Status</th>
                <th className={TH}>Payment</th>
                <th className={TH}>Shiprocket</th>
                <th className={`${TH} min-w-[220px]`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((o) => (
                <tr
                  key={String(o.id)}
                  className="border-b border-slate-100 transition last:border-0 hover:bg-slate-50/50 dark:border-white/5 dark:hover:bg-white/[0.02]"
                >
                  <td className="px-4 py-4 sm:px-5">
                    <p className="font-bold text-slate-900 dark:text-white">#{String(o.id)}</p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{formatOrderDate(o.createdAt)}</p>
                  </td>
                  <td className="px-4 py-4 sm:px-5">
                    <p className="font-bold text-slate-900 dark:text-white">{o.memberName}</p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {o.memberId ? `${o.memberId} · ` : ""}
                      {o.memberEmail || "—"}
                    </p>
                    {o.address && (
                      <p className="mt-1 text-[11px] leading-relaxed text-slate-400 line-clamp-2 max-w-[250px] dark:text-slate-500">
                        {o.address}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-4 font-semibold text-slate-900 dark:px-5 dark:text-white">
                    <p>{formatRupeeOrder(o.amount)}</p>
                    <p className="mt-0.5 text-xs font-bold text-slate-600 dark:text-slate-300">BV {o.bv || "—"}</p>
                  </td>
                  <td className="px-4 py-4 sm:px-5">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${orderStatusBadgeClass(o.status)}`}
                    >
                      {formatOrderStatusLabel(o.status)}
                    </span>
                  </td>
                  <td className="px-4 py-4 sm:px-5">
                    <p className={`text-sm font-bold uppercase ${paymentToneClass(o.paymentStatus)}`}>
                      {o.paymentStatus.replace(/_/g, " ")}
                    </p>
                    <p className="text-xs capitalize text-slate-400 dark:text-slate-500">{o.paymentLabel}</p>
                  </td>
                  <td className="px-4 py-4 sm:px-5">
                    {o.shiprocketOrderId || o.trackingNumber ? (
                      <div className="space-y-1.5">
                        {o.shiprocketOrderId && (
                          <div className="flex flex-col">
                            <span className="text-[10px] font-bold uppercase text-slate-400">Order ID</span>
                            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                              {o.shiprocketOrderId}
                            </span>
                          </div>
                        )}
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold uppercase text-slate-400">Tracking / AWB</span>
                          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white">
                            <Truck size={12} className="text-slate-400" />
                            <span>{o.trackingNumber || "AWB Pending"}</span>
                          </div>
                        </div>
                        {o.courierName && (
                          <p className="text-[10px] font-bold text-slate-500 uppercase">
                            {o.courierName}
                          </p>
                        )}
                        {o.trackingStatus && (
                          <p className="text-[10px] font-bold uppercase text-indigo-600 dark:text-indigo-400">
                            {o.trackingStatus}
                          </p>
                        )}
                        <button
                          type="button"
                          onClick={() => syncMut.mutate(o.id)}
                          disabled={syncMut.isPending}
                          className="flex items-center gap-1 text-[10px] font-bold uppercase text-slate-400 hover:text-primary pt-1"
                        >
                          <RefreshCw size={10} className={syncMut.isPending ? "animate-spin" : ""} />
                          Sync Status
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-medium text-slate-300 uppercase italic">Not Integrated</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4 sm:px-5">
                    <select
                      value={o.status === "CONFIRMED" ? "PROCESSING" : o.status}
                      disabled={statusMut.isPending}
                      onChange={(e) => statusMut.mutate({ id: o.id, status: e.target.value })}
                      className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-800 outline-none focus:border-primary dark:border-white/10 dark:bg-slate-900 dark:text-white"
                    >
                      {statusValuesForSelect(o.status).map((s) => (
                        <option key={s} value={s}>
                          {formatOrderStatusLabel(s)}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
              {pageItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-slate-500">
                    No orders match your filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-5 py-3.5 text-sm text-slate-500 dark:border-white/5 dark:text-slate-400">
          <span>
            Showing {pageItems.length} of {filtered.length} order{filtered.length === 1 ? "" : "s"}
            {parsed.length !== filtered.length ? ` (of ${parsed.length} total)` : ""}
          </span>
          <div className="flex flex-wrap items-center gap-3">
            {pageCount > 1 ? (
              <>
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="text-xs font-semibold uppercase text-slate-500 hover:text-slate-800 disabled:opacity-40 dark:hover:text-white"
                >
                  Prev
                </button>
                <span className="text-xs tabular-nums">
                  {currentPage} / {pageCount}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= pageCount}
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  className="text-xs font-semibold uppercase text-slate-500 hover:text-slate-800 disabled:opacity-40 dark:hover:text-white"
                >
                  Next
                </button>
              </>
            ) : null}
            <button
              type="button"
              className="text-xs font-bold uppercase tracking-widest text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
              onClick={() => {
                setOrderFilter("ALL");
                setPaymentFilter("ALL");
                setMemberSearch("");
                setPage(1);
                toast.info("Showing all orders.");
              }}
            >
              View all
            </button>
          </div>
        </div>
      </div>

      {/* Mobile pagination */}
      {pageCount > 1 ? (
        <div className="flex items-center justify-center gap-4 text-sm text-slate-600 md:hidden dark:text-slate-300">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="font-semibold disabled:opacity-40"
          >
            Prev
          </button>
          <span className="tabular-nums">
            {currentPage} / {pageCount}
          </span>
          <button
            type="button"
            disabled={currentPage >= pageCount}
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            className="font-semibold disabled:opacity-40"
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}
