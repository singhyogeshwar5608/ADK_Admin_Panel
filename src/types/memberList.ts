export type MemberAccountStatus = "ACTIVE" | "SUSPENDED" | "PENDING";

/** Row shape from `GET /members` (reconstructed from production bundle). */
export interface MemberListRow {
  id?: string | number;
  memberId?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  address?: string;
  profileImage?: string;
  status?: MemberAccountStatus;
  role?: string;
  leg?: string;
  sponsorId?: string;
  placementPath?: string;
  depth?: number;
  createdAt?: string;
  updatedAt?: string;
  bv?: {
    total?: number;
    leftLeg?: number;
    rightLeg?: number;
    carryForwardLeft?: number;
    carryForwardRight?: number;
  };
  wallet?: {
    balance?: number;
    totalEarned?: number;
  };
  stats?: {
    leftTeam?: number;
    rightTeam?: number;
    leftBv?: number;
    rightBv?: number;
    leftChild?: string | null;
    rightChild?: string | null;
    teamSize?: number;
    totalTeamBV?: number;
    directRefs?: number;
    lastLoginAt?: string;
  };
  kyc?: {
    status?: string;
  };
}

export interface MembersListResponse {
  data: MemberListRow[];
  meta?: {
    total?: number;
  };
}

/** Map snake_case API rows to the shape the UI expects. */
export function normalizeMemberRow(raw: Record<string, unknown>): MemberListRow {
  const stats = raw.stats as MemberListRow["stats"];
  const bv = raw.bv as MemberListRow["bv"];
  const wallet = raw.wallet as MemberListRow["wallet"];
  const kyc = raw.kyc as MemberListRow["kyc"];
  return {
    id: raw.id as string | number | undefined,
    memberId: (raw.memberId ?? raw.member_id) as string | undefined,
    fullName: (raw.fullName ?? raw.full_name ?? raw.name) as string | undefined,
    email: raw.email as string | undefined,
    phone: (raw.phone ?? raw.contactPhone ?? raw.contact_phone) as string | undefined,
    address: (raw.address ?? raw.location) as string | undefined,
    profileImage: (raw.profileImage ?? raw.profile_image) as string | undefined,
    status: raw.status as MemberListRow["status"],
    role: raw.role as string | undefined,
    leg: raw.leg as string | undefined,
    sponsorId: (raw.sponsorId ?? raw.sponsor_id) as string | undefined,
    placementPath: (raw.placementPath ?? raw.placement_path) as string | undefined,
    depth: (() => {
      const d = raw.depth;
      if (d == null) return undefined;
      const n = Number(d);
      return Number.isFinite(n) ? n : undefined;
    })(),
    createdAt: (raw.createdAt ?? raw.created_at) as string | undefined,
    updatedAt: (raw.updatedAt ?? raw.updated_at) as string | undefined,
    bv,
    wallet,
    stats,
    kyc,
  };
}

export function parseMembersListResponse(payload: unknown): { rows: MemberListRow[]; total: number } {
  if (payload && typeof payload === "object" && "data" in payload) {
    const raw = (payload as { data: unknown }).data;
    if (Array.isArray(raw)) {
      const meta = (payload as { meta?: { total?: number } }).meta;
      const rows = raw.map((r) =>
        r && typeof r === "object" ? normalizeMemberRow(r as Record<string, unknown>) : ({} as MemberListRow),
      );
      return { rows, total: meta?.total ?? rows.length };
    }
  }
  if (Array.isArray(payload)) {
    const rows = payload.map((r) =>
      r && typeof r === "object" ? normalizeMemberRow(r as Record<string, unknown>) : ({} as MemberListRow),
    );
    return { rows, total: rows.length };
  }
  return { rows: [], total: 0 };
}
