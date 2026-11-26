export async function onRequestPost() {
  return Response.json(
    {
      error: "Production webhook not enabled",
      paymentsEnabled: false
    },
    { status: 503 }
  );
}
