import { settingsApi } from "@/api/settings";
import type { SettingsMap } from "@/types/dashboard";
import type { SimulationFormState } from "@/utils/dashboardMath";
import { unwrapSettingValue } from "@/utils/settingsValue";

function readNestedSetting(settings: SettingsMap, key: string, fallback: number): string {
  const entry = settings[key];
  let v: unknown = unwrapSettingValue(entry);
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "string" && v.trim() !== "") return v;
  return String(fallback);
}

export async function fetchSettingsPayload(): Promise<SettingsMap> {
  const { data } = await settingsApi.get();
  return (data as { settings?: SettingsMap }).settings ?? {};
}

export function simulationDefaultsFromSettings(settings: SettingsMap): SimulationFormState {
  return {
    joiningAmount: readNestedSetting(settings, "joining_amount", 10_000),
    businessVolume: readNestedSetting(settings, "business_volume", 5_000),
    selfIncome: readNestedSetting(settings, "self_income_percent", 10),
    directIncome: readNestedSetting(settings, "direct_income_percent", 20),
    matchingIncome: readNestedSetting(settings, "matching_income_percent", 10),
    selfRepurchaseIncome: readNestedSetting(settings, "self_repurchase_income_percent", 10),
    repurchaseMatchingIncome: readNestedSetting(settings, "repurchase_matching_income_percent", 10),
    awardIncome: readNestedSetting(settings, "award_income_percent", 20),
    repurchaseAmount: readNestedSetting(settings, "repurchase_amount", 10_000),
    repurchaseBv: readNestedSetting(settings, "repurchase_bv", 2_000),
    weeklyCapping: readNestedSetting(settings, "weekly_capping", 50_000),
  };
}

export interface SimulationSavePayload {
  joiningAmount: number;
  businessVolume: number;
  selfIncome: number;
  directIncome: number;
  matchingIncome: number;
  selfRepurchaseIncome: number;
  repurchaseMatchingIncome: number;
  awardIncome: number;
}

/** Bundle `HN` — persists strategy-lab fields via `PUT /settings`. */
export async function saveSimulationSettings(payload: SimulationSavePayload) {
  const body = {
    settings: [
      { key: "joining_amount", value: payload.joiningAmount },
      { key: "business_volume", value: payload.businessVolume },
      { key: "self_income_percent", value: payload.selfIncome },
      { key: "direct_income_percent", value: payload.directIncome },
      { key: "matching_income_percent", value: payload.matchingIncome },
      { key: "self_repurchase_income_percent", value: payload.selfRepurchaseIncome },
      { key: "repurchase_matching_income_percent", value: payload.repurchaseMatchingIncome },
      { key: "award_income_percent", value: payload.awardIncome },
    ],
  };
  await settingsApi.put(body);
}
