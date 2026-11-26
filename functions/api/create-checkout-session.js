import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const ORIGIN = "https://tradepilotai.pages.dev";
const DATABASE = "https://odehgxzsitulittlwyxf.supabase.co";

export async function onRequestPost({ request, env }) {
  try {
    if (
      env.ENABLE_LIVE_PAYMENTS !== "true" ||
      new URL(request.url).origin !== ORIGIN ||
      !/^(sk|rk)_live_/.test(env.STRIPE_SECRET_KEY || "") ||
      !env.STRIPE_PRICE_ID ||
      env.VITE_SUPABASE_URL !== DATABASE ||
      !env.VITE_SUPABASE_PUBLISHABLE_KEY
    ) {
      return Response.json(
        { error: "Production checkout disabled" },
        { status: 503 }
      );
    }

    const authorization =
      request.headers.get("Authorization") || "";

    if (!authorization.startsWith("Bearer ")) {
      return Response.json(
        { error: "Please sign in" },
        { status: 401 }
      );
    }

    const supabase = createClient(
      DATABASE,
      env.VITE_SUPABASE_PUBLISHABLE_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        },
        global: {
          headers: { Authorization: authorization }
        }
      }
    );

    const { data, error } = await supabase.auth.getUser(
      authorization.slice(7)
    );

    if (error || !data?.user) {
      return Response.json(
        { error: "Invalid login" },
        { status: 401 }
      );
    }

    const { data: access, error: accessError } =
      await supabase
        .from("user_access")
        .select("access_type")
        .eq("user_id", data.user.id)
        .maybeSingle();

    if (accessError) {
      throw new Error("Access verification failed");
    }

    if (["admin", "free", "paid"].includes(access?.access_type)) {
      return Response.json(
        { error: "You already have access" },
        { status: 409 }
      );
    }

    const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      httpClient: Stripe.createFetchHttpClient()
    });

    const price = await stripe.prices.retrieve(
      env.STRIPE_PRICE_ID
    );

    if (
      !price.livemode ||
      !price.active ||
      price.unit_amount !== 1000 ||
      price.currency !== "usd" ||
      price.type !== "one_time"
    ) {
      return Response.json(
        { error: "Invalid production price" },
        { status: 503 }
      );
    }

    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [
          {
            price: price.id,
            quantity: 1
          }
        ],
        client_reference_id: data.user.id,
        metadata: {
          user_id: data.user.id,
          environment: "production"
        },
        success_url: ORIGIN + "/?checkout=success",
        cancel_url: ORIGIN + "/?checkout=cancelled"
      },
      {
        idempotencyKey:
          `tradepilot-${data.user.id}-${price.id}-${Math.floor(Date.now() / 1800000)}`
      }
    );

    if (!session.livemode || !session.url) {
      throw new Error("Invalid checkout session");
    }

    return Response.json({
      testMode: false,
      paymentsEnabled: true,
      url: session.url
    });

  } catch {
    return Response.json(
      { error: "Unable to create checkout" },
      { status: 500 }
    );
  }
}
