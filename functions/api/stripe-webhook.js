import Stripe from "stripe";

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

  if (
    !env.STRIPE_SECRET_KEY?.startsWith("sk_test_") ||
    !env.STRIPE_WEBHOOK_SECRET
  ) {
    return Response.json(
      { error: "Sandbox configuration required" },
      { status: 503 }
    );
  }

  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return Response.json(
      { error: "Missing signature" },
      { status: 400 }
    );
  }

  try {
    const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      httpClient: Stripe.createFetchHttpClient()
    });

    const event = await stripe.webhooks.constructEventAsync(
      await request.text(),
      signature,
      env.STRIPE_WEBHOOK_SECRET,
      300,
      Stripe.createSubtleCryptoProvider()
    );

    if (event.livemode !== false) {
      return Response.json(
        { error: "Live events disabled" },
        { status: 403 }
      );
    }

    return Response.json({
      received: true,
      signatureVerified: true,
      testMode: true,
      paymentsEnabled: false,
      accessGranted: false
    });

  } catch {
    return Response.json(
      { error: "Webhook verification failed" },
      { status: 400 }
    );
  }
}
