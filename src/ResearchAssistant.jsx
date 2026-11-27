import React, { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";

export default function ResearchAssistant() {
  const [token, setToken] = useState("BONK");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "TradePilot Intelligence online. Select a token and ask me about its market activity, liquidity, momentum or potential risks."
    }
  ]);

  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth"
    });
  }, [messages, loading]);

  async function sendMessage(question) {
    const text = question.trim();

    if (!text || loading) return;

    setMessages(previous => [
      ...previous,
      { role: "user", content: text }
    ]);

    setMessage("");
    setLoading(true);

    try {
      const { data } = await supabase.auth.getSession();
      const session = data?.session;

      if (!session) {
        throw new Error("Please sign in again.");
      }

      const response = await fetch(
        "/api/research-assistant",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            message: text,
            token
          })
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "AI request failed."
        );
      }

      setMessages(previous => [
        ...previous,
        {
          role: "assistant",
          content: result.reply
        }
      ]);

    } catch (error) {
      setMessages(previous => [
        ...previous,
        {
          role: "assistant",
          content: error.message
        }
      ]);
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = {
    background: "#080c12",
    color: "#e8eef7",
    border: "1px solid #293740",
    borderRadius: 10,
    padding: 14,
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box"
  };

  const buttonStyle = {
    background: "#12382c",
    color: "#42e6a4",
    border: "1px solid #27694f",
    borderRadius: 10,
    padding: "12px 16px",
    cursor: "pointer",
    fontWeight: 600
  };

  return (
    <div style={{
      background: "#080c12",
      color: "#e8eef7",
      padding: 20,
      borderRadius: 16,
      fontFamily: "Arial, sans-serif"
    }}>

      <div style={{
        color: "#42e6a4",
        fontSize: 11,
        letterSpacing: 3,
        marginBottom: 10
      }}>
        ● TRADEPILOT INTELLIGENCE
      </div>

      <h1 style={{
        fontSize: 28,
        margin: "0 0 8px"
      }}>
        AI Research Assistant
      </h1>

      <p style={{
        color: "#8493a3",
        fontSize: 14
      }}>
        AI-powered market research and live token intelligence.
      </p>

      <div style={{ margin: "20px 0" }}>
        <label style={{
          display: "block",
          color: "#8493a3",
          fontSize: 12,
          marginBottom: 8
        }}>
          TOKEN SYMBOL OR CONTRACT ADDRESS
        </label>

        <input
          value={token}
          onChange={e => setToken(e.target.value)}
          placeholder="BONK, WIF or contract address"
          maxLength={100}
          style={{
            ...inputStyle,
            width: "100%"
          }}
        />
      </div>

      <div style={{
        height: 420,
        overflowY: "auto",
        background: "#0b1119",
        border: "1px solid #202c37",
        borderRadius: 14,
        padding: 16
      }}>

        {messages.map((item, index) => (
          <div key={index} style={{
            display: "flex",
            justifyContent:
              item.role === "user"
                ? "flex-end"
                : "flex-start",
            marginBottom: 18
          }}>
            <div style={{
              maxWidth: "88%",
              background:
                item.role === "user"
                  ? "#153c30"
                  : "#121c26",
              border: "1px solid #26343e",
              borderRadius: 12,
              padding: 15,
              lineHeight: 1.7,
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
              fontSize: 14
            }}>
              <div style={{
                color: "#42e6a4",
                fontSize: 10,
                letterSpacing: 2,
                marginBottom: 8
              }}>
                {item.role === "user"
                  ? "YOU"
                  : "TRADEPILOT AI"}
              </div>

              {item.role === "assistant"
  ? String(item.content).split("\n").map((line, i) => {
      const value = line.trim().toLowerCase()
        .replace(/[*.]/g, "");

      let color = "#e8eef7";
      let bold = false;

      if (value === "favorable") {
        color = "#42e6a4";
        bold = true;
      } else if (value === "unfavorable") {
        color = "#ff5252";
        bold = true;
      } else if (value === "neutral") {
        color = "#facc15";
        bold = true;
      } else if (
        value === "high" ||
        value === "very high"
      ) {
        color = "#ff5252";
        bold = true;
      } else if (value === "moderate") {
        color = "#facc15";
        bold = true;
      } else if (value.endsWith(":")) {
        bold = true;
      }

      return (
        <div key={i} style={{
          color,
          fontWeight: bold ? 700 : 400,
          minHeight: 8
        }}>
          {line}
        </div>
      );
    })
  : item.content}
            </div>
          </div>
        ))}

        {loading && (
          <p style={{ color: "#42e6a4" }}>
            Analyzing market data...
          </p>
        )}

        <div ref={bottomRef} />
      </div>

      <div style={{
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        margin: "15px 0"
      }}>
        {[
          "Get market verdict",
"Analyze this token",
          "Explain market momentum",
          "Check potential risks",
          "Explain buying and selling activity"
        ].map(question => (
          <button
            key={question}
            disabled={loading}
            onClick={() => sendMessage(question)}
            style={{
              ...buttonStyle,
              fontSize: 12
            }}
          >
            {question}
          </button>
        ))}
      </div>

      <form
        onSubmit={e => {
          e.preventDefault();
          sendMessage(message);
        }}
        style={{
          display: "flex",
          gap: 10
        }}
      >
        <input
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Ask TradePilot AI..."
          maxLength={1000}
          style={{
            ...inputStyle,
            flex: 1,
            minWidth: 0
          }}
        />

        <button
          type="submit"
          disabled={loading || !message.trim()}
          style={buttonStyle}
        >
          {loading ? "..." : "Send ↑"}
        </button>
      </form>

      <p style={{
        fontSize: 11,
        color: "#718096",
        textAlign: "center",
        marginTop: 15
      }}>
        AI-generated research may be inaccurate.
        Educational information only.
      </p>
    </div>
  );
}
