/**
 * Binary Tree Layout — Subtree-width positioning.
 *
 *  - Every node and empty slot has the same fixed dimensions.
 *  - Empty slots are created wherever a real child is missing AND depth < maxDepth.
 *  - Slots participate in width/position calculations exactly like real nodes.
 *  - They never expand further (leaf-only).
 *
 *  Algorithm (two-pass):
 *    1. Build layout tree with slots
 *    2. Bottom-up: compute subtreeWidth for every node/slot
 *    3. Top-down: assign (x, y) positions
 */

export interface LayoutNode {
  id: string;
  x: number;         // centre-x
  y: number;         // top-y
  depth: number;
  parentX?: number;
  parentY?: number;
  isPlaceholder?: boolean;
  leg?: "LEFT" | "RIGHT";
  node: TreeNodeData;
}

export interface TreeNodeData {
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
  left?: TreeNodeData | null;
  right?: TreeNodeData | null;
}

export interface LayoutOptions {
  nodeWidth: number;
  nodeHeight: number;
  horizontalGap: number;
  verticalGap: number;
  padding: number;
}

export const DEFAULT_OPTIONS: LayoutOptions = {
  nodeWidth: 144,
  nodeHeight: 106,
  horizontalGap: 48,
  verticalGap: 64,
  padding: 48,
};

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

interface Slot {
  kind: "real" | "placeholder";
  id: string;
  node: TreeNodeData | null;
  depth: number;
  subtreeWidth: number;
  x: number;
  y: number;
  leg?: "LEFT" | "RIGHT";
  left: Slot | null;
  right: Slot | null;
}

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------

export function computeBinaryTreeLayout(
  root: TreeNodeData,
  maxDepth: number,
  opts: Partial<LayoutOptions> = {},
): LayoutNode[] {
  const o = { ...DEFAULT_OPTIONS, ...opts };
  const { nodeWidth, nodeHeight, horizontalGap, verticalGap, padding } = o;

  // ── 1. Build tree with slots ───────────────────────────────────
  // Slots are created where a real child is null AND depth < maxDepth.
  // Slots are leaf-only (never expand further).

  function build(n: TreeNodeData | null, depth: number, leg?: "LEFT" | "RIGHT"): Slot | null {
    if (depth > maxDepth) return null;

    if (!n) {
      // Empty slot — only if below maxDepth (so the last visible level has no slots)
      if (depth >= maxDepth) return null;
      return {
        kind: "placeholder",
        id: `slot-${depth}-${leg ?? "?"}-${Math.random().toString(36).slice(2, 8)}`,
        node: null, depth, subtreeWidth: nodeWidth, x: 0, y: 0, leg,
        left: null, right: null,
      };
    }

    const expand = depth < maxDepth;

    return {
      kind: "real",
      id: n.id,
      node: n,
      depth,
      subtreeWidth: nodeWidth,
      x: 0,
      y: 0,
      leg,
      left: expand
        ? (n.left ? build(n.left, depth + 1, "LEFT") : build(null, depth + 1, "LEFT"))
        : null,
      right: expand
        ? (n.right ? build(n.right, depth + 1, "RIGHT") : build(null, depth + 1, "RIGHT"))
        : null,
    };
  }

  const rootSlot = build(root, 0);
  if (!rootSlot) return [];

  // ── 2. Bottom-up: compute subtreeWidth ────────────────────────
  function computeWidth(s: Slot): number {
    if (!s.left && !s.right) {
      s.subtreeWidth = nodeWidth;
      return nodeWidth;
    }

    const lw = s.left ? computeWidth(s.left) : 0;
    const rw = s.right ? computeWidth(s.right) : 0;

    if (s.left && s.right) {
      s.subtreeWidth = Math.max(nodeWidth, lw + horizontalGap + rw);
    } else if (s.left) {
      s.subtreeWidth = Math.max(nodeWidth, lw);
    } else if (s.right) {
      s.subtreeWidth = Math.max(nodeWidth, rw);
    } else {
      s.subtreeWidth = nodeWidth;
    }

    return s.subtreeWidth;
  }

  computeWidth(rootSlot);

  // ── 3. Top-down: assign positions ─────────────────────────────
  rootSlot.x = 0;
  rootSlot.y = 0;

  function place(s: Slot): void {
    s.y = s.depth * (nodeHeight + verticalGap);

    if (!s.left && !s.right) return;

    const lw = s.left ? s.left.subtreeWidth : 0;
    const rw = s.right ? s.right.subtreeWidth : 0;

    if (s.left && s.right) {
      const span = lw + horizontalGap + rw;
      s.left.x = s.x - span / 2 + lw / 2;
      s.right.x = s.x + span / 2 - rw / 2;
      place(s.left);
      place(s.right);
    } else if (s.left) {
      s.left.x = s.x;
      place(s.left);
    } else if (s.right) {
      s.right.x = s.x;
      place(s.right);
    }
  }

  place(rootSlot);

  // ── 4. Normalise ───────────────────────────────────────────────
  let minX = Infinity;
  function findMin(s: Slot): void {
    minX = Math.min(minX, s.x - s.subtreeWidth / 2);
    if (s.left) findMin(s.left);
    if (s.right) findMin(s.right);
  }
  findMin(rootSlot);
  const shiftX = padding - minX;

  // ── 5. Flatten ─────────────────────────────────────────────────
  const result: LayoutNode[] = [];

  function collect(s: Slot, pX?: number, pY?: number): void {
    const absX = s.x + shiftX;
    const absY = s.y;

    result.push({
      id: s.id,
      x: absX,
      y: absY,
      depth: s.depth,
      parentX: pX,
      parentY: pY,
      isPlaceholder: s.kind === "placeholder",
      leg: s.leg,
      node: s.node ?? { id: s.id, memberId: "", name: "", left: null, right: null },
    });

    if (s.left) collect(s.left, absX, absY);
    if (s.right) collect(s.right, absX, absY);
  }

  collect(rootSlot);
  return result;
}

/** Total canvas width / height from layout. */
export function canvasSize(
  nodes: LayoutNode[],
  opts: Partial<LayoutOptions> = {},
): { width: number; height: number } {
  const o = { ...DEFAULT_OPTIONS, ...opts };
  let w = 0, h = 0;
  for (const n of nodes) {
    w = Math.max(w, n.x + o.nodeWidth + o.padding);
    h = Math.max(h, n.y + o.nodeHeight + o.padding);
  }
  return { width: Math.max(w, o.nodeWidth * 2), height: Math.max(h, o.nodeHeight * 2) };
}

/** Compute depth of the deepest real node (0-indexed). */
export function maxMemberDepth(node: TreeNodeData, depth = 0): number {
  let max = depth;
  if (node.left) max = Math.max(max, maxMemberDepth(node.left, depth + 1));
  if (node.right) max = Math.max(max, maxMemberDepth(node.right, depth + 1));
  return max;
}
