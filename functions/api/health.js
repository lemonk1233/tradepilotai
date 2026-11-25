export function onRequestGet() {
  return Response.json({
    status: "ok",
    environment: "sandbox",
    paymentsEnabled: false
  });
}
