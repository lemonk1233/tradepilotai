import React, { useState } from "react";
import { supabase } from "./supabase";

export default function AccessGate({ onRefresh }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const productionEnabled =
    import.meta.env.VITE_ENABLE_PRODUCTION_CHECKOUT === "true";

  const sandboxEnabled =
    !productionEnabled &&
    import.meta.env.VITE_ENABLE_SANDBOX_CHECKOUT === "true";

  const checkoutEnabled =
    productionEnabled || sandboxEnabled;

  const button = {
    width: "100%",
    padding: 14,
    background: "#174d3b",
    color: "#42e6a4",
    border: "1px solid #42e6a4",
    borderRadius: 10,
    fontWeight: "bold",
    cursor: "pointer",
    marginTop: 12
  };

  async function startCheckout() {
    if (loading || !checkoutEnabled) return;

    setLoading(true);
    setError("");

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getSession();

      if (authError || !authData.session) {
        throw new Error("Please sign in again");
      }

      const response = await fetch(
        "/api/create-checkout-session",
        {
          method: "POST",
          headers: {
            Authorization:
              `Bearer ${authData.session.access_token}`
          }
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Checkout unavailable"
        );
      }

      if (
        productionEnabled &&
        (
          data.testMode !== false ||
          data.paymentsEnabled !== true
        )
      ) {
        throw new Error(
          "Invalid production checkout response"
        );
      }

      if (
        sandboxEnabled &&
        data.testMode !== true
      ) {
        throw new Error(
          "Invalid sandbox checkout response"
        );
      }

      const checkoutUrl = new URL(data.url);

      if (
        checkoutUrl.protocol !== "https:" ||
        checkoutUrl.hostname !== "checkout.stripe.com"
      ) {
        throw new Error("Invalid checkout URL");
      }

      window.location.assign(checkoutUrl.href);

    } catch (err) {
      setError(err.message || "Checkout failed");
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#080c12",
      color: "#e8eef7",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
      fontFamily: "Arial, sans-serif"
    }}>
      <div style={{
        width: "100%",
        maxWidth: 420,
        background: "#101822",
        border: "1px solid #243244",
        borderRadius: 20,
        padding: 30,
        textAlign: "center"
      }}>
        <h1 style={{ color: "#42e6a4" }}>
          TradePilot AI
        </h1>

        <h2>🔒 Unlock Full Access</h2>

        <p style={{ color: "#94a3b8" }}>
          Market Research & Virtual Portfolio
        </p>

        {checkoutEnabled && (
          <>
            <h1 style={{
              color: "#42e6a4",
              fontSize: 48,
              marginBottom: 0
            }}>
              $10.00
            </h1>

            <p>
              One-time access
              {sandboxEnabled ? " — Test Mode" : ""}
            </p>

            <p style={{
              color: "#94a3b8",
              fontSize: 13
            }}>
              No monthly subscription
            </p>
          </>
        )}

        <div style={{
          textAlign: "left",
          padding: 15,
          lineHeight: 2
        }}>
          <div>✓ Market research dashboard</div>
          <div>✓ Token discovery</div>
          <div>✓ Historical price charts</div>
          <div>✓ Risk analysis</div>
          <div>✓ Virtual portfolio simulator</div>
        </div>

        {checkoutEnabled ? (
          <button
            style={{
              ...button,
              opacity: loading ? 0.6 : 1
            }}
            disabled={loading}
            onClick={startCheckout}
          >
            {loading
              ? "OPENING CHECKOUT..."
              : sandboxEnabled
                ? "UNLOCK ACCESS — TEST MODE"
                : "UNLOCK FULL ACCESS — $10"}
          </button>
        ) : (
          <p style={{ color: "#94a3b8" }}>
            Educational beta — access by invitation only.
          </p>
        )}

        {error && (
          <p style={{
            color: "#ff7777",
            fontSize: 14
          }}>
            {error}
          </p>
        )}

        <p style={{
          color: "#94a3b8",
          fontSize: 12
        }}>
          {productionEnabled
            ? "Secure checkout powered by Stripe."
            : "No real payments are accepted."}
        </p>

        <button
          style={{
            ...button,
            background: "transparent"
          }}
          onClick={onRefresh}
        >
          REFRESH ACCESS
        </button>

        <button
          style={{
            ...button,
            background: "transparent"
          }}
          onClick={async () => {
            const { error } =
              await supabase.auth.signOut();

            if (error) setError(error.message);
          }}
        >
          LOG OUT
        </button>

        <p style={{
          fontSize: 12,
          marginTop: 20
        }}>
          <a
            href="/policies.html"
            style={{ color: "#94a3b8" }}
          >
            Terms, Privacy & Refund Policy
          </a>
        </p>
      </div>
    </div>
  );
}
