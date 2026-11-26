import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export async function onRequestPost({ request, env }) {
  const origin = "https://cloudflare-sandbox.tradepilotai.pages.dev";

  if (new URL(request.url).origin !== origin) {
    return Response.json({ error: "Disabled" }, { status: 403 });
  }

  if (
    env.VITE_SUPABASE_URL !== "https://qltvqhlvccjkglxitbzr.supabase.co" ||
    !env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    !env.STRIPE_SECRET_KEY?.startsWith("sk_test_") ||
    !env.STRIPE_PRICE_ID
  ) {
    return Response.json({ error: "Sandbox configuration required" }, { status: 503 });
  }

  const authorization = request.headers.get("Authorization") || "";

  if (!authorization.startsWith("Bearer ")) {
    return Response.json({ error: "Please sign in" }, { status: 401 });
  }

  try {
    const supabase = createClient(
      env.VITE_SUPABASE_URL,
      env.VITE_SUPABASE_PUBLISHABLE_KEY,
      {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  },
  global: {
    headers: {
      Authorization: authorization
    }
  }
}
    );

    const { data, error } = await supabase.auth.getUser(
      authorization.slice(7)
    );

    if (error || !data?.user) {
      return Response.json({ error: "Invalid login" }, { status: 401 });
    }
const { data: access, error: accessError } = await supabase
  .from("user_access")
  .select("access_type")
  .eq("user_id", data.user.id)
  .maybeSingle();

if (accessError) {
  return Response.json(
    { error: "Unable to verify account access" },
    { status: 503 }
  );
}

if (["admin", "free", "test_paid"].includes(access?.access_type)) {
  return Response.json(
    { error: "You already have access" },
    { status: 409 }
  );
}
    const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      httpClient: Stripe.createFetchHttpClient()
    });

    const price = await stripe.prices.retrieve(env.STRIPE_PRICE_ID);

    if (
      price.livemode !== false ||
      !price.active ||
      price.currency !== "usd" ||
      price.unit_amount !== 1000 ||
      price.type !== "one_time"
    ) {
      return Response.json({ error: "Invalid test price" }, { status: 403 });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{ price: price.id, quantity: 1 }],
      client_reference_id: data.user.id,
      metadata: {
        user_id: data.user.id,
        environment: "cloudflare-sandbox"
      },
      success_url: origin + "/?checkout=success",
      cancel_url: origin + "/?checkout=cancelled"
}, {
  idempotencyKey:
    `sandbox-${data.user.id}-${price.id}-${Math.floor(Date.now() / 1800000)}`
});
    if (session.livemode !== false || !session.url) {
      throw new Error("Invalid sandbox session");
    }

    return Response.json({
      testMode: true,
      paymentsEnabled: false,
      url: session.url
    });
  } catch {
    return Response.json({ error: "Test checkout failed" }, { status: 500 });
  }
}
