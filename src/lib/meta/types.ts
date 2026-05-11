// Meta Marketing API response shapes — only the fields we read.
// Mirrors the FIELDS list in §7 of the spec.

export type MetaActionStat = {
  action_type: string;
  value: string;
};

export type MetaInsightRow = {
  campaign_id?: string;
  campaign_name?: string;
  adset_id?: string;
  adset_name?: string;
  ad_id?: string;
  ad_name?: string;
  date_start: string;
  date_stop: string;
  spend?: string;
  reach?: string;
  frequency?: string;
  impressions?: string;
  cpm?: string;
  clicks?: string;
  cpc?: string;
  ctr?: string;
  inline_link_clicks?: string;
  cost_per_inline_link_click?: string;
  inline_link_click_ctr?: string;
  actions?: MetaActionStat[];
  action_values?: MetaActionStat[];
  cost_per_action_type?: MetaActionStat[];
  purchase_roas?: MetaActionStat[];
};

export type MetaCampaign = {
  id: string;
  name: string;
  status: "ACTIVE" | "PAUSED" | "DELETED" | "ARCHIVED";
  effective_status: string;
  objective?: string;
  created_time?: string;
  updated_time?: string;
  daily_budget?: string;
  lifetime_budget?: string;
};

export type MetaAdAccount = {
  id: string;
  account_id: string;
  name: string;
  currency: string;
  timezone_name: string;
  business_name?: string;
};

export type MetaPaging<T> = {
  data: T[];
  paging?: {
    cursors?: { before?: string; after?: string };
    next?: string;
    previous?: string;
  };
};

export type MetaApiError = {
  error: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
};
