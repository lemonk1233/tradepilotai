import { createClient } from "@supabase/supabase-js";

export async function onRequestPost({ request, env }) {
  const hostname = new URL(request.url).hostname;

  if (hostname !== "cloudflare-sandbox.tradepilotai.pages.dev") {
    return Response.json(
      { error: "Checkout disabled" },
      { status: 403 }
    );
  }

  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (
    url !== "https://qltvqhlvccjkglxitbzr.supabase.co" ||
    !key
  ) {
    return Response.json(
      { error: "Sandbox configuration required" },
      { status: 503 }
    );
  }

  const authorization = request.headers.get("Authorization") || "";

  if (!authorization.startsWith("Bearer ")) {
    return Response.json(
      { error: "Please sign in" },
      { status: 401 }
    );
  }

  const supabase = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  const { data, error } = await supabase.auth.getUser(
    authorization.slice(7)
  );

  if (error || !data?.user) {
    return Response.json(
      { error: "Invalid login" },
      { status: 401 }
    );
  }

  return Response.json({
    testMode: true,
    authenticated: true,
    paymentsEnabled: false
  });
}
