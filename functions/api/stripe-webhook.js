export async function onRequestPost({ request, env }) {
  if (
    new URL(request.url).hostname !==
    "cloudflare-sandbox.tradepilotai.pages.dev"
  ) {
    return Response.json(
      { error: "Webhook disabled" },
      { status: 403 }
    );
  }

  return Response.json({
    testMode: true,
    webhookConfigured: Boolean(
      env.STRIPE_WEBHOOK_SECRET
    ),
    stripeConfigured:
      env.STRIPE_SECRET_KEY?.startsWith("sk_test_") === true,
    databaseConfigured:
      env.VITE_SUPABASE_URL ===
      "https://qltvqhlvccjkglxitbzr.supabase.co",
    paymentsEnabled: false,
    accessGranted: false
  });
}
