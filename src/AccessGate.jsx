import React from "react";
import { supabase } from "./supabase";

export default function AccessGate({ onRefresh }) {
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

        <h1 style={{
          color: "#42e6a4",
          fontSize: 48,
          marginBottom: 0
        }}>
          $10.00
        </h1>

        <p>One-time access — Test Mode</p>

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

        <button
  style={button}
  onClick={async () => {
    try {
      const response = await fetch(
        "/api/create-checkout-session",
        { method: "POST" }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error);
      }

      alert("Stripe sandbox is ready!");
    } catch (error) {
      alert("Sandbox error: " + error.message);
    }
  }}
>
  UNLOCK ACCESS — TEST MODE
</button>

        <p style={{ color: "#94a3b8", fontSize: 12 }}>
          No real payments are accepted.
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
            const { error } = await supabase.auth.signOut();
            if (error) alert(error.message);
          }}
        >
          LOG OUT
        </button>
      </div>
    </div>
  );
}