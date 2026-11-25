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

  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return Response.json(
      { error: "Missing signature" },
      { status: 400 }
    );
  }

  return Response.json({
    testMode: true,
    signaturePresent: true,
    webhookConfigured: Boolean(env.STRIPE_WEBHOOK_SECRET),
    databaseConfigured: Boolean(env.SUPABASE_SECRET_KEY),
    paymentsEnabled: false,
    accessGranted: false
  });
}
