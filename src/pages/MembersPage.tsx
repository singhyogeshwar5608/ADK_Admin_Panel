import { membersApi } from "@/api/members";
import { CreateMemberModal } from "@/components/members/CreateMemberModal";
import { MemberStatusBadge } from "@/components/members/MemberStatusBadge";
import { MemberViewModal } from "@/components/members/MemberViewModal";
import { LoadingScreen } from "@/components/LoadingScreen";
import type { MemberListRow, MembersListResponse } from "@/types/memberList";
import { parseMembersListResponse, normalizeMemberRow } from "@/types/memberList";
import { parseApiError } from "@/utils/parseApiError";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, MoreVertical, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

const TABLE_HEADERS = [
  "ID No.",
  "Leader",
  "Leader ID",
  "Left Team",
  "Left BV",
  "Right Team",
  "Right BV",
  "Left Child",
  "Right Child",
  "BV",
  "Team",
  "Status",
  "Joined",
  "Action",
] as const;

function rowId(m: MemberListRow): string | null {
  const id = m.id ?? m.memberId;
  return id != null ? String(id) : null;
}

function formatJoined(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB");
}

export function MembersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editMemberId, setEditMemberId] = useState<string | null>(null);
  const [viewMember, setViewMember] = useState<MemberListRow | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [menuForId, setMenuForId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const q = useQuery({
    queryKey: ["members"],
    queryFn: async () => (await membersApi.list()).data as MembersListResponse | unknown[],
  });

  const del = useMutation({
    mutationFn: (id: string | number) => membersApi.delete(id),
    onSuccess: () => {
      toast.success("Member deleted");
      void qc.invalidateQueries({ queryKey: ["members"] });
      void qc.invalidateQueries({ queryKey: ["binary-tree"] });
    },
    onError: (e) => toast.error(parseApiError(e)),
  });

  const patchStatus = useMutation({
    mutationFn: ({ id, status }: { id: string | number; status: string }) => membersApi.patch(id, { status }),
    onSuccess: (_d, vars) => {
      toast.success(vars.status === "ACTIVE" ? "Member activated" : "Member deactivated");
      void qc.invalidateQueries({ queryKey: ["members"] });
      void qc.invalidateQueries({ queryKey: ["binary-tree"] });
    },
    onError: (e) => toast.error(parseApiError(e)),
    onSettled: () => setMenuForId(null),
  });

  const { rows: sourceRows, total } = useMemo(
    () => parseMembersListResponse(q.data ?? null),
    [q.data],
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return sourceRows;
    const qv = search.toLowerCase();
    return sourceRows.filter(
      (m) =>
        (m.fullName?.toLowerCase().includes(qv) ?? false) ||
        (m.memberId?.toLowerCase().includes(qv) ?? false) ||
        (m.email?.toLowerCase().includes(qv) ?? false),
    );
  }, [sourceRows, search]);

  useEffect(() => {
    if (!menuForId) return;
    const onDoc = (ev: MouseEvent) => {
      const el = menuRef.current;
      if (el && !el.contains(ev.target as Node)) {
        setMenuForId(null);
        setMenuPos(null);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuForId]);

  const onDelete = async (m: MemberListRow) => {
    const id = rowId(m);
    if (!id) {
      toast.error("Member identifier missing");
      return;
    }
    if (!window.confirm(`Delete ${m.fullName ?? m.memberId}? This action cannot be undone.`)) return;
    try {
      await del.mutateAsync(id);
    } catch {
      /* toast in mutation */
    }
  };

  const onToggleStatus = (m: MemberListRow) => {
    const id = rowId(m);
    if (!id) {
      toast.error("Member identifier missing");
      return;
    }
    const next = m.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    patchStatus.mutate({ id, status: next });
  };

  const viewSponsor = async (m: MemberListRow) => {
    setMenuForId(null);
    setMenuPos(null);
    const sponsorId = m.sponsorId;
    if (!sponsorId) {
      toast.error("No sponsor found for this member");
      return;
    }
    setViewMember(null);
    setViewLoading(true);
    try {
      const res = await membersApi.get(sponsorId);
      const payload = res.data as any;
      let raw = payload;
      if (raw && typeof raw === "object") {
        if ("member" in raw) raw = (raw as any).member;
        if (raw && typeof raw === "object" && "data" in raw) raw = (raw as any).data;
      }
      const member = normalizeMemberRow(raw as Record<string, unknown>);
      setViewMember(member);
    } catch (e) {
      toast.error("Failed to load sponsor: " + parseApiError(e));
    } finally {
      setViewLoading(false);
    }
  };

  if (q.isLoading && !q.data) {
    return <LoadingScreen message="Loading members…" />;
  }

  if (q.isError) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-white p-6 dark:border-rose-400/30 dark:bg-slate-950">
        <p className="mb-4 font-semibold text-rose-500">Unable to load members.</p>
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Network</p>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Members</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Track performance and status of every node.</p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row md:w-auto">
          <input
            type="search"
            placeholder="Search by name, ID, or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 rounded-2xl border border-slate-200 bg-transparent px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-white/10 dark:text-white"
          />
          <button
            type="button"
            className="flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-card"
            onClick={() => {
              setEditMemberId(null);
              setCreateOpen(true);
            }}
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            New member
          </button>
        </div>
      </div>

      {/* Mobile */}
      <div className="space-y-3 md:hidden">
        {q.isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse space-y-3 rounded-2xl border border-slate-100 bg-white p-4 dark:border-white/5 dark:bg-slate-950"
              >
                <div className="h-4 w-1/2 rounded bg-slate-100 dark:bg-white/10" />
                <div className="h-3 w-1/3 rounded bg-slate-100 dark:bg-white/10" />
                <div className="h-3 w-1/4 rounded bg-slate-100 dark:bg-white/10" />
              </div>
            ))
          : null}
        {!q.isLoading &&
          filtered.map((m) => {
            const id = rowId(m);
            if (!id) return null;
            const leftTeam = m.stats?.leftTeam ?? 0;
            const rightTeam = m.stats?.rightTeam ?? 0;
            const leftBv = m.stats?.leftBv ?? m.bv?.leftLeg ?? 0;
            const rightBv = m.stats?.rightBv ?? m.bv?.rightLeg ?? 0;
            const leftChild = m.stats?.leftChild ?? "—";
            const rightChild = m.stats?.rightChild ?? "—";
            const statusLabel = m.status === "ACTIVE" ? "Deactivate" : "Activate";
            return (
              <div
                key={id}
                className="space-y-3 rounded-3xl border border-slate-100 bg-white p-4 shadow-card dark:border-white/5 dark:bg-slate-950"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-base font-semibold text-slate-900 dark:text-white">{m.fullName}</p>
                    <p className="text-xs text-slate-400">No. {m.serialNo != null ? String(m.serialNo) : (m.id != null ? String(m.id) : "—")} &middot; {m.memberId}</p>
                  </div>
                  <MemberStatusBadge status={m.status} />
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs text-slate-500 dark:text-slate-300">
                  <div>
                    <p className="text-[10px] uppercase text-slate-400">Left Team</p>
                    <p className="font-semibold text-slate-900 dark:text-white">{leftTeam}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-slate-400">Right Team</p>
                    <p className="font-semibold text-slate-900 dark:text-white">{rightTeam}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-slate-400">Left BV</p>
                    <p className="font-semibold text-slate-900 dark:text-white">{Number(leftBv).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-slate-400">Right BV</p>
                    <p className="font-semibold text-slate-900 dark:text-white">{Number(rightBv).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-slate-400">Left Child</p>
                    <p className="font-semibold text-slate-900 dark:text-white">{leftChild || "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-slate-400">Right Child</p>
                    <p className="font-semibold text-slate-900 dark:text-white">{rightChild || "—"}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-2 text-xs">
                  <button
                    type="button"
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-slate-200 px-3 py-2 font-semibold text-slate-600 dark:border-white/10 dark:text-slate-200"
                    aria-label="View member"
                    onClick={() => setViewMember(m)}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    View
                  </button>
                  <button
                    type="button"
                    className="flex-1 rounded-full border border-slate-200 px-3 py-2 font-semibold text-slate-600 dark:border-white/10 dark:text-slate-200"
                    onClick={() => {
                      const id = rowId(m);
                      if (!id) {
                        toast.error("Member identifier missing");
                        return;
                      }
                      setCreateOpen(false);
                      setEditMemberId(id);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="flex-1 rounded-full border border-slate-200 px-3 py-2 font-semibold text-slate-600 dark:border-white/10 dark:text-slate-200"
                    onClick={() => onToggleStatus(m)}
                  >
                    {statusLabel}
                  </button>
                  {m.status === "PENDING" ? (
                    <button
                      type="button"
                      className="flex-1 rounded-full border border-emerald-200 px-3 py-2 font-semibold text-emerald-600 dark:border-emerald-400/50"
                      onClick={() => {
                        const id = rowId(m);
                        if (!id) {
                          toast.error("Member identifier missing");
                          return;
                        }
                        patchStatus.mutate({ id, status: "ACTIVE" });
                      }}
                    >
                      Approve
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="flex-1 rounded-full border border-amber-200 px-3 py-2 font-semibold text-amber-600 dark:border-amber-400/50"
                      onClick={() => {
                        const id = rowId(m);
                        if (!id) {
                          toast.error("Member identifier missing");
                          return;
                        }
                        patchStatus.mutate({ id, status: "PENDING" });
                      }}
                    >
                      Set Pending
                    </button>
                  )}
                  <button
                    type="button"
                    className="flex-1 rounded-full border border-indigo-200 px-3 py-2 font-semibold text-indigo-600 dark:border-indigo-400/50"
                    onClick={() => void viewSponsor(m)}
                  >
                    View Sponsor
                  </button>
                  <button
                    type="button"
                    className="flex-1 rounded-full border border-rose-200 px-3 py-2 font-semibold text-rose-500 dark:border-rose-400/50"
                    onClick={() => void onDelete(m)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        {!q.isLoading && filtered.length === 0 ? (
          <div className="rounded-3xl border border-slate-100 bg-white p-6 text-center text-slate-400 dark:border-white/5 dark:bg-slate-950">
            No members match your search.
          </div>
        ) : null}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block">
        <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-card dark:border-white/5 dark:bg-slate-950">
          <div className="overflow-x-auto">
            <table className="min-w-[1100px] divide-y divide-slate-100 dark:divide-white/5">
              <thead className="bg-slate-50 dark:bg-white/5">
                <tr>
                  {TABLE_HEADERS.map((h) => (
                    <th
                      key={h}
                      className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-widest text-slate-500 sm:px-6 dark:text-slate-400"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {q.isLoading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        <td colSpan={14} className="px-4 py-6 sm:px-6">
                          <div className="h-4 w-full animate-pulse rounded bg-slate-100 dark:bg-white/5" />
                        </td>
                      </tr>
                    ))
                  : null}
                {!q.isLoading &&
                  filtered.map((m) => {
                    const id = rowId(m);
                    if (!id) return null;
                    const menuOpen = menuForId === id;
                    const leftTeam = m.stats?.leftTeam ?? 0;
                    const rightTeam = m.stats?.rightTeam ?? 0;
                    const leftBv = m.stats?.leftBv ?? m.bv?.leftLeg ?? 0;
                    const rightBv = m.stats?.rightBv ?? m.bv?.rightLeg ?? 0;
                    const leftChild = m.stats?.leftChild ?? "—";
                    const rightChild = m.stats?.rightChild ?? "—";
                    return (
                      <tr key={id} className="hover:bg-slate-50/60 dark:hover:bg-white/5">
                        <td className="px-4 py-4 text-sm text-slate-500 sm:px-6 dark:text-slate-300">
                          {m.serialNo != null ? String(m.serialNo) : (m.id != null ? String(m.id) : "—")}
                        </td>
                        <td className="px-4 py-4 uppercase sm:px-6">
                          <div className="text-slate-900 dark:text-white">{m.fullName}</div>
                        </td>
                        <td className="px-4 py-4 uppercase sm:px-6">
                          <div className="text-slate-900 dark:text-white">{m.memberId}</div>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-500 sm:px-6 dark:text-slate-300">{leftTeam}</td>
                        <td className="px-4 py-4 text-sm text-slate-500 sm:px-6 dark:text-slate-300">
                          {Number(leftBv).toLocaleString()}
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-500 sm:px-6 dark:text-slate-300">{rightTeam}</td>
                        <td className="px-4 py-4 text-sm text-slate-500 sm:px-6 dark:text-slate-300">
                          {Number(rightBv).toLocaleString()}
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-500 sm:px-6 dark:text-slate-300">
                          {leftChild || "—"}
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-500 sm:px-6 dark:text-slate-300">
                          {rightChild || "—"}
                        </td>
                        <td className="px-4 py-4 sm:px-6">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">
                            {m.bv?.total?.toLocaleString() ?? 0}
                          </p>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-500 sm:px-6 dark:text-slate-300">
                          {m.stats?.teamSize ?? 0}
                        </td>
                        <td className="px-4 py-4 sm:px-6">
                          <MemberStatusBadge status={m.status} />
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-500 sm:px-6 dark:text-slate-300">
                          {formatJoined(m.createdAt)}
                        </td>
                        <td className="px-4 py-4 sm:px-6">
                          <div ref={menuOpen ? menuRef : undefined} className="flex items-center gap-1 text-slate-400 sm:gap-2">
                            <button
                              type="button"
                              aria-label={`View ${m.fullName}`}
                              className="rounded-full p-2 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10"
                              onClick={() => setViewMember(m)}
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <div className="relative">
                              <button
                                type="button"
                                aria-expanded={menuOpen}
                                aria-haspopup="menu"
                                aria-label={`More actions for ${m.fullName}`}
                                className="rounded-full p-2 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10"
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  const rect = (ev.currentTarget as HTMLElement).getBoundingClientRect();
                                  if (menuForId === id) {
                                    setMenuForId(null);
                                    setMenuPos(null);
                                  } else {
                                    setMenuForId(id);
                                    setMenuPos({ x: rect.right, y: rect.bottom });
                                  }
                                }}
                              >
                                <MoreVertical className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                {!q.isLoading && filtered.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="px-6 py-12 text-center text-slate-400">
                      No members match your search.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {q.data ? (
            <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4 text-sm text-slate-500 dark:border-white/5 dark:text-slate-400">
              <span>
                Showing {sourceRows.length} of {total} members
              </span>
              <button
                type="button"
                className="text-xs font-semibold uppercase tracking-wide text-primary"
                onClick={() => toast.info("All members are listed in this table.")}
              >
                View all
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <CreateMemberModal
        open={createOpen || editMemberId != null}
        editMemberId={createOpen ? null : editMemberId}
        onClose={() => {
          setCreateOpen(false);
          setEditMemberId(null);
        }}
      />
      <MemberViewModal open={viewMember != null} member={viewMember} onClose={() => setViewMember(null)} isLoading={viewLoading} />

      {menuForId && menuPos ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setMenuForId(null); setMenuPos(null); }} />
          <div
            ref={menuRef}
            className="fixed z-50 w-44 rounded-2xl border border-slate-100 bg-white py-2 shadow-xl dark:border-white/10 dark:bg-slate-900"
            style={{ right: window.innerWidth - menuPos.x, top: menuPos.y }}
          >
            {(() => {
              const m = filtered.find((x) => rowId(x) === menuForId);
              if (!m) return null;
              const toggleLabel = m.status === "ACTIVE" ? "Deactivate" : "Activate";
              return (
                <>
                  <button type="button" className="w-full px-4 py-2 text-left text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10" onClick={() => { setMenuForId(null); setViewMember(m); }}>
                    View
                  </button>
                  <button type="button" className="w-full px-4 py-2 text-left text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10" onClick={() => { setMenuForId(null); const id = rowId(m); if (!id) { toast.error("Member identifier missing"); return; } setCreateOpen(false); setEditMemberId(id); }}>
                    Edit
                  </button>
                  {m.status === "PENDING" ? (
                    <button type="button" className="w-full px-4 py-2 text-left text-sm text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10" onClick={() => { setMenuForId(null); const id = rowId(m); if (!id) { toast.error("Member identifier missing"); return; } patchStatus.mutate({ id, status: "ACTIVE" }); }}>
                      Approve
                    </button>
                  ) : (
                    <button type="button" className="w-full px-4 py-2 text-left text-sm text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/10" onClick={() => { setMenuForId(null); const id = rowId(m); if (!id) { toast.error("Member identifier missing"); return; } patchStatus.mutate({ id, status: "PENDING" }); }}>
                      Set Pending
                    </button>
                  )}
                  <button type="button" className="w-full px-4 py-2 text-left text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10" onClick={() => onToggleStatus(m)}>
                    {toggleLabel}
                  </button>
                  <button type="button" className="w-full px-4 py-2 text-left text-sm text-indigo-600 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-500/10" onClick={() => { void viewSponsor(m); }}>
                    View Sponsor
                  </button>
                  <button type="button" className="w-full px-4 py-2 text-left text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10" onClick={() => { setMenuForId(null); void onDelete(m); }} disabled={del.isPending}>
                    Delete
                  </button>
                </>
              );
            })()}
          </div>
        </>
      ) : null}
    </div>
  );
}
