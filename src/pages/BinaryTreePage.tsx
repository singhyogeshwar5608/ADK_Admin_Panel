import { membersApi } from "@/api/members";
import { CreateMemberModal, type Leg } from "@/components/members/CreateMemberModal";
import { MemberViewModal } from "@/components/members/MemberViewModal";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownCircle, ArrowLeft, Minus, Plus, Search, UserPlus, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { normalizeList } from "@/utils/normalizeList";
import { normalizeMemberRow, type MemberListRow } from "@/types/memberList";
import { toast } from "sonner";
import { parseApiError } from "@/utils/parseApiError";

type AnyObj = Record<string, unknown>;

type TreeNode = {
  id: string;
  memberId: string;
  name: string;
  role?: string;
  profileUrl?: string | null;
  isActive?: boolean | null;
  /** Laravel `binaryTreePurchaseState`: paid vs pending (yellow/green in UI legend). */
  binaryPurchasePaid?: boolean | null;
  totalBv?: number | null;
  leftBv?: number | null;
  rightBv?: number | null;
  left?: TreeNode | null;
  right?: TreeNode | null;
};

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
  for (const k of keys) {
    if (k in o) return o[k];
  }
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
      "left" in o ||
      "right" in o ||
      "leftChild" in o ||
      "rightChild" in o ||
      "left_child" in o ||
      "right_child" in o ||
      "left_member" in o ||
      "right_member" in o ||
      "children" in o ||
      "nodes" in o ||
      "legs" in o
    ) {
      return true;
    }
    for (const v of Object.values(o)) if (v && typeof v === "object") stack.push(v);
  }
  return false;
}

function findLikelyTreeRoot(raw: unknown): unknown {
  // Heuristic DFS: find an object that looks like a member node
  // (has left/right or children, or member fields).
  const seen = new Set<unknown>();
  const stack: unknown[] = [raw];
  while (stack.length) {
    const cur = stack.pop();
    if (!cur || typeof cur !== "object") continue;
    if (seen.has(cur)) continue;
    seen.add(cur);

    const o = cur as AnyObj;
    const hasMemberFields =
      "member_id" in o ||
      "memberId" in o ||
      "fullName" in o ||
      "full_name" in o ||
      "name" in o ||
      "username" in o;
    const hasTreeEdges =
      "left" in o ||
      "right" in o ||
      "leftChild" in o ||
      "rightChild" in o ||
      "children" in o ||
      "nodes" in o;
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
  // Many APIs wrap member as `{ member: {...}, left: {...} }` etc.
  const innerMember = pick(o0, ["member", "user", "profile", "data"]);
  const o = (innerMember && typeof innerMember === "object" ? innerMember : o0) as AnyObj;

  const id = pick(o, ["id", "_id", "member_id", "memberId"]);
  const memberId = pick(o, ["memberId", "member_id", "memberID", "member"]);
  const name = pick(o, ["fullName", "full_name", "name", "username", "displayName"]);
  const role = pick(o, ["role", "type"]);
  const profileUrl = pick(o, ["profileImage", "profile_image", "profileUrl", "profile_url", "avatar", "photo"]);
  const isActive = pick(o, ["isActive", "is_active", "active", "status"]);
  const totalBv = pick(o, ["totalBv", "total_bv", "bv", "totalBV"]);
  const leftBv = pick(o, ["leftBv", "left_bv", "leftBV"]);
  const rightBv = pick(o, ["rightBv", "right_bv", "rightBV"]);

  // Children can be left/right objects, or an array with `side`/`position`.
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
    typeof isActive === "boolean"
      ? isActive
      : typeof isActive === "string"
        ? ["active", "1", "true", "yes"].includes(isActive.toLowerCase())
        : null;

  const btp = pick(o, ["binaryTreePurchaseState", "binary_tree_purchase_state"]);
  const binaryPurchasePaid =
    btp === "paid" ? true : btp === "pending_payment" ? false : null;

  return {
    id: toStr(id || memberId || name || "0") || "0",
    memberId: toStr(memberId || id) || "—",
    name: toStr(name) || "Member",
    role: toStr(role) || undefined,
    profileUrl: typeof profileUrl === "string" ? profileUrl : null,
    isActive: status,
    binaryPurchasePaid,
    totalBv: toNum(totalBv),
    leftBv: toNum(leftBv),
    rightBv: toNum(rightBv),
    left,
    right,
  };
}

/** Laravel `MemberResource` embeds BV in `bv.total` / `bv.leftLeg` / `bv.rightLeg`. */
function parseFlatMemberNode(raw: unknown): TreeNode | null {
  if (!raw || typeof raw !== "object") return null;
  let o = raw as AnyObj;
  const inner = pick(o, ["member", "user", "data"]);
  if (inner && typeof inner === "object") o = inner as AnyObj;

  const id = pick(o, ["id", "_id"]);
  const memberId = pick(o, ["memberId", "member_id", "memberID"]);
  const name = pick(o, ["fullName", "full_name", "name", "username"]);
  const role = pick(o, ["role", "type"]);
  const profileUrl = pick(o, ["profileImage", "profile_image", "profileUrl", "profile_url"]);
  const st = pick(o, ["status", "member_status", "memberStatus"]);
  const isActive =
    typeof st === "boolean"
      ? st
      : typeof st === "string"
        ? ["ACTIVE", "active", "1", "enabled"].includes(st)
        : null;

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
  const binaryPurchasePaid =
    btp === "paid" ? true : btp === "pending_payment" ? false : null;

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
    profileUrl: typeof profileUrl === "string" ? profileUrl : null,
    isActive,
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

/** Backend returns flat `{ root, nodes[] }` with `placementPath` (`root`, `root.L`, …); build nested left/right tree. */
function buildTreeFromFlatPlacementPayload(payload: unknown): TreeNode | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as AnyObj;
  const rawRoot = p.root;
  if (!rawRoot || typeof rawRoot !== "object") return null;

  const rootInner = rawRoot as AnyObj;
  const ppRoot = placementPathOfMember(rootInner);
  const rows = [rootInner, ...laravelBinaryNodes(p)].filter(Boolean);
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

  /** Guard: if `.L`/`.R` produced nothing but extra nodes exist, map may use different nesting (fallback to parseNode heuristic). */
  if (tree && !tree.left && !tree.right && byPath.size > 1 && rows.length > 1) {
    return null;
  }

  return tree;
}

/** Deepest assigned member depth (0 = root). `TreeLevel` expands while `depth < maxDepth`. */
function maxMemberDepth(node: TreeNode, depth = 0): number {
  let max = depth;
  if (node.left) max = Math.max(max, maxMemberDepth(node.left, depth + 1));
  if (node.right) max = Math.max(max, maxMemberDepth(node.right, depth + 1));
  return max;
}

/** Ask API for enough levels so the whole subtree fits (admins: backend allows up to 200). */
const BINARY_TREE_FETCH_DEPTH = 200;

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

/** SVG “T”: stem from parent → fork → drops to sibling column centers (~25% / ~75%). */
function BinaryBranchFork() {
  return (
    <svg
      viewBox="0 -6 100 54"
      preserveAspectRatio="none"
      aria-hidden
      className="-mb-[2px] mx-auto block h-[32px] min-h-[28px] w-full min-w-[100px] text-[#bdc5dc] dark:text-slate-500 sm:h-[40px] sm:min-h-[36px] sm:min-w-[120px]"
    >
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        d="M 50,-4 L 50,18 L 25,18 L 25,52 M 50,18 L 75,18 L 75,52"
      />
    </svg>
  );
}

function branchRowMinWidth(depth: number): number {
  if (depth === 0) return 380;
  if (depth === 1) return 280;
  if (depth === 2) return 200;
  return 160;
}

function roleKind(node: TreeNode): "ADMIN" | "MEMBER" {
  const rid = `${node.memberId} ${node.role ?? ""}`.toUpperCase();
  if (rid.includes("ADMIN")) return "ADMIN";
  return "MEMBER";
}

function TreePortraitCard({
  node,
  depth,
  compact,
  onClick,
}: {
  node: TreeNode;
  depth: number;
  compact: boolean;
  onClick?: (node: TreeNode) => void;
}) {
  const isRoot = depth === 0;
  const rk = roleKind(node);
  const paid = node.binaryPurchasePaid === true;
  const pendingPay = node.binaryPurchasePaid === false;

  let borderRing =
    "border border-slate-200 dark:border-white/10 shadow-[0_1px_3px_rgba(15,23,42,.08)] transition-all hover:border-primary/50 hover:shadow-md cursor-pointer";
  if (isRoot)
    borderRing =
      "border-2 border-amber-400 ring-2 ring-amber-200/70 dark:border-amber-400 dark:ring-amber-900/40 sm:border-[3px] sm:ring-4 transition-all hover:border-amber-500 hover:ring-amber-300 cursor-pointer";
  else if (depth === 1 && pendingPay)
    borderRing =
      "border-2 border-amber-400 shadow-[0_2px_6px_rgba(245,158,11,.18)] dark:border-amber-500 sm:border-[3px] sm:shadow-[0_2px_8px_rgba(245,158,11,.2)] transition-all hover:border-amber-500 cursor-pointer";
  else if (depth === 1 && paid)
    borderRing =
      "border-2 border-teal-500 shadow-[0_2px_6px_rgba(20,184,166,.18)] dark:border-teal-400 sm:border-[3px] sm:shadow-[0_2px_8px_rgba(20,184,166,.22)] transition-all hover:border-teal-600 cursor-pointer";

  const avClass = compact
    ? "h-10 w-10 sm:h-12 sm:w-12"
    : isRoot
      ? "h-14 w-14 sm:h-[60px] sm:w-[60px]"
      : "h-[52px] w-[52px] sm:h-[54px] sm:w-[54px]";
  const initText = compact ? "text-[9px] sm:text-[10px]" : isRoot ? "text-[14px] sm:text-[17px]" : "text-[13px] sm:text-[15px]";
  const cardW = compact
    ? "min-w-[76px] max-w-[92px] sm:min-w-[88px] sm:max-w-[108px]"
    : isRoot
      ? "w-[128px] sm:w-[148px] md:w-[156px]"
      : "w-[120px] sm:w-[138px] md:w-[148px]";
  const py = compact ? "py-1.5 px-1.5 sm:py-2 sm:px-2" : isRoot ? "py-3 px-3 sm:py-4 sm:px-4" : "py-2.5 px-2.5 sm:py-3.5 sm:px-3.5";

  const avatar = node.profileUrl ? (
    <img src={node.profileUrl} alt="" className={`${avClass} rounded-full object-cover`} />
  ) : (
    <div
      className={`flex items-center justify-center rounded-full font-bold text-slate-500 dark:text-slate-300 ${avClass} ${initText} bg-slate-100 dark:bg-white/10`}
    >
      {initials(node.name)}
    </div>
  );

  if (compact) {
    return (
      <div
        onClick={() => onClick?.(node)}
        className={[
          "flex flex-col items-center rounded-2xl bg-white text-center dark:bg-slate-950",
          borderRing,
          cardW,
          py,
        ].join(" ")}
      >
        {avatar}
        <p className="mt-1.5 w-full truncate text-[10px] font-semibold leading-tight text-slate-900 dark:text-white sm:mt-2 sm:text-[11px]">
          {node.name}
        </p>
        <p className="mt-0.5 w-full truncate text-[8px] text-slate-400 sm:text-[9px]">{node.memberId}</p>
      </div>
    );
  }

  let statusRow: ReactNode = null;
  if (node.binaryPurchasePaid !== undefined && node.binaryPurchasePaid !== null) {
    statusRow = (
      <span
        className={[
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wide sm:px-2.5 sm:py-1 sm:text-[10px]",
          paid
            ? "bg-emerald-50 text-teal-700 dark:bg-teal-300/15 dark:text-emerald-200"
            : "bg-amber-50 text-amber-800 dark:bg-amber-400/18 dark:text-amber-100",
        ].join(" ")}
      >
        <span className={["inline-block h-2 w-2 rounded-full", paid ? "bg-emerald-500" : "bg-amber-400"].join(" ")} />
        ACTIVE
      </span>
    );
  } else {
    const active = node.isActive ?? null;
    if (active !== null)
      statusRow = (
        <span
          className={[
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold sm:px-2.5 sm:py-1 sm:text-[10px]",
            active ? "bg-emerald-50 text-teal-700 dark:bg-teal-300/15 dark:text-emerald-200" : "bg-slate-100 text-slate-600 dark:bg-white/10",
          ].join(" ")}
        >
          <span className={active ? "h-2 w-2 rounded-full bg-emerald-500" : "h-2 w-2 rounded-full bg-slate-400"} /> ACTIVE
        </span>
      );
  }

  const roleBadge =
    rk === "ADMIN" ? (
      <span className="rounded-full bg-amber-400/90 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.18em] text-slate-900 sm:px-3 sm:text-[10px] sm:tracking-[0.2em]">
        Admin
      </span>
    ) : (
      <span
        className={[
          "rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.14em] sm:px-3 sm:text-[10px] sm:tracking-[0.22em]",
          pendingPay ? "bg-amber-100 text-amber-900 dark:bg-amber-400/25 dark:text-amber-50" : "bg-teal-50 text-teal-800 dark:bg-teal-400/15 dark:text-teal-50",
        ].join(" ")}
      >
        Member
      </span>
    );

  return (
    <div
      onClick={() => onClick?.(node)}
      className={[
        "relative flex flex-col items-center rounded-2xl bg-white dark:bg-slate-950 sm:rounded-[22px]",
        borderRing,
        cardW,
        py,
      ].join(" ")}
    >
      {isRoot && (
        <span className="mb-1.5 rounded-full bg-amber-400 px-3 py-0.5 text-[9px] font-black uppercase tracking-[0.28em] text-slate-900 sm:mb-3 sm:px-4 sm:py-1 sm:text-[10px] sm:tracking-[0.35em]">
          Root
        </span>
      )}
      {depth === 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            // Optional: existing logic if any
          }}
          className="absolute -right-0.5 -top-0.5 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white shadow sm:h-7 sm:w-7 dark:border-white/10 dark:bg-slate-900"
          aria-label="Expand subtree"
        >
          <Plus className="h-3.5 w-3.5 text-slate-600 sm:h-4 sm:w-4" />
        </button>
      )}

      <div className="flex justify-center">{avatar}</div>

      <p className="mt-2 truncate text-center text-[12px] font-bold leading-tight text-slate-900 dark:text-white sm:mt-3 sm:text-[14px] md:text-[15px]">
        {node.name}
      </p>
      <p className="mt-1 truncate text-center text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400 sm:mt-1.5 sm:text-[11px] md:text-[12px]">
        {node.memberId}
      </p>

      <div className="mt-2 sm:mt-2.5">{roleBadge}</div>

      {depth === 0 ? (
        <p className="mt-3 text-sm font-semibold tracking-tight text-blue-700 dark:text-sky-300 sm:mt-4 sm:text-base md:text-lg">
          Total BV: {formatInt(node.totalBv)}
        </p>
      ) : (
        <div className="mt-2 w-full space-y-0.5 text-center sm:mt-3 sm:space-y-1">
          <p className="text-sm font-semibold tracking-tight text-blue-700 dark:text-sky-300 sm:text-base">{formatInt(node.totalBv)}</p>
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400 sm:text-[11px]">
            L:{formatInt(node.leftBv)}{" "}
            <span className="text-slate-300 dark:text-slate-600">|</span> R:{formatInt(node.rightBv)}
          </p>
        </div>
      )}

      {depth >= 1 && statusRow && (
        <div className={depth === 1 ? "mt-2 flex justify-center sm:mt-3.5" : "mt-2 flex justify-center sm:mt-3"}>{statusRow}</div>
      )}
    </div>
  );
}

function RegisterSlotCard({
  compact,
  onClick,
}: {
  compact: boolean;
  onClick?: () => void;
}) {
  const sizing = compact
    ? "min-h-[88px] min-w-[76px] max-w-[92px] py-3 sm:min-h-[104px] sm:min-w-[88px] sm:max-w-[108px] sm:py-4"
    : "min-h-[168px] w-[120px] py-7 sm:min-h-[196px] sm:w-[138px] sm:py-8 md:w-[148px]";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Register new member in this tree slot"
      className={[
        "flex flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-blue-400/70 bg-blue-50/40 text-blue-700 transition hover:bg-blue-50 dark:border-sky-500/50 dark:bg-sky-500/10 dark:text-sky-200 sm:gap-2 sm:rounded-[22px]",
        sizing,
      ].join(" ")}
    >
      <UserPlus className={compact ? "h-6 w-6 sm:h-7 sm:w-7" : "h-8 w-8 sm:h-10 sm:w-10"} strokeWidth={1.6} />
      <span className="text-[9px] font-bold uppercase tracking-[0.2em] sm:text-[11px] sm:tracking-[0.25em]">Register</span>
    </button>
  );
}

function TreeLevel({
  node,
  depth,
  maxDepth,
  onRegisterUnder,
  onNodeClick,
}: {
  node: TreeNode;
  depth: number;
  maxDepth: number;
  onRegisterUnder?: (parent: TreeNode, leg: Leg) => void;
  onNodeClick?: (node: TreeNode) => void;
}) {
  const showChildren = depth < maxDepth;
  const compact = depth >= 2;

  return (
    <div className="flex flex-col items-center">
      <TreePortraitCard node={node} depth={depth} compact={compact} onClick={onNodeClick} />

      {showChildren && (
        <div className="mt-2 flex w-full flex-col items-stretch sm:mt-3 md:mt-4" style={{ minWidth: branchRowMinWidth(depth) }}>
          <BinaryBranchFork />
          <div className="-mt-[2px] flex w-full flex-1 items-start">
            <div className="flex flex-1 flex-col items-center px-1 sm:px-2">
              {node.left ? (
                <TreeLevel
                  node={node.left}
                  depth={depth + 1}
                  maxDepth={maxDepth}
                  onRegisterUnder={onRegisterUnder}
                  onNodeClick={onNodeClick}
                />
              ) : (
                <RegisterSlotCard
                  compact={depth + 1 >= 2}
                  onClick={() => onRegisterUnder?.(node, "LEFT")}
                />
              )}
            </div>
            <div className="flex flex-1 flex-col items-center px-1 sm:px-2">
              {node.right ? (
                <TreeLevel
                  node={node.right}
                  depth={depth + 1}
                  maxDepth={maxDepth}
                  onRegisterUnder={onRegisterUnder}
                  onNodeClick={onNodeClick}
                />
              ) : (
                <RegisterSlotCard
                  compact={depth + 1 >= 2}
                  onClick={() => onRegisterUnder?.(node, "RIGHT")}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type RegisterSlotContext = { sponsor: TreeNode; leg: Leg };

export function BinaryTreePage() {
  /** Backend `GET /members/{member}/tree` resolves `root` to the member with no sponsor (structural root). All placements share this path prefix, unlike a random member code (e.g. ADMIN001) which only shows that node's subtree. */
  const DEFAULT_TREE_ROOT = "root";
  const [input, setInput] = useState("");
  const [memberId, setMemberId] = useState("");
  const [zoom, setZoom] = useState(1);
  const [registerCtx, setRegisterCtx] = useState<RegisterSlotContext | null>(null);
  const [viewMember, setViewMember] = useState<MemberListRow | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  const handleNodeClick = async (node: TreeNode) => {
    // If node ID is numeric, use it; otherwise fallback to memberId
    const target = node.id && !isNaN(Number(node.id)) ? node.id : node.memberId;
    if (!target) return;

    setViewMember(null);
    setViewLoading(true);
    try {
      const res = await membersApi.get(target);
      const payload = res.data as any;
      
      // The API returns { member: { ... } } or { data: { ... } } or just { ... }
      let raw = payload;
      if (raw && typeof raw === 'object') {
        if ('member' in raw) raw = (raw as any).member;
        if (raw && typeof raw === 'object' && 'data' in raw) raw = (raw as any).data;
      }
      
      const member = normalizeMemberRow(raw as Record<string, unknown>);
      setViewMember(member);
    } catch (e) {
      toast.error("Failed to load member details: " + parseApiError(e));
    } finally {
      setViewLoading(false);
    }
  };

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
      // 1) Try requested id as-is
      const first = (await membersApi.tree(memberId, BINARY_TREE_FETCH_DEPTH)).data;
      // If response already has edges, use it.
      if (looksLikeHasEdges(first)) return first;

      // 1b) Try resolving via `/members/:id` which may accept member code.
      try {
        const me = (await membersApi.get(memberId)).data as AnyObj;
        const resolvedId = pick(me, ["id", "_id"]);
        if (resolvedId != null && String(resolvedId).trim()) {
          const second = (await membersApi.tree(resolvedId as string | number, BINARY_TREE_FETCH_DEPTH)).data;
          if (looksLikeHasEdges(second)) return second;
        }
      } catch {
        // ignore
      }

      // 2) Some backends expect numeric `id` not `member_id` code. Resolve via /members list.
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
      } catch {
        // ignore and fall back to first
      }
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
    return (
      toNum(pick(o, ["left_leg_bv", "leftLegBv", "left_bv"])) ??
      toNum(pick(o, ["summaryLeftBv", "leftSummaryBv"]))
    );
  }, [q.data]);

  const treeDisplayMaxDepth = useMemo(() => {
    if (!rootNode) return 1;
    return maxMemberDepth(rootNode) + 1;
  }, [rootNode]);

  const treeMeta = useMemo(() => {
    const o = (q.data ?? null) as AnyObj | null;
    if (!o || typeof o !== "object") return null;
    const m = o.meta;
    return m && typeof m === "object" ? (m as AnyObj) : null;
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
    return (
      toNum(pick(o, ["right_leg_bv", "rightLegBv", "right_bv"])) ??
      toNum(pick(o, ["summaryRightBv", "rightSummaryBv"]))
    );
  }, [q.data]);

  const handleLoad = () => {
    const v = input.trim();
    setMemberId(v);
    if (!v) return;
    void q.refetch();
  };

  const resetView = () => {
    setZoom(1);
    const el = canvasRef.current;
    if (el) el.scrollTo({ left: el.scrollWidth / 2 - el.clientWidth / 2, top: 0, behavior: "smooth" });
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-card dark:border-white/10 dark:bg-slate-950">
        <div className="px-6 py-5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
              aria-label="Back"
            >
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
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleLoad();
                }}
                placeholder="Search by name or ID..."
                className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 shadow-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 dark:border-white/10 dark:bg-slate-950 dark:text-white"
              />
            </div>
            <button
              type="button"
              onClick={handleLoad}
              className="rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm"
            >
              Load tree
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-300">
            <div className="flex flex-wrap items-center gap-4">
              {treeMeta && typeof treeMeta.count === "number" ? (
                <span className="font-semibold text-slate-600 dark:text-slate-200">
                  {treeMeta.count} member{treeMeta.count === 1 ? "" : "s"} in this view
                </span>
              ) : null}
              {treeMeta?.truncated === true ? (
                <span className="font-medium text-amber-700 dark:text-amber-400">
                  List was truncated at the server limit ({String(treeMeta.nodeLimit ?? "—")}). Narrow the root or raise limits.
                </span>
              ) : null}
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-400" />
                Yellow: new / to paid order
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Green: paid after purchase
              </span>
            </div>
            <div className="hidden items-center gap-2 md:flex">
              <span className="text-[10px] font-semibold uppercase tracking-[0.35em] text-slate-400">
                Tap a member to view details
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.6, Number((z - 0.1).toFixed(2))))}
                className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
                aria-label="Zoom out"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <span className="min-w-[56px] text-center text-xs font-semibold text-slate-700 dark:text-slate-200">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(1.4, Number((z + 0.1).toFixed(2))))}
                className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
                aria-label="Zoom in"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={resetView}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
              >
                <Minus className="h-3.5 w-3.5 opacity-0" />
                Reset
                <Plus className="h-3.5 w-3.5 opacity-0" />
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-card dark:border-white/10 dark:bg-slate-950">
        <div ref={canvasRef} className="relative min-h-[600px] h-[calc(100vh-220px)] max-h-[900px] overflow-auto">
          {!memberId ? (
            <div className="flex h-full items-center justify-center p-10 text-center">
              <div className="max-w-md">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Binary Tree</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
                  Please search for a member ID to view the network.
                </p>
              </div>
            </div>
          ) : q.isLoading ? (
            <div className="flex h-full items-center justify-center p-10 text-center text-slate-500 dark:text-slate-300">
              Loading binary tree…
            </div>
          ) : q.isError || !rootNode ? (
            <div className="flex h-full items-center justify-center p-10 text-center">
              <p className="text-sm font-semibold text-rose-600">No tree data available for this account.</p>
            </div>
          ) : (
            <div
              className="min-w-[680px] px-6 pb-10 pt-8 sm:min-w-[840px] sm:px-10 sm:pb-12 sm:pt-10 md:min-w-[960px] md:px-12 md:pb-14 md:pt-11 lg:min-w-[1040px] lg:px-14 lg:pb-16 lg:pt-12"
              style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }}
            >
              <TreeLevel
                node={rootNode}
                depth={0}
                maxDepth={treeDisplayMaxDepth}
                onRegisterUnder={(parent, leg) => setRegisterCtx({ sponsor: parent, leg })}
                onNodeClick={handleNodeClick}
              />
            </div>
          )}
        </div>

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

      <CreateMemberModal
        open={registerCtx != null}
        onClose={() => setRegisterCtx(null)}
        binaryRegister={binaryRegisterPrefill}
      />
      <MemberViewModal
        member={viewMember}
        open={viewMember !== null}
        onClose={() => setViewMember(null)}
        isLoading={viewLoading}
      />
    </div>
  );
}
