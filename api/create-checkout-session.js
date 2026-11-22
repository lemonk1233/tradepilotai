
import Stripe from "stripe";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_PRICE_ID;

  if (!secretKey?.startsWith("sk_test_") || !priceId) {
    return res.status(503).json({
      error: "Stripe sandbox configuration required"
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

    const origin = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:5173";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
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
    console.error("Stripe sandbox checkout error:", error.message);

    return res.status(500).json({
      error: "Unable to create test checkout"
    });
  }
}
