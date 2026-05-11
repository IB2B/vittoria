export type GoogleAdsConfig = {
  developerToken: string;
  clientId: string;
  clientSecret: string;
  loginCustomerId?: string;
  redirectUri: string;
};

export function hasGoogleAdsCredentials(): boolean {
  return !!(
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN &&
    process.env.GOOGLE_OAUTH_CLIENT_ID &&
    process.env.GOOGLE_OAUTH_CLIENT_SECRET
  );
}

export function getGoogleAdsConfig(): GoogleAdsConfig {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!developerToken || !clientId || !clientSecret) {
    throw new Error(
      "Google Ads is not configured. Set GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET in .env.",
    );
  }
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3001";
  return {
    developerToken,
    clientId,
    clientSecret,
    loginCustomerId: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || undefined,
    redirectUri: `${baseUrl.replace(/\/$/, "")}/api/google/oauth/callback`,
  };
}
