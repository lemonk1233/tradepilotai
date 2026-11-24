
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
    if (process.env.VERCEL_ENV === "production") {
    return res.status(403).json({
      error: "Checkout is currently disabled"
    });
  }
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_PRICE_ID;
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey =
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!secretKey?.startsWith("sk_test_") || !priceId) {
    return res.status(503).json({
      error: "Stripe sandbox configuration required"
    });
  }

  if (!supabaseUrl || !supabaseKey) {
    return res.status(503).json({
      error: "Supabase configuration required"
    });
  }

  // Verify the signed-in user on the server.
  const authorization = req.headers.authorization || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({
      error: "Please sign in again"
    });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: authData, error: authError } =
    await supabase.auth.getUser(token);

  if (authError || !authData.user) {
    return res.status(401).json({
      error: "Invalid or expired login"
    });
  }

  const user = authData.user;

  try {
    const stripe = new Stripe(secretKey);
    const price = await stripe.prices.retrieve(priceId);

    if (
      price.livemode ||
      !price.active ||
      price.unit_amount !== 1000 ||
      price.currency !== "usd" ||
      price.type !== "one_time"
    ) {
      return res.status(400).json({
        error: "Invalid sandbox price"
      });
    }

    const origin = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:5173";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      client_reference_id: user.id,
      metadata: {
        supabase_user_id: user.id,
        payment_environment: "test"
      },
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      success_url: `${origin}/?checkout=success`,
      cancel_url: `${origin}/?checkout=cancelled`
    });

    return res.status(200).json({
      testMode: true,
      url: session.url
    });
  } catch (error) {
    console.error("Stripe checkout error:", error.message);

    return res.status(500).json({
      error: "Unable to create test checkout"
    });
  }
}
