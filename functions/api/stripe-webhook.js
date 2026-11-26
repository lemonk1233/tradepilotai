import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const ORIGIN = "https://tradepilotai.pages.dev";
const DATABASE = "https://odehgxzsitulittlwyxf.supabase.co";

export async function onRequestPost({ request, env }) {
  if (
    new URL(request.url).origin !== ORIGIN ||
    !/^(sk|rk)_live_/.test(env.STRIPE_SECRET_KEY || "") ||
    !env.STRIPE_WEBHOOK_SECRET ||
    !env.STRIPE_PRICE_ID ||
    !env.SUPABASE_SECRET_KEY ||
    env.VITE_SUPABASE_URL !== DATABASE
  ) {
    return Response.json(
      { error: "Production configuration required" },
      { status: 503 }
    );
  }

  const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    httpClient: Stripe.createFetchHttpClient()
  });

  let event;

  try {
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      throw new Error("Missing signature");
    }

    event = await stripe.webhooks.constructEventAsync(
      await request.text(),
      signature,
      env.STRIPE_WEBHOOK_SECRET,
      300,
      Stripe.createSubtleCryptoProvider()
    );

  } catch {
    return Response.json(
      { error: "Invalid signature" },
      { status: 400 }
    );
  }

  if (!event.livemode) {
    return Response.json(
      { error: "Test events rejected" },
      { status: 403 }
    );
  }

  if (event.type !== "checkout.session.completed") {
    return Response.json({ received: true });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(
      event.data.object.id
    );

    const userId = session.metadata?.user_id;

    if (
      !session.livemode ||
      session.mode !== "payment" ||
      session.payment_status !== "paid" ||
      session.amount_total !== 1000 ||
      session.currency !== "usd" ||
      session.metadata?.environment !== "production" ||
      !userId ||
      userId !== session.client_reference_id
    ) {
      return Response.json(
        { error: "Invalid payment" },
        { status: 400 }
      );
    }

    const items = await stripe.checkout.sessions.listLineItems(
      session.id,
      { limit: 2 }
    );

    if (
      items.has_more ||
      items.data.length !== 1 ||
      items.data[0].quantity !== 1 ||
      items.data[0].price?.id !== env.STRIPE_PRICE_ID
    ) {
      return Response.json(
        { error: "Invalid product" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      DATABASE,
      env.SUPABASE_SECRET_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    );

    const { data: account, error: accountError } =
      await supabase.auth.admin.getUserById(userId);

    if (accountError || !account?.user) {
      throw new Error("Account unavailable");
    }

    const { data, error } = await supabase.rpc(
      "record_verified_payment",
      {
        p_session_id: session.id,
        p_user_id: userId,
        p_amount: session.amount_total,
        p_currency: session.currency
      }
    );

    if (error) throw error;

    return Response.json({
      received: true,
      processed: true,
      alreadyProcessed: data === false
    });

  } catch {
    return Response.json(
      { error: "Payment fulfillment failed" },
      { status: 500 }
    );
  }
}
