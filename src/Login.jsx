import React, { useState } from "react";
import { supabase } from "./supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signup, setSignup] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const { error } = signup
        ? await supabase.auth.signUp({
            email,
            password
          })
        : await supabase.auth.signInWithPassword({
            email,
            password
          });

      if (error) throw error;

      setMessage(
        signup
          ? "Check your email to confirm your account."
          : "Successfully signed in!"
      );
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = {
    width: "100%",
    boxSizing: "border-box",
    padding: "14px",
    background: "#080c12",
    border: "1px solid #243244",
    borderRadius: 10,
    color: "#e8eef7",
    marginBottom: 14,
    fontSize: 16
  };

  const buttonStyle = {
    width: "100%",
    padding: "14px",
    background: "#174d3b",
    color: "#42e6a4",
    border: "1px solid #42e6a4",
    borderRadius: 10,
    fontWeight: "bold",
    cursor: "pointer"
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#080c12",
      color: "#e8eef7",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "Arial, sans-serif",
      padding: 20
    }}>
      <div style={{
        width: "100%",
        maxWidth: 400,
        background: "#101822",
        border: "1px solid #243244",
        borderRadius: 20,
        padding: 30
      }}>
        <h1 style={{
          color: "#42e6a4",
          textAlign: "center"
        }}>
          TradePilot AI
        </h1>

        <p style={{
          color: "#94a3b8",
          textAlign: "center"
        }}>
          Market Research & Virtual Portfolio
        </p>

        <h2>{signup ? "Create Account" : "Welcome Back"}</h2>

        <form onSubmit={handleSubmit}>
          <input
            type="email"
            id="login-email"
name="email"
aria-label="Email address"
autoComplete="email"
            placeholder="Email address"
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={inputStyle}
            required
          />

          <input
            type="password"
            id="login-password"
name="password"
aria-label="Password"
autoComplete={signup ? "new-password" : "current-password"}
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={inputStyle}
            minLength={8}
            required
          />

          <button
            type="submit"
            disabled={loading}
            style={buttonStyle}
          >
            {loading
              ? "PLEASE WAIT..."
              : signup
              ? "CREATE ACCOUNT"
              : "SIGN IN"}
          </button>
        </form>

        <p style={{
          textAlign: "center",
          color: "#94a3b8"
        }}>
          {message}
        </p>

        <button
          type="button"
          onClick={() => {
            setSignup(!signup);
            setMessage("");
          }}
          style={{
            ...buttonStyle,
            background: "transparent"
          }}
        >
          {signup
            ? "ALREADY HAVE AN ACCOUNT?"
            : "CREATE NEW ACCOUNT"}
        </button>
      </div>
    </div>
  );
}
