export async function onRequestPost({ request }) {
  const hostname = new URL(request.url).hostname;

  if (hostname !== "cloudflare-sandbox.tradepilotai.pages.dev") {
    return Response.json(
      { error: "Checkout disabled" },
      { status: 403 }
    );
  }

  return Response.json({
    testMode: true,
    paymentsEnabled: false,
    message: "Sandbox endpoint ready"
  });
}
