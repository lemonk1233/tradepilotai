import React, { useState } from "react";
import { supabase } from "./supabase";

export default function Admin({ onBack }) {
  const [userId, setUserId] = useState("");
  const [message, setMessage] = useState("");
const [busy, setBusy] = useState(false);

async function updateAccess(type) {
  if (!userId.trim()) {
    setMessage("Please enter a User UID.");
    return;
  }

  setBusy(true);
  setMessage("");

  try {
    const { error } = await supabase.rpc(
      "set_user_access",
      {
        target_user: userId.trim(),
        new_access: type
      }
    );

    if (error) throw error;

    setMessage(
      type === "free"
        ? "Free access granted successfully!"
        : "Access revoked successfully!"
    );
  } catch (error) {
    setMessage("Error: " + error.message);
  } finally {
    setBusy(false);
  }
}

  const panel = {
    background: "#101822",
    border: "1px solid #243244",
    borderRadius: 14,
    padding: 24,
    marginBottom: 20
  };

  const button = {
    background: "#174d3b",
    color: "#42e6a4",
    border: "1px solid #42e6a4",
    borderRadius: 8,
    padding: "12px 20px",
    cursor: "pointer",
    fontWeight: "bold",
    marginRight: 10
  };

  return (
    <div style={{
      background: "#080c12",
      color: "#e8eef7",
      minHeight: "100vh",
      padding: 28,
      fontFamily: "Arial, sans-serif"
    }}>
      <button style={button} onClick={onBack}>
        BACK TO DASHBOARD
      </button>

      <h1 style={{ color: "#42e6a4" }}>
        Admin Dashboard
      </h1>

      <p style={{ color: "#94a3b8" }}>
        TradePilot AI — Access Management
      </p>

      <div style={panel}>
        <h2>Manage User Access</h2>

        <input
          id="admin-user-uid"
name="userUid"
aria-label="User UID"
autoComplete="off"
          placeholder="Enter User UID"
          value={userId}
          onChange={e => setUserId(e.target.value)}
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: 14,
            background: "#080c12",
            color: "#e8eef7",
            border: "1px solid #243244",
            borderRadius: 8,
            marginBottom: 16
          }}
        />

<button
  style={button}
  disabled={busy}
  onClick={() => updateAccess("free")}
>
          GRANT FREE ACCESS
        </button>

        <button style={{
          ...button,
          background: "#401c25",
          color: "#ff647c",
          borderColor: "#ff647c"
        }}
        disabled={busy}
        onClick={() => updateAccess("none")}
      >
          REVOKE ACCESS
        </button>

        <p style={{ color: "#94a3b8" }}>
        {busy ? "Updating access..." : message}
        </p>
      </div>

      <div style={panel}>
        <h2>Payment System</h2>
        <h3 style={{ color: "#42e6a4" }}>
          $10.00 — One-time access
        </h3>
        <p>Test mode only — No real payments.</p>
      </div>
    </div>
  );
}
