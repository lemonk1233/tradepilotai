import Stripe from "stripe";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_PRICE_ID;

  if (!secretKey?.startsWith("sk_test_")) {
    return res.status(503).json({
      error: "Sandbox configuration required"
    });
  }

  if (!priceId) {
    return res.status(503).json({
      error: "Missing test price"
    });
  }

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

    return res.status(200).json({
      ready: true,
      testMode: true,
      amount: 1000,
      currency: "usd"
    });

  } catch (error) {
    return res.status(500).json({
      error: "Sandbox configuration failed"
    });
  }
}