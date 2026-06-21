/** Parse MLM `/mlm/income/:id` payloads with flexible nesting / casing. */

function num(v: unknown): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const cleaned = v
      .trim()
      .replace(/[,₹\s]/g, "")
      .replace(/(INR|Rs\.?)/gi, "");
    const n2 = Number(cleaned);
    return Number.isFinite(n2) ? n2 : 0;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function firstStr(v: unknown): string | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v !== "string" || !v.trim()) return undefined;
  return v.trim();
}

function mergeDataLayer(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== "object") return {};
  const root = payload as Record<string, unknown>;
  const d = root.data;
  if (d && typeof d === "object" && !Array.isArray(d)) {
    return { ...root, ...(d as Record<string, unknown>) };
  }
  return { ...root };
}

function subsection(
  merged: Record<string, unknown>,
  keys: readonly string[],
): Record<string, unknown> {
  for (const k of keys) {
    const v = merged[k];
    if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  }
  return {};
}

function pick(rec: Record<string, unknown>, camelSnakePairs: readonly [string, string][]): unknown {
  for (const [a, b] of camelSnakePairs) {
    if (rec[a] != null && rec[a] !== "") return rec[a];
    if (rec[b] != null && rec[b] !== "") return rec[b];
  }
  return undefined;
}

function deepPickValue(obj: unknown, keys: readonly string[], maxDepth = 4): unknown {
  if (!obj || typeof obj !== "object" || Array.isArray(obj) || maxDepth < 0) return undefined;
  const rec = obj as Record<string, unknown>;
  for (const k of keys) {
    const v = rec[k];
    if (v != null && v !== "") return v;
  }
  for (const v of Object.values(rec)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const found = deepPickValue(v, keys, maxDepth - 1);
      if (found != null && found !== "") return found;
    }
  }
  return undefined;
}

function deepNum(obj: unknown, keys: readonly string[], fallback = 0): number {
  const v = deepPickValue(obj, keys);
  const n = num(v);
  return n || fallback;
}

function deepFindMaxNumberByKey(obj: unknown, keyIncludes: readonly string[], maxDepth = 6): number {
  if (!obj || typeof obj !== "object" || Array.isArray(obj) || maxDepth < 0) return 0;
  const rec = obj as Record<string, unknown>;
  let best = 0;

  const keysLower = keyIncludes.map((s) => s.toLowerCase());
  for (const [k, v] of Object.entries(rec)) {
    const kl = k.toLowerCase();
    if (keysLower.some((needle) => kl.includes(needle))) {
      const n = num(v);
      if (n > best) best = n;
    }
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const nested = deepFindMaxNumberByKey(v, keyIncludes, maxDepth - 1);
      if (nested > best) best = nested;
    }
  }
  return best;
}

export type MlmIncomeOverviewModel = {
  viewingId: string;
  walletBalance: number;
  totalEarned: number;
  weeklyIncome: number;
  weeklyCapRemaining: number;
  monthIncome: number;
  monthTxCount: number;
  directReferrals: number;
  referralsNeedMore: number;
  selfPurchase: number;
  sponsor: number;
  matching: number;
  matchingCount: number;
  reward: number;
  bvTotal: number;
  bvLeft: number;
  bvLeftCf: number;
  bvRight: number;
  bvRightCf: number;
  bvMatched: number;
  nextRatio: string;
  /** Values used for BV balance visualization (fallback: carry-forward). */
  bvBarLeft: number;
  bvBarRight: number;
  activeMember: boolean;
};

export function formatMlmRupee(n: number): string {
  const s = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
  return `₹${s}`;
}

/**
 * @param incomePayload - `GET /mlm/income/:member` (Laravel: wallet + bv_summary, no income breakdown)
 * @param statsPayload - optional `GET /mlm/income/:member/statistics` (Laravel: total_income + totals)
 */
export function parseMlmIncomeOverview(
  incomePayload: unknown,
  statsPayload: unknown | null | undefined,
  fallbackMemberId: string,
): MlmIncomeOverviewModel {
  const merged = mergeDataLayer(incomePayload);
  const stats = statsPayload ? mergeDataLayer(statsPayload) : {};

  /** Laravel nests BV under `bv_summary` — prefer that first */
  const bv = subsection(merged, [
    "bv_summary",
    "bvSummary",
    "bv",
    "businessVolume",
    "business_volume",
  ]);

  const totalIncomeBucket = subsection(stats, ["total_income", "totalIncome"]);
  const thisMonthBucket = subsection(stats, ["this_month", "thisMonth"]);

  const breakdown = subsection(merged, [
    "incomeBreakdown",
    "income_breakdown",
    "breakdown",
    "incomes",
  ]);

  const wallet = subsection(merged, ["wallet", "walletSummary", "wallet_summary"]);
  const weekly = subsection(merged, ["weekly", "weeklyIncome", "weekly_income"]);
  const monthly = subsection(merged, ["monthly", "month", "thisMonth", "this_month"]);
  const referrals = subsection(merged, ["referrals", "directReferrals", "direct_referrals"]);

  const walletBalance = num(
    pick(merged, [
      ["walletBalance", "wallet_balance"],
      ["balance", "wallet_amount"],
    ]) ??
      pick(wallet, [
        ["balance", "amount"],
        ["walletBalance", "wallet_balance"],
      ]),
  );

  const totalEarned = num(
    pick(merged, [
      ["walletTotalEarned", "wallet_total_earned"],
      ["totalEarned", "total_earned"],
      ["lifetimeEarnings", "lifetime_earnings"],
    ]) ?? pick(wallet, [["totalEarned", "total_earned"]]),
  );

  const weeklyIncome = num(
    pick(merged, [
      ["weeklyIncome", "weekly_income"],
      ["weekIncome", "week_income"],
    ]) ?? pick(weekly, [["amount", "income"], ["weeklyIncome", "weekly_income"]]),
  );

  const weeklyCapRemaining = num(
    pick(merged, [
      ["weeklyCapRemaining", "weekly_cap_remaining"],
      ["capRemaining", "cap_remaining"],
    ]) ?? pick(weekly, [["capRemaining", "cap_remaining"], ["remainingCap", "remaining_cap"]]),
  );

  let monthIncome = num(
    pick(merged, [
      ["monthlyIncome", "monthly_income"],
      ["thisMonthIncome", "this_month_income"],
    ]) ?? pick(monthly, [["income", "amount"], ["monthlyIncome", "monthly_income"]]),
  );

  let monthTxCount = Math.round(
    num(
      pick(merged, [
        ["monthlyTransactions", "monthly_transactions"],
        ["thisMonthTransactions", "this_month_transactions"],
      ]) ?? pick(monthly, [["transactionCount", "transaction_count"], ["transactions", "tx_count"]]),
    ),
  );

  const directReferrals = Math.round(
    num(
      pick(merged, [
        ["directReferralsCount", "direct_referrals_count"],
        ["directReferrals", "direct_referrals"],
        ["directReferralCount", "direct_referral_count"],
      ]) ?? pick(referrals, [["count", "total"], ["directReferrals", "direct_referrals"]]),
    ),
  );

  let targetRefs = Math.round(
    num(
      pick(merged, [
        ["directReferralTarget", "direct_referral_target"],
        ["requiredReferrals", "required_referrals"],
      ]),
    ),
  );
  if (!targetRefs) targetRefs = 25;

  const referralsNeedMore = Math.max(0, targetRefs - directReferrals);

  const breakdownRoot = { ...merged, incomeBreakdown: breakdown, income_breakdown: breakdown };

  let selfPurchase = deepNum(breakdownRoot, [
    "selfPurchaseIncome",
    "self_purchase_income",
    "selfIncome",
    "self_income",
    "self_purchase",
    "selfPurchase",
    "self_purchase_amount",
    "self_purchase_earning",
    "selfPurchaseEarning",
  ]);

  let sponsor = deepNum(breakdownRoot, [
    "sponsorIncome",
    "sponsor_income",
    "sponsorshipIncome",
    "sponsorship_income",
    "sponsor",
    "sponsorship",
    "directIncome",
    "direct_income",
    "referralIncome",
    "referral_income",
  ]);

  let matching = deepNum(breakdownRoot, [
    "matchingIncome",
    "matching_income",
    "matchIncome",
    "match_income",
    "binaryIncome",
    "binary_income",
    "pairIncome",
    "pair_income",
    "matching",
  ]);

  let matchingCount = Math.round(
    deepNum(breakdownRoot, [
      "matchingCount",
      "matching_count",
      "matches",
      "match_count",
      "pairs",
      "pair_count",
      "matchingPairs",
      "matching_pairs",
    ]),
  );

  let reward = deepNum(breakdownRoot, [
    "rewardIncome",
    "reward_income",
    "rewards",
    "reward",
    "rewardAmount",
    "reward_amount",
    "bonusIncome",
    "bonus_income",
    "bonuses",
  ]);

  /** Backend `GET .../statistics` → `total_income` totals (canonical for this Laravel API). */
  if (Object.keys(totalIncomeBucket).length) {
    if (totalIncomeBucket.self !== undefined && totalIncomeBucket.self !== null && totalIncomeBucket.self !== "") {
      selfPurchase = num(totalIncomeBucket.self);
    } else if (totalIncomeBucket.self_purchase !== undefined && totalIncomeBucket.self_purchase !== null) {
      selfPurchase = num(totalIncomeBucket.self_purchase);
    }

    if (totalIncomeBucket.sponsor !== undefined && totalIncomeBucket.sponsor !== null && totalIncomeBucket.sponsor !== "") {
      sponsor = num(totalIncomeBucket.sponsor);
    } else if (totalIncomeBucket.direct !== undefined && totalIncomeBucket.direct !== null) {
      sponsor = num(totalIncomeBucket.direct);
    }

    if (totalIncomeBucket.matching !== undefined && totalIncomeBucket.matching !== null && totalIncomeBucket.matching !== "") {
      matching = num(totalIncomeBucket.matching);
    } else if (totalIncomeBucket.binary !== undefined && totalIncomeBucket.binary !== null) {
      matching = num(totalIncomeBucket.binary);
    }

    if (totalIncomeBucket.reward !== undefined && totalIncomeBucket.reward !== null && totalIncomeBucket.reward !== "") {
      reward = num(totalIncomeBucket.reward);
    } else if (totalIncomeBucket.award !== undefined && totalIncomeBucket.award !== null) {
      reward = num(totalIncomeBucket.award);
    }
  }

  if (stats.total_matches !== undefined && stats.total_matches !== null && stats.total_matches !== "") {
    matchingCount = Math.round(num(stats.total_matches));
  }

  if (
    Object.keys(thisMonthBucket).length &&
    thisMonthBucket.total !== undefined &&
    thisMonthBucket.total !== null &&
    thisMonthBucket.total !== ""
  ) {
    monthIncome = num(thisMonthBucket.total);
  }

  const monthTxCand = deepNum(stats, [
    "monthly_transactions",
    "monthlyTransactions",
    "month_transaction_count",
    "transactions_this_month",
  ]);
  if (monthTxCand) {
    monthTxCount = Math.round(monthTxCand);
  } else {
    const nestedMonthTx =
      deepNum(thisMonthBucket, ["count", "transaction_count", "transactions", "txn_count"]) || 0;
    if (nestedMonthTx) monthTxCount = Math.round(nestedMonthTx);
    else if (monthTxCount === 0 && stats.total_transactions !== undefined && stats.total_transactions !== null) {
      // Laravel stats endpoint lacks per-month txn count — fall back defensively for UI continuity.
      monthTxCount = Math.round(num(stats.total_transactions));
    }
  }

  // Keyword scan only when we don't have Laravel statistics bucket (otherwise zeros are valid totals).
  if (!Object.keys(totalIncomeBucket).length) {
    if (selfPurchase === 0) {
      selfPurchase = deepFindMaxNumberByKey(merged, ["self", "purchase", "personal"]);
    }
    if (sponsor === 0) {
      sponsor = deepFindMaxNumberByKey(merged, ["sponsor", "direct", "referral"]);
    }
    if (matching === 0) {
      matching = deepFindMaxNumberByKey(merged, ["matching", "binary", "pair"]);
    }
    if (reward === 0) {
      reward = deepFindMaxNumberByKey(merged, ["reward", "bonus", "incentive"]);
    }
    if (matchingCount === 0) {
      matchingCount = Math.round(deepFindMaxNumberByKey(merged, ["match_count", "matching_count", "pairs", "matches"]));
    }
  }

  const bvTotal =
    num(pick(bv, [["totalBv", "total_bv"], ["totalBV", "total_b_v"]])) ||
    num(
      pick(merged, [
        ["totalBv", "total_bv"],
        ["totalBV", "total_b_v"],
      ]),
    );

  const bvLeft =
    num(pick(bv, [["leftLegBv", "left_leg_bv"], ["leftBv", "left_bv"]])) ||
    deepNum(merged, ["left_leg_bv", "leftLegBv", "bv_left_leg", "bvLeftLeg"]);

  const bvRight =
    num(pick(bv, [["rightLegBv", "right_leg_bv"], ["rightBv", "right_bv"]])) ||
    deepNum(merged, ["right_leg_bv", "rightLegBv", "bv_right_leg", "bvRightLeg"]);

  const bvLeftCf = deepNum(merged, [
    "leftCarryForward",
    "left_carry_forward",
    "leftLegCarryForward",
    "left_leg_carry_forward",
    "carryLeft",
    "carry_left",
    "left_cf",
    "leftCarry",
    "carry_forward_left",
    "left_carry",
  ]);

  const bvRightCf = deepNum(merged, [
    "rightCarryForward",
    "right_carry_forward",
    "rightLegCarryForward",
    "right_leg_carry_forward",
    "carryRight",
    "carry_right",
    "right_cf",
    "rightCarry",
    "carry_forward_right",
    "right_carry",
  ]);

  const bvMatched =
    num(pick(bv, [["totalMatchedBv", "total_matched_bv"], ["matchedBv", "matched_bv"]])) ||
    deepNum(merged, [
      "totalMatchedBv",
      "total_matched_bv",
      "matchedBv",
      "matched_bv",
      "totalMatched",
      "total_matched",
      "matchedBVTotal",
      "matched_bv_total",
      "matched_total_bv",
      "total_match_bv",
      "total_matchedBV",
    ]);

  let nextRatio = firstStr(
    pick(merged, [
      ["nextMatchRatio", "next_match_ratio"],
      ["matchRatio", "match_ratio"],
    ]) ?? pick(bv, [["nextMatchRatio", "next_match_ratio"]]),
  );
  if (!nextRatio) {
    const firstDone = pick(bv, [["firstMatchDone", "first_match_done"]]);
    if (typeof firstDone === "boolean") {
      nextRatio = "1:1";
    } else {
      const a = num(pick(bv, [["ratioLeft", "ratio_left"], ["leftRatio", "left_ratio"]]));
      const b = num(pick(bv, [["ratioRight", "ratio_right"], ["rightRatio", "right_ratio"]]));
      if (a && b) nextRatio = `${a}:${b}`;
      else nextRatio = "1:1";
    }
  }

  const bvBarLeft = num(
    pick(merged, [
      ["bvBalanceLeft", "bv_balance_left"],
      ["pendingLeftBv", "pending_left_bv"],
    ]) ??
      pick(bv, [
        ["balanceLeft", "balance_left"],
        ["leftPending", "left_pending"],
      ]),
  );

  const bvBarRight = num(
    pick(merged, [
      ["bvBalanceRight", "bv_balance_right"],
      ["pendingRightBv", "pending_right_bv"],
    ]) ??
      pick(bv, [
        ["balanceRight", "balance_right"],
        ["rightPending", "right_pending"],
      ]),
  );

  let bvBalanceLeft = bvBarLeft;
  let bvBalanceRight = bvBarRight;
  if (bvBalanceLeft === 0 && bvBalanceRight === 0 && (bvLeftCf !== 0 || bvRightCf !== 0)) {
    bvBalanceLeft = bvLeftCf;
    bvBalanceRight = bvRightCf;
  }

  let activeMember = true;
  const am = pick(merged, [
    ["isActiveMember", "is_active_member"],
    ["activeMember", "active_member"],
  ]);
  if (typeof am === "boolean") activeMember = am;
  else if (am === "0" || am === "false") activeMember = false;

  // Laravel summary returns `member_id` as internal numeric ID — prefer the searched public member id.
  const viewingId =
    (fallbackMemberId && fallbackMemberId.trim()) ||
    firstStr(merged.memberCode ?? merged.member_code ?? merged.loginId ?? merged.login_id) ||
    firstStr(merged.memberId ?? merged.member_id) ||
    "—";

  return {
    viewingId,
    walletBalance,
    totalEarned: totalEarned || walletBalance,
    weeklyIncome,
    weeklyCapRemaining,
    monthIncome,
    monthTxCount,
    directReferrals,
    referralsNeedMore,
    selfPurchase,
    sponsor,
    matching,
    matchingCount,
    reward,
    bvTotal,
    bvLeft,
    bvLeftCf,
    bvRight,
    bvRightCf,
    bvMatched,
    nextRatio,
    bvBarLeft: bvBalanceLeft,
    bvBarRight: bvBalanceRight,
    activeMember,
  };
}
