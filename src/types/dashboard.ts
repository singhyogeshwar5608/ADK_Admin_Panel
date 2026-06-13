export interface DashboardTotals {
  totalMembers: number;
  activeMembers: number;
  inactiveMembers: number;
  pendingMembers: number;
  totalOrders: number;
  todaysOrders: number;
  totalSales: number;
  totalBv: number;
  selfPurchaseIncome: number;
  sponsorIncome: number;
  matchingIncome: number;
  selfRepurchase: number;
  repurchaseMatching: number;
  repurchaseAwards: number;
  tourRewards: number;
  royalty: number;
  totalIncome: number;
}

export interface TopMember {
  memberId: string;
  fullName: string;
  email?: string;
  bv?: {
    total?: number;
    leftLeg?: number;
    rightLeg?: number;
  };
  stats?: {
    teamSize?: number;
  };
}

export interface DashboardReport {
  totals: DashboardTotals;
  topMembers: TopMember[];
}

export type SettingsMap = Record<
  string,
  { value?: unknown; updated_at?: string; updatedAt?: string }
>;
