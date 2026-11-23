
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const config = {
  api: {
    bodyParser: false
  }
};

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseSecret = process.env.SUPABASE_SECRET_KEY;

  if (
    !stripeKey?.startsWith("sk_test_") ||
    !webhookSecret ||
    !supabaseUrl ||
    !supabaseSecret
  ) {
    return res.status(503).json({
      error: "Webhook not configured"
    });
  }

  const stripe = new Stripe(stripeKey);

  let event;

  try {
    const rawBody = await readRawBody(req);

    event = stripe.webhooks.constructEvent(
      rawBody,
      req.headers["stripe-signature"],
      webhookSecret
    );
  } catch (error) {
    return res.status(400).json({
      error: "Invalid webhook signature"
    });
  }

  if (event.type !== "checkout.session.completed") {
    return res.status(200).json({ received: true });
  }

  try {
    const session = event.data.object;

    // Never grant access for a live payment here.
    if (
      session.livemode !== false ||
      session.mode !== "payment" ||
      session.payment_status !== "paid" ||
      session.amount_total !== 1000 ||
      session.currency !== "usd"
    ) {
      return res.status(200).json({
        received: true,
        accessGranted: false
      });
    }

    // The checkout endpoint must attach the
    // authenticated Supabase user's ID.
    
const lineItems = await stripe.checkout.sessions.listLineItems(
  session.id,
  { limit: 10 }
);

if (
  lineItems.data.length !== 1 ||
  lineItems.data[0].price?.id !== process.env.STRIPE_PRICE_ID ||
  lineItems.data[0].quantity !== 1
) {
  return res.status(200).json({
    received: true,
    accessGranted: false
  });
}

    const userId = session.metadata?.supabase_user_id;
    if (
  session.client_reference_id !== userId ||
  session.metadata?.payment_environment !== "test"
) {
  return res.status(200).json({
    received: true,
    accessGranted: false
  });
}

    if (
      !userId ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)
    ) {
      return res.status(200).json({
        received: true,
        accessGranted: false
      });
    }

    const supabase = createClient(
      supabaseUrl,
      supabaseSecret,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    );

    const { data: existing, error: readError } =
      await supabase
        .from("user_access")
        .select("access_type")
        .eq("user_id", userId)
        .maybeSingle();

    if (readError) throw readError;

    // Preserve admin and complimentary access.
    if (
      existing?.access_type === "admin" ||
      existing?.access_type === "free"
    ) {
      return res.status(200).json({
        received: true,
        accessGranted: false
      });
    }

    const { error } = await supabase
      .from("user_access")
      .upsert({
        user_id: userId,
        access_type: "test_paid"
      }, {
        onConflict: "user_id"
      });

    if (error) throw error;

    return res.status(200).json({
      received: true,
      accessGranted: true
    });
  } catch (error) {
    console.error("Webhook processing failed:", error.message);

    // Stripe can retry a failed webhook.
    return res.status(500).json({
  error: "Webhook processing failed",
  code: error.code || "UNKNOWN",
  status: error.status || null
});
  }
}
