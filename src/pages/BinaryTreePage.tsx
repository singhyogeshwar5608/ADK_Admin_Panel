import { membersApi } from "@/api/members";
import { CreateMemberModal, type Leg } from "@/components/members/CreateMemberModal";
import { MemberViewModal } from "@/components/members/MemberViewModal";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownCircle, ArrowLeft, Search, UserPlus, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { normalizeList } from "@/utils/normalizeList";
import { normalizeMemberRow, type MemberListRow } from "@/types/memberList";
import { toast } from "sonner";
import { parseApiError } from "@/utils/parseApiError";
import { computeBinaryTreeLayout, maxMemberDepth, canvasSize, DEFAULT_OPTIONS, type TreeNodeData, type LayoutOptions } from "@/utils/binaryTreeLayout";

// ────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────

type AnyObj = Record<string, unknown>;

type TreeNode = {
  id: string;
  memberId: string;
  name: string;
  role?: string;
  type?: string;
  profileUrl?: string | null;
  isActive?: boolean | null;
  statusRaw?: string | null;
  binaryPurchasePaid?: boolean | null;
  totalBv?: number | null;
  leftBv?: number | null;
  rightBv?: number | null;
  left?: TreeNode | null;
  right?: TreeNode | null;
};

// ────────────────────────────────────────────────────────────────────
// Layout constants
// ────────────────────────────────────────────────────────────────────

const NODE_W = DEFAULT_OPTIONS.nodeWidth;    // 144
const NODE_H = DEFAULT_OPTIONS.nodeHeight;   // 106
const LAYOUT_OPTS: LayoutOptions = { ...DEFAULT_OPTIONS };

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────

function toNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function toStr(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function pick(o: AnyObj, keys: string[]): unknown {
  for (const k of keys) if (k in o) return o[k];
  return undefined;
}

function looksLikeHasEdges(raw: unknown): boolean {
  const seen = new Set<unknown>();
  const stack: unknown[] = [raw];
  while (stack.length) {
    const cur = stack.pop();
    if (!cur || typeof cur !== "object") continue;
    if (seen.has(cur)) continue;
    seen.add(cur);
    const o = cur as AnyObj;
    if (
      "left" in o || "right" in o || "leftChild" in o || "rightChild" in o ||
      "left_child" in o || "right_child" in o || "left_member" in o ||
      "right_member" in o || "children" in o || "nodes" in o || "legs" in o
    ) return true;
    for (const v of Object.values(o)) if (v && typeof v === "object") stack.push(v);
  }
  return false;
}

function findLikelyTreeRoot(raw: unknown): unknown {
  const seen = new Set<unknown>();
  const stack: unknown[] = [raw];
  while (stack.length) {
    const cur = stack.pop();
    if (!cur || typeof cur !== "object") continue;
    if (seen.has(cur)) continue;
    seen.add(cur);
    const o = cur as AnyObj;
    const hasMemberFields =
      "member_id" in o || "memberId" in o || "fullName" in o ||
      "full_name" in o || "name" in o || "username" in o;
    const hasTreeEdges =
      "left" in o || "right" in o || "leftChild" in o || "rightChild" in o ||
      "children" in o || "nodes" in o;
    if (hasTreeEdges && hasMemberFields) return cur;
    for (const v of Object.values(o)) {
      if (v && typeof v === "object") stack.push(v);
    }
  }
  return raw;
}

function parseNode(raw: unknown): TreeNode | null {
  if (!raw || typeof raw !== "object") return null;
  const o0 = raw as AnyObj;
  const innerMember = pick(o0, ["member", "user", "profile", "data"]);
  const o = (innerMember && typeof innerMember === "object" ? innerMember : o0) as AnyObj;

  const id = pick(o, ["id", "_id", "member_id", "memberId"]);
  const memberId = pick(o, ["memberId", "member_id", "memberID", "member"]);
  const name = pick(o, ["fullName", "full_name", "name", "username", "displayName"]);
  const role = pick(o, ["role"]);
  const memberType = pick(o, ["type"]);
  const profileUrl = pick(o, ["profileImage", "profile_image", "profileUrl", "profile_url", "avatar", "photo"]);
  const isActive = pick(o, ["isActive", "is_active", "active", "status"]);
  const statusRaw = typeof isActive === "string" ? isActive : null;
  const totalBv = pick(o, ["totalBv", "total_bv", "bv", "totalBV"]);
  const leftBv = pick(o, ["leftBv", "left_bv", "leftBV"]);
  const rightBv = pick(o, ["rightBv", "right_bv", "rightBV"]);

  const rawLeftDirect = pick(o0, ["left", "leftChild", "left_child", "l", "left_member", "leftMember", "left_node", "leftNode"]);
  const rawRightDirect = pick(o0, ["right", "rightChild", "right_child", "r", "right_member", "rightMember", "right_node", "rightNode"]);
  let rawLeft = rawLeftDirect;
  let rawRight = rawRightDirect;

  const children = pick(o0, ["children", "nodes", "legs"]);
  if ((!rawLeft || !rawRight) && Array.isArray(children)) {
    for (const child of children as unknown[]) {
      if (!child || typeof child !== "object") continue;
      const co = child as AnyObj;
      const side = toStr(pick(co, ["side", "position", "leg", "slot"])).toLowerCase();
      if (!rawLeft && ["l", "left", "0"].includes(side)) rawLeft = child;
      if (!rawRight && ["r", "right", "1"].includes(side)) rawRight = child;
      if (!rawLeft && "left" in co) rawLeft = co.left;
      if (!rawRight && "right" in co) rawRight = co.right;
    }
  }

  const left = parseNode(rawLeft);
  const right = parseNode(rawRight);

  const status =
    typeof isActive === "boolean" ? isActive :
    typeof isActive === "string" ? ["active", "1", "true", "yes"].includes(isActive.toLowerCase()) : null;

  const btp = pick(o, ["binaryTreePurchaseState", "binary_tree_purchase_state"]);
  const binaryPurchasePaid = btp === "paid" ? true : btp === "pending_payment" ? false : null;

  return {
    id: toStr(id || memberId || name || "0") || "0",
    memberId: toStr(memberId || id) || "—",
    name: toStr(name) || "Member",
    role: toStr(role) || undefined,
    type: toStr(memberType)?.toUpperCase() || undefined,
    profileUrl: typeof profileUrl === "string" ? profileUrl : null,
    isActive: status,
    statusRaw,
    binaryPurchasePaid,
    totalBv: toNum(totalBv),
    leftBv: toNum(leftBv),
    rightBv: toNum(rightBv),
    left,
    right,
  };
}

function parseFlatMemberNode(raw: unknown): TreeNode | null {
  if (!raw || typeof raw !== "object") return null;
  let o = raw as AnyObj;
  const inner = pick(o, ["member", "user", "data"]);
  if (inner && typeof inner === "object") o = inner as AnyObj;

  const id = pick(o, ["id", "_id"]);
  const memberId = pick(o, ["memberId", "member_id", "memberID"]);
  const name = pick(o, ["fullName", "full_name", "name", "username"]);
  const role = pick(o, ["role"]);
  const memberType = pick(o, ["type"]);
  const profileUrl = pick(o, ["profileImage", "profile_image", "profileUrl", "profile_url"]);
  const st = pick(o, ["status", "member_status", "memberStatus"]);
  const statusRaw = typeof st === "string" ? st : null;
  const isActive =
    typeof st === "boolean" ? st :
    typeof st === "string" ? ["ACTIVE", "active", "1", "enabled"].includes(st) : null;

  let totalBvVal: unknown;
  let leftBvVal: unknown;
  let rightBvVal: unknown;
  const bv = pick(o, ["bv"]);
  if (bv && typeof bv === "object") {
    const b = bv as AnyObj;
    totalBvVal = pick(b, ["total", "totalBv", "total_bv"]);
    leftBvVal = pick(b, ["leftLeg", "left_leg", "leftLegBv", "left_bv"]);
    rightBvVal = pick(b, ["rightLeg", "right_leg", "rightLegBv", "right_bv"]);
  } else {
    totalBvVal = pick(o, ["totalBv", "total_bv", "bv"]);
    leftBvVal = pick(o, ["leftBv", "left_bv", "bv_left_leg"]);
    rightBvVal = pick(o, ["rightBv", "right_bv", "bv_right_leg"]);
  }

  const btp = pick(o, ["binaryTreePurchaseState", "binary_tree_purchase_state"]);
  const binaryPurchasePaid = btp === "paid" ? true : btp === "pending_payment" ? false : null;

  const stats = pick(o, ["stats"]);
  let leftBv2 = leftBvVal;
  let rightBv2 = rightBvVal;
  if ((!leftBv2 || !rightBv2) && stats && typeof stats === "object") {
    const s = stats as AnyObj;
    if (!leftBv2) leftBv2 = s.leftBv ?? s.left_bv ?? s.left_leg_bv;
    if (!rightBv2) rightBv2 = s.rightBv ?? s.right_bv ?? s.right_leg_bv;
  }

  return {
    id: toStr(id || memberId || name || "0") || "0",
    memberId: toStr(memberId || id) || "—",
    name: toStr(name) || "Member",
    role: toStr(role) || undefined,
    type: toStr(memberType)?.toUpperCase() || undefined,
    profileUrl: typeof profileUrl === "string" ? profileUrl : null,
    isActive,
    statusRaw,
    binaryPurchasePaid,
    totalBv: toNum(totalBvVal),
    leftBv: toNum(leftBv2),
    rightBv: toNum(rightBv2),
    left: null,
    right: null,
  };
}

function placementPathOfMember(o: AnyObj): string {
  const p = pick(o, ["placementPath", "placement_path"]);
  return typeof p === "string" ? p.trim() : "";
}

function laravelBinaryNodes(payload: AnyObj): AnyObj[] {
  const n = payload.nodes;
  if (Array.isArray(n)) return n as AnyObj[];
  if (n && typeof n === "object") {
    const inner = (n as AnyObj).data;
    if (Array.isArray(inner)) return inner as AnyObj[];
  }
  return [];
}

function buildTreeFromFlatPlacementPayload(payload: unknown): TreeNode | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as AnyObj;
  const rawRoot = p.root;
  if (!rawRoot || typeof rawRoot !== "object") return null;

  const rootInner = rawRoot as AnyObj;
  const ppRoot = placementPathOfMember(rootInner);

  // Backend query `LIKE 'root%'` root ko bhi nodes mein include kar deta hai,
  // isliye nodes mein se root jaisi placementPath wale entries hatao
  const childNodes = laravelBinaryNodes(p).filter((n) => placementPathOfMember(n) !== ppRoot);

  const rows = [rootInner, ...childNodes].filter(Boolean);
  const byPath = new Map<string, AnyObj>();
  for (const row of rows) {
    const path = placementPathOfMember(row);
    if (!path) continue;
    byPath.set(path, row);
  }

  const buildFrom = (m: AnyObj): TreeNode | null => {
    const base = parseFlatMemberNode(m);
    if (!base) return null;
    const pp = placementPathOfMember(m);
    if (!pp) return base;

    const leftRaw = byPath.get(`${pp}.L`) ?? null;
    const rightRaw = byPath.get(`${pp}.R`) ?? null;
    const leftTree = leftRaw ? buildFrom(leftRaw) : null;
    const rightTree = rightRaw ? buildFrom(rightRaw) : null;

    return { ...base, left: leftTree, right: rightTree };
  };

  if (!ppRoot) return parseFlatMemberNode(rootInner);
  const tree = buildFrom(rootInner);

  if (tree && !tree.left && !tree.right && byPath.size > 1 && rows.length > 1) {
    return null;
  }

  return tree;
}

const BINARY_TREE_FETCH_DEPTH = 200;

// ────────────────────────────────────────────────────────────────────
// Display helpers
// ────────────────────────────────────────────────────────────────────

function initials(name: string) {
  const t = name.trim();
  if (!t) return "N/A";
  const parts = t.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? t[0];
  const b = parts.length > 1 ? parts[1][0] : (t[1] ?? "");
  return `${a}${b}`.toUpperCase();
}

function formatInt(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return Math.round(n).toLocaleString("en-IN");
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

// ────────────────────────────────────────────────────────────────────
// Node Card — 144 × 106 fixed
// ────────────────────────────────────────────────────────────────────

function MemberNodeCard({
  node,
  isRoot,
  isPlaceholder,
  onClick,
  onRegister,
  leg,
}: {
  node: TreeNode | TreeNodeData;
  isRoot: boolean;
  isPlaceholder?: boolean;
  onClick?: () => void;
  onRegister?: (leg: Leg) => void;
  leg?: "LEFT" | "RIGHT";
}) {
  if (isPlaceholder) {
    const slotLabel = leg === "LEFT" ? "Open Left" : "Open Right";
    return (
      <button
        type="button"
        onClick={() => onRegister?.(leg === "LEFT" ? "LEFT" : "RIGHT")}
        style={{ width: NODE_W, height: NODE_H }}
        className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-blue-400/70 bg-blue-50/40 text-blue-700 transition hover:bg-blue-50 dark:border-sky-500/50 dark:bg-sky-500/10 dark:text-sky-200"
        aria-label={`Register in ${slotLabel} slot`}
      >
        <UserPlus className="h-6 w-6" strokeWidth={1.6} />
        <span className="text-[9px] font-bold uppercase tracking-[0.18em]">{slotLabel}</span>
      </button>
    );
  }

  const cardBg =
    node.statusRaw === "PENDING" ? "bg-amber-300 dark:bg-amber-700/60" :
    node.statusRaw === "ACTIVE" ? "bg-emerald-200 dark:bg-emerald-700/50" :
    "bg-white dark:bg-slate-950";

  const cardText =
    node.statusRaw === "PENDING" || node.statusRaw === "ACTIVE" ? "text-black dark:text-black" :
    "text-slate-900 dark:text-white";

  let borderRing = "border border-slate-200 dark:border-white/10 shadow-sm transition-all hover:border-primary/50 hover:shadow-md cursor-pointer";
  if (isRoot)
    borderRing = "border-2 border-amber-400 ring-2 ring-amber-200/70 dark:border-amber-400 dark:ring-amber-900/40 transition-all hover:border-amber-500 hover:ring-amber-300 cursor-pointer";

  return (
    <div
      onClick={onClick}
      style={{ width: NODE_W, height: NODE_H }}
      className={["relative flex flex-col items-center justify-center rounded-2xl px-2", cardBg, borderRing].join(" ")}
    >
      {isRoot && (
        <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-amber-400 px-2.5 py-0.5 text-[8px] font-black uppercase tracking-[0.2em] text-slate-900">
          Root
        </span>
      )}

      {/* Avatar */}
      {node.profileUrl ? (
        <img src={node.profileUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
      ) : (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500 dark:bg-white/10 dark:text-slate-300">
          {initials(node.name)}
        </div>
      )}

      {/* Member ID */}
      <p className="mt-1 w-full truncate text-center text-[9px] font-semibold uppercase tracking-[0.05em] text-slate-400 dark:text-slate-500">
        {node.memberId}
      </p>

      {/* Name */}
      <p className={`w-full truncate text-center text-[11px] font-bold leading-tight ${cardText}`}>
        {truncate(node.name, 15)}
      </p>

      {/* Type badge */}
      {node.type && (
        <span
          className={[
            "mt-1 rounded-full px-2 py-0.5 text-[8px] font-extrabold uppercase tracking-[0.12em]",
            node.type === "LEADER"
              ? "bg-amber-100 text-amber-800 dark:bg-amber-400/20 dark:text-amber-200"
              : "bg-purple-600 text-white dark:bg-purple-600 dark:text-white",
          ].join(" ")}
        >
          {node.type === "LEADER" ? "Leader" : "User"}
        </span>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Elbow Connector (3-segment: vertical → horizontal → vertical)
// ────────────────────────────────────────────────────────────────────

function ElbowConnector({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  const midY = y1 + (y2 - y1) / 2;
  const d = `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`;
  return (
    <path d={d} fill="none" stroke="#bdc5dc" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
  );
}

// ────────────────────────────────────────────────────────────────────
// Main Page
// ────────────────────────────────────────────────────────────────────

type RegisterSlotContext = { sponsor: TreeNode; leg: Leg };

export function BinaryTreePage() {
  const DEFAULT_TREE_ROOT = "root";
  const [input, setInput] = useState("");
  const [memberId, setMemberId] = useState("");
  const [zoom, setZoom] = useState(1);
  const [registerCtx, setRegisterCtx] = useState<RegisterSlotContext | null>(null);
  const [viewMember, setViewMember] = useState<MemberListRow | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  const handleNodeClick = useCallback(async (node: TreeNode) => {
    const target = node.id && !isNaN(Number(node.id)) ? node.id : node.memberId;
    if (!target) return;
    setViewMember(null);
    setViewLoading(true);
    try {
      const res = await membersApi.get(target);
      const payload = res.data as any;
      let raw = payload;
      if (raw && typeof raw === "object") {
        if ("member" in raw) raw = (raw as any).member;
        if (raw && typeof raw === "object" && "data" in raw) raw = (raw as any).data;
      }
      const member = normalizeMemberRow(raw as Record<string, unknown>);
      setViewMember(member);
    } catch (e) {
      toast.error("Failed to load member details: " + parseApiError(e));
    } finally {
      setViewLoading(false);
    }
  }, []);

  const binaryRegisterPrefill = useMemo(() => {
    if (!registerCtx) return null;
    return {
      sponsorLabel: `${registerCtx.sponsor.name} (${registerCtx.sponsor.memberId})`,
      sponsorMemberCode: registerCtx.sponsor.memberId,
      leg: registerCtx.leg,
    };
  }, [registerCtx]);

  const q = useQuery({
    queryKey: ["binary-tree", memberId],
    enabled: Boolean(memberId),
    queryFn: async () => {
      const first = (await membersApi.tree(memberId, BINARY_TREE_FETCH_DEPTH)).data;
      if (looksLikeHasEdges(first)) return first;
      try {
        const me = (await membersApi.get(memberId)).data as AnyObj;
        const resolvedId = pick(me, ["id", "_id"]);
        if (resolvedId != null && String(resolvedId).trim()) {
          const second = (await membersApi.tree(resolvedId as string | number, BINARY_TREE_FETCH_DEPTH)).data;
          if (looksLikeHasEdges(second)) return second;
        }
      } catch { /* ignore */ }
      try {
        const listRes = await membersApi.list();
        const rows = normalizeList(listRes.data);
        const want = memberId.trim().toLowerCase();
        const hit = rows.find((r) => {
          const rid = String(r.id ?? r._id ?? "").trim().toLowerCase();
          const rmid = String(r.memberId ?? r.member_id ?? r.memberID ?? "").trim().toLowerCase();
          return rid === want || rmid === want;
        });
        const resolved = hit?.id ?? hit?._id;
        if (resolved != null && String(resolved).trim() && String(resolved).trim() !== memberId.trim()) {
          const second = (await membersApi.tree(resolved as string | number, BINARY_TREE_FETCH_DEPTH)).data;
          return second;
        }
      } catch { /* ignore */ }
      return first;
    },
  });

  useEffect(() => {
    if (memberId) return;
    const next = DEFAULT_TREE_ROOT;
    if (!next) return;
    setInput(next);
    setMemberId(next);
  }, [memberId]);

  const rootNode = useMemo(() => {
    if (!q.data) return null;
    const payload = q.data as unknown;
    if (!payload || typeof payload !== "object") return null;
    const flat = buildTreeFromFlatPlacementPayload(payload);
    if (flat) return flat;
    const o = payload as AnyObj;
    const root = pick(o, ["root", "data", "tree", "node", "member", "network"]);
    return parseNode(findLikelyTreeRoot(root ?? o));
  }, [q.data]);

  const treeDisplayMaxDepth = useMemo(() => {
    if (!rootNode) return 2;
    return maxMemberDepth(rootNode as unknown as TreeNodeData) + 1;
  }, [rootNode]);

  const layoutNodes = useMemo(() => {
    if (!rootNode) return [];
    return computeBinaryTreeLayout(rootNode as unknown as TreeNodeData, treeDisplayMaxDepth, LAYOUT_OPTS);
  }, [rootNode, treeDisplayMaxDepth]);

  const treeSize = useMemo(() => {
    return layoutNodes.length > 0 ? canvasSize(layoutNodes, LAYOUT_OPTS) : { width: 0, height: 0 };
  }, [layoutNodes]);

  // ── Stats ───────────────────────────────────────────────────────
  const realNodes = useMemo(() => layoutNodes.filter((n) => !n.isPlaceholder), [layoutNodes]);
  const leftCount = useMemo(() => layoutNodes.filter((n) => !n.isPlaceholder && n.leg === "LEFT").length, [layoutNodes]);
  const rightCount = useMemo(() => layoutNodes.filter((n) => !n.isPlaceholder && n.leg === "RIGHT").length, [layoutNodes]);
  const totalBv = useMemo(() => {
    return realNodes.reduce((sum, n) => sum + (n.node.totalBv ?? 0), 0);
  }, [realNodes]);

  // ── BV summaries ───────────────────────────────────────────────
  const leftLegBv = useMemo(() => {
    const o = (q.data ?? null) as AnyObj | null;
    if (!o) return null;
    const rawRoot = pick(o, ["root"]);
    if (rawRoot && typeof rawRoot === "object") {
      const r = rawRoot as AnyObj;
      const bv = pick(r, ["bv"]);
      if (bv && typeof bv === "object") {
        const b = bv as AnyObj;
        const n = toNum(pick(b, ["leftLeg", "left_leg", "leftLegBv", "left_bv"]));
        if (n != null) return n;
      }
    }
    return toNum(pick(o, ["left_leg_bv", "leftLegBv", "left_bv"])) ?? toNum(pick(o, ["summaryLeftBv", "leftSummaryBv"]));
  }, [q.data]);

  const rightLegBv = useMemo(() => {
    const o = (q.data ?? null) as AnyObj | null;
    if (!o) return null;
    const rawRoot = pick(o, ["root"]);
    if (rawRoot && typeof rawRoot === "object") {
      const r = rawRoot as AnyObj;
      const bv = pick(r, ["bv"]);
      if (bv && typeof bv === "object") {
        const b = bv as AnyObj;
        const n = toNum(pick(b, ["rightLeg", "right_leg", "rightLegBv", "right_bv"]));
        if (n != null) return n;
      }
    }
    return toNum(pick(o, ["right_leg_bv", "rightLegBv", "right_bv"])) ?? toNum(pick(o, ["summaryRightBv", "rightSummaryBv"]));
  }, [q.data]);

  // ── Sponsor lookup for register slots ─────────────────────────
  const placeholderSponsorMap = useMemo(() => {
    const result = new Map<string, { sponsor: TreeNode; leg: Leg }>();
    if (!rootNode) return result;

    // Walk tree and for each real node, find its corresponding placeholder in layoutNodes
    function walk(n: TreeNode) {
      const layoutNode = layoutNodes.find((ln) => ln.id === n.id);
      if (layoutNode) {
        // Find children placeholders
        const children = layoutNodes.filter((ln) => ln.parentX === layoutNode.x && ln.parentY === layoutNode.y);
        for (const child of children) {
          if (child.isPlaceholder && child.leg) {
            result.set(child.id, { sponsor: n, leg: child.leg });
          }
        }
      }
      if (n.left) walk(n.left);
      if (n.right) walk(n.right);
    }
    walk(rootNode);
    return result;
  }, [rootNode, layoutNodes]);

  const handleSlotClick = useCallback(
    (sponsor: TreeNode, leg: Leg) => setRegisterCtx({ sponsor, leg }),
    [],
  );

  const handleLoad = () => {
    const v = input.trim();
    setMemberId(v);
    if (!v) return;
    void q.refetch();
  };

  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  // ── Pan handlers ───────────────────────────────────────────────
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target instanceof HTMLButtonElement || (e.target as HTMLElement).closest("button")) return;
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    e.preventDefault();
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    setPan({ x: dragStart.current.panX + e.clientX - dragStart.current.x, y: dragStart.current.panY + e.clientY - dragStart.current.y });
  };

  const handleMouseUp = () => setDragging(false);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    setZoom((z) => Math.max(0.1, Math.min(3, Number((z + delta).toFixed(2)))));
  }, []);

  // ── Elbow connectors ───────────────────────────────────────────
  const connectors = useMemo(() => {
    return layoutNodes
      .filter((ln) => ln.parentX !== undefined && ln.parentY !== undefined)
      .map((ln) => ({
        key: ln.id,
        x1: ln.parentX!,
        y1: ln.parentY! + NODE_H,
        x2: ln.x,
        y2: ln.y,
      }));
  }, [layoutNodes]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-card dark:border-white/10 dark:bg-slate-950">
        <div className="px-6 py-5">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => window.history.back()} className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10" aria-label="Back">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex-1 text-center">
              <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Network</p>
              <h1 className="text-sm font-semibold text-slate-900 dark:text-white">Binary Tree</h1>
            </div>
            <div className="w-9" />
          </div>

          <div className="mt-4 flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleLoad(); }} placeholder="Search by name or ID..." className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 shadow-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 dark:border-white/10 dark:bg-slate-950 dark:text-white" />
            </div>
            <button type="button" onClick={handleLoad} className="rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm">Load tree</button>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-300">
            <div className="flex flex-wrap items-center gap-4">
              {layoutNodes.length > 0 && (
                <span className="font-semibold text-slate-600 dark:text-slate-200">{realNodes.length} member{realNodes.length === 1 ? "" : "s"}</span>
              )}
              <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-amber-400" /> Pending</span>
              <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Active</span>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setZoom((z) => Math.max(0.1, Number((z - 0.1).toFixed(2))))} className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10" aria-label="Zoom out"><ZoomOut className="h-4 w-4" /></button>
              <span className="min-w-[56px] text-center text-xs font-semibold text-slate-700 dark:text-slate-200">{Math.round(zoom * 100)}%</span>
              <button type="button" onClick={() => setZoom((z) => Math.min(3, Number((z + 0.1).toFixed(2))))} className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10" aria-label="Zoom in"><ZoomIn className="h-4 w-4" /></button>
              <button type="button" onClick={resetView} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10">Reset</button>
            </div>
          </div>
        </div>
      </section>

      {/* Tree canvas */}
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-card dark:border-white/10 dark:bg-slate-950">
        <div
          ref={canvasRef}
          className="relative min-h-[600px] h-[calc(100vh-220px)] max-h-[900px] overflow-auto select-none"
          onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onWheel={handleWheel}
          style={{ cursor: dragging ? "grabbing" : "grab" }}
        >
          {!memberId ? (
            <div className="flex h-full items-center justify-center p-10 text-center">
              <div className="max-w-md">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Binary Tree</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">Search for a member ID to view the network.</p>
              </div>
            </div>
          ) : q.isLoading ? (
            <div className="flex h-full items-center justify-center p-10 text-slate-500 dark:text-slate-300">Loading binary tree…</div>
          ) : q.isError || !rootNode ? (
            <div className="flex h-full items-center justify-center p-10"><p className="text-sm font-semibold text-rose-600">No tree data available.</p></div>
          ) : (
            <div className="relative" style={{ width: treeSize.width || "100%", height: treeSize.height || "100%", minWidth: "100%", minHeight: "100%" }}>
              {/* Zoom+Pan wrapper */}
              <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "0 0", position: "absolute", top: 0, left: 0, width: treeSize.width, height: treeSize.height }}>
                {/* Connector layer */}
                <svg className="absolute inset-0 pointer-events-none overflow-visible" style={{ width: treeSize.width, height: treeSize.height }}>
                  {connectors.map((c) => <ElbowConnector key={c.key} x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2} />)}
                </svg>

                {/* Node layer */}
                {layoutNodes.map((ln) => {
                  const isSlot = ln.isPlaceholder || !(ln.node as TreeNode).memberId;
                  return (
                    <div key={ln.id} className="absolute" style={{ left: ln.x - NODE_W / 2, top: ln.y }}>
                      <MemberNodeCard
                        node={ln.node}
                        isRoot={ln.depth === 0}
                        isPlaceholder={isSlot}
                        leg={ln.leg}
                        onClick={!isSlot ? () => handleNodeClick(ln.node as TreeNode) : undefined}
                        onRegister={isSlot ? (leg) => {
                          const ctx = placeholderSponsorMap.get(ln.id);
                          if (ctx) handleSlotClick(ctx.sponsor, leg);
                        } : undefined}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* BV footer */}
        <div className="flex items-center justify-between gap-4 border-t border-slate-200 bg-white px-6 py-5 dark:border-white/10 dark:bg-slate-950">
          <div className="flex items-end gap-3">
            <ArrowDownCircle className="mb-1 h-9 w-9 shrink-0 text-slate-300 dark:text-slate-600" strokeWidth={1.25} />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.4em] text-slate-400">Left leg BV</p>
              <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{formatInt(leftLegBv)}</p>
            </div>
          </div>
          <div className="flex flex-row-reverse items-end gap-3 text-right">
            <ArrowDownCircle className="mb-1 h-9 w-9 shrink-0 text-slate-300 dark:text-slate-600" strokeWidth={1.25} />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.4em] text-slate-400">Right leg BV</p>
              <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{formatInt(rightLegBv)}</p>
            </div>
          </div>
        </div>
      </section>

      <CreateMemberModal open={registerCtx != null} onClose={() => setRegisterCtx(null)} binaryRegister={binaryRegisterPrefill} />
      <MemberViewModal member={viewMember} open={viewMember !== null} onClose={() => setViewMember(null)} isLoading={viewLoading} />
    </div>
  );
}
