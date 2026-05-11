export { metaGet, metaGetAllPages, MetaApiError } from "./client";
export {
  fetchInsights,
  fetchAccountReach,
  summarizeInsights,
  summarizeByCampaign,
  dailyTimeSeries,
  classifyObjective,
  INSIGHT_FIELDS,
  type DateRange,
  type FetchInsightsOptions,
  type InsightLevel,
  type KpiSummary,
  type CampaignObjectiveKind,
} from "./insights";
export { listCampaigns, getAdAccount } from "./campaigns";
export {
  listAccessibleAdAccounts,
  accountStatusLabel,
  ACCOUNT_STATUS_LABEL,
  type AccessibleAdAccount,
} from "./business";
export {
  getCampaignStatusMap,
  isActiveEffectiveStatus,
  type CampaignMeta,
} from "./campaign-status";
export { setCampaignStatus, type CampaignStatus } from "./edit";
export { getInsights } from "./cache";
export type {
  MetaActionStat,
  MetaAdAccount,
  MetaCampaign,
  MetaInsightRow,
  MetaPaging,
} from "./types";
