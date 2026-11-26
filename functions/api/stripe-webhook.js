import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export async function onRequestPost({ request, env }) {
  if (
    !env.STRIPE_SECRET_KEY?.startsWith("sk_test_") ||
    !env.STRIPE_WEBHOOK_SECRET ||
    !env.STRIPE_PRICE_ID ||
    !env.SUPABASE_SECRET_KEY ||
    env.VITE_SUPABASE_URL !==
      "https://qltvqhlvccjkglxitbzr.supabase.co"
  ) {
    return Response.json(
      { error: "Sandbox configuration required" },
      { status: 503 }
    );
  }

  const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    httpClient: Stripe.createFetchHttpClient()
  });

  let event;

  try {
    event = await stripe.webhooks.constructEventAsync(
      await request.text(),
      request.headers.get("stripe-signature"),
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

  if (event.livemode) {
    return Response.json(
      { error: "Live events disabled" },
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
      session.livemode ||
      session.mode !== "payment" ||
      session.payment_status !== "paid" ||
      session.amount_total !== 1000 ||
      session.currency !== "usd" ||
      session.metadata?.environment !== "test" ||
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
      env.VITE_SUPABASE_URL,
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

    const { error: insertError } = await supabase
      .from("user_access")
      .upsert(
        {
          user_id: userId,
          access_type: "test_paid"
        },
        {
          onConflict: "user_id",
          ignoreDuplicates: true
        }
      );

    if (insertError) throw insertError;

    const { error: updateError } = await supabase
      .from("user_access")
      .update({ access_type: "test_paid" })
      .eq("user_id", userId)
      .eq("access_type", "none");

    if (updateError) throw updateError;

    return Response.json({
      received: true,
      testMode: true
    });

  } catch {
    return Response.json(
      { error: "Fulfillment failed" },
      { status: 500 }
    );
  }
}
