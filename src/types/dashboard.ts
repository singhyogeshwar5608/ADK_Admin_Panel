export interface DashboardTotals {
  totalMembers: number;
  activeMembers: number;
  totalOrders: number;
  todaysOrders: number;
  totalSales: number;
  totalBv: number;
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
