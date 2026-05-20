export { metaGet, metaGetAllPages, MetaApiError } from "./client";
export {
  fetchInsights,
  fetchAccountReach,
  summarizeInsights,
  summarizeByCampaign,
  summarizeByAdSet,
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
export {
  setCampaignStatus,
  setAdSetStatus,
  type CampaignStatus,
} from "./edit";
export {
  listAdSets,
  getAdSetStatusMap,
  type MetaAdSet,
  type AdSetMeta,
} from "./adsets";
export {
  listBusinessUsers,
  listAdAccountAssignedUsers,
  resolveUserIdFromEmail,
  assignUserToAdAccount,
  removeUserFromAdAccount,
  AD_ACCOUNT_TASKS,
  type AdAccountTask,
  type BusinessUser,
  type AssignedUser,
} from "./business-users";
export { getInsights } from "./cache";
export type {
  MetaActionStat,
  MetaAdAccount,
  MetaCampaign,
  MetaInsightRow,
  MetaPaging,
} from "./types";
