export async function onRequestPost() {
  return Response.json(
    {
      error: "Production checkout is not enabled yet",
      paymentsEnabled: false
    },
    { status: 503 }
  );
}
