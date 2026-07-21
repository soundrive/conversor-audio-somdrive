export default function handler(req: any, res: any) {
  const r2Configured = !!(
    process.env.R2_ADS_ACCOUNT_ID &&
    process.env.R2_ADS_ACCESS_KEY_ID &&
    process.env.R2_ADS_SECRET_ACCESS_KEY &&
    process.env.R2_ADS_BUCKET_NAME &&
    process.env.R2_ADS_PUBLIC_BASE_URL
  );

  const ga4Configured = !!(
    process.env.GA4_PROPERTY_ID &&
    process.env.GA4_CLIENT_EMAIL &&
    process.env.GA4_PRIVATE_KEY
  );

  res.setHeader("Content-Type", "application/json");
  return res.status(200).json({
    ok: true,
    runtime: "vercel",
    timestamp: new Date().toISOString(),
    services: {
      r2Configured,
      ga4Configured,
      firebaseConfigured: true
    }
  });
}
