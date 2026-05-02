/** Reconstructed from production bundle (`ot`, `WN`). */
export function parseNumericInput(value: string | number): number {
  const n = Number(String(value).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** First 2:1 match BV at a single node (bundle `WN`). */
export function firstMatchBv(leftBv: number, rightBv: number): number {
  const leftUnits = leftBv / 2;
  const rightUnits = rightBv / 1;
  return Math.min(leftUnits, rightUnits) * 3;
}

export interface SimulationFormState {
  joiningAmount: string;
  businessVolume: string;
  selfIncome: string;
  directIncome: string;
  matchingIncome: string;
  selfRepurchaseIncome: string;
  repurchaseMatchingIncome: string;
  awardIncome: string;
  repurchaseAmount: string;
  repurchaseBv: string;
  weeklyCapping: string;
}

export interface IncomePreviewInputs {
  sim: SimulationFormState;
  demoJoinMembers: string;
  demoRepurchaseCount: string;
  includeRewardOnJoining: boolean;
  leftCarryBv: string;
  rightCarryBv: string;
}

export interface IncomePreviewResult {
  joinN: number;
  repN: number;
  joinBv: number;
  repBv: number;
  totalJoinBv: number;
  totalRepBv: number;
  totalSelfJoin: number;
  totalDirectJoin: number;
  totalRewardJoin: number;
  totalSelfRepurchase: number;
  totalSponsorAwardRepurchase: number;
  grandTotalIncome: number;
  grandWithIllustrativeMatch: number;
  autoLeft: number;
  autoRight: number;
  leftCf: number;
  rightCf: number;
  firstMatchBv: number;
  firstMatchIncomeJoin: number;
  firstMatchIncomeRep: number;
  matchingPct: number;
  repMatchingPct: number;
  weeklyCap: number;
}

export function computeIncomePreview(n: IncomePreviewInputs): IncomePreviewResult {
  const H = Math.max(0, Math.floor(parseNumericInput(n.demoJoinMembers)));
  const ae = Math.max(0, Math.floor(parseNumericInput(n.demoRepurchaseCount)));
  const le = parseNumericInput(n.sim.businessVolume);
  const we = parseNumericInput(n.sim.selfIncome) / 100;
  const _e = parseNumericInput(n.sim.directIncome) / 100;
  const ce = parseNumericInput(n.sim.matchingIncome) / 100;
  const ue = parseNumericInput(n.sim.awardIncome) / 100;
  const I = parseNumericInput(n.sim.selfRepurchaseIncome) / 100;
  const ee = parseNumericInput(n.sim.repurchaseMatchingIncome) / 100;
  const Q = parseNumericInput(n.sim.repurchaseBv);
  const A = parseNumericInput(n.sim.weeklyCapping);
  const q = H * le;
  const se = Math.max(0, H - 1);
  const oe = q * we;
  const he = se * le * _e;
  const ve = n.includeRewardOnJoining ? q * ue : 0;
  const W = ae * Q;
  const X = W * I;
  const Se = ae > 0 ? W * ue : 0;
  const Ie = q > 0 ? q / 2 : 0;
  const bt = q > 0 ? q / 2 : 0;
  const K = n.leftCarryBv.trim() === "" ? Ie : parseNumericInput(n.leftCarryBv);
  const je = n.rightCarryBv.trim() === "" ? bt : parseNumericInput(n.rightCarryBv);
  const Te = K > 0 && je > 0 ? firstMatchBv(K, je) : 0;
  const mt = Te * ce;
  const Ct = Te * ee;
  const Et = oe + he + ve + X + Se;
  const ts = Et + mt;

  return {
    joinN: H,
    repN: ae,
    joinBv: le,
    repBv: Q,
    totalJoinBv: q,
    totalRepBv: W,
    totalSelfJoin: oe,
    totalDirectJoin: he,
    totalRewardJoin: ve,
    totalSelfRepurchase: X,
    totalSponsorAwardRepurchase: Se,
    grandTotalIncome: Et,
    grandWithIllustrativeMatch: ts,
    autoLeft: Ie,
    autoRight: bt,
    leftCf: K,
    rightCf: je,
    firstMatchBv: Te,
    firstMatchIncomeJoin: mt,
    firstMatchIncomeRep: Ct,
    matchingPct: ce,
    repMatchingPct: ee,
    weeklyCap: A,
  };
}
