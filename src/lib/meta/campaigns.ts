import type { MetaAdAccount, MetaCampaign } from "./types";
import { metaGet, metaGetAllPages } from "./client";

export async function listCampaigns({
  metaAccountId,
  accessToken,
  bucketKey,
}: {
  metaAccountId: string;
  accessToken: string;
  bucketKey?: string;
}): Promise<MetaCampaign[]> {
  return metaGetAllPages<MetaCampaign>(
    `${metaAccountId}/campaigns`,
    {
      fields: [
        "id",
        "name",
        "status",
        "effective_status",
        "objective",
        "created_time",
        "updated_time",
        "daily_budget",
        "lifetime_budget",
      ],
      limit: 200,
    },
    { accessToken, bucketKey },
  );
}

export async function getAdAccount({
  metaAccountId,
  accessToken,
  bucketKey,
}: {
  metaAccountId: string;
  accessToken: string;
  bucketKey?: string;
}): Promise<MetaAdAccount> {
  return metaGet<MetaAdAccount>(
    metaAccountId,
    {
      fields: [
        "id",
        "account_id",
        "name",
        "currency",
        "timezone_name",
        "business_name",
      ],
    },
    { accessToken, bucketKey },
  );
}
