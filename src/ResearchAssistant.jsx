import React, { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";

function NexusLogo({ size = 40 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M40 8 L68 25 V55 L40 72 L12 55 V25 Z"
        stroke="#42e6a4"
        strokeWidth="3"
      />
      <path
        d="M20 48 L33 34 L43 44 L59 26 M47 26 H59 V38"
        stroke="#42e6a4"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function formatResponse(content) {
  return String(content).split("\n").map((line, i) => {
    const clean = line.replace(/\*\*/g, "");
    const value = clean.trim().toLowerCase()
      .replace(/[*.]/g, "");

    let color = "#dce3e8";
    let weight = 400;

    if (value === "favorable") {
      color = "#42e6a4";
      weight = 700;
    } else if (value === "unfavorable") {
      color = "#ff7373";
      weight = 700;
    } else if (
      value === "neutral" ||
      value === "moderate"
    ) {
      color = "#eac65b";
      weight = 700;
    } else if (
      value === "high" ||
      value === "very high"
    ) {
      color = "#ff7373";
      weight = 700;
    } else if (value === "unknown") {
      color = "#a5adb7";
      weight = 700;
    } else if (value.endsWith(":")) {
      color = "#f0f4f7";
      weight = 700;
    }

    return (
      <div
        key={i}
        style={{
          color,
          fontWeight: weight,
          minHeight: 10
        }}
      >
        {clean}
      </div>
    );
  });
}

export default function ResearchAssistant() {
  const [token, setToken] = useState("BONK");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);

  const bottomRef = useRef(null);
  const busyRef = useRef(false);

  useEffect(() => {
    if (messages.length > 0) {
      bottomRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
      });
    }
  }, [messages, loading]);

  async function sendMessage(question) {
    const text = question.trim();
    const selectedToken = token.trim();

    if (!text || busyRef.current) return;
    if (!selectedToken) return;

    busyRef.current = true;

    setMessages(previous => [
      ...previous,
      {
        role: "user",
        content: text,
        token: selectedToken
      }
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
            token: selectedToken
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
          content: result.reply || "No response generated."
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
      busyRef.current = false;
      setLoading(false);
    }
  }

  function newChat() {
    if (busyRef.current) return;
    setMessages([]);
    setMessage("");
  }

  const suggestions = [
    {
      icon: "◎",
      label: "Market verdict",
      question: "Get market verdict"
    },
    {
      icon: "↗",
      label: "Market momentum",
      question: "Explain market momentum"
    },
    {
      icon: "◇",
      label: "Risk assessment",
      question: "Check potential risks"
    },
    {
      icon: "≋",
      label: "Trading activity",
      question: "Explain buying and selling activity"
    },
    {
      icon: "⌕",
      label: "Token analysis",
      question: "Analyze this token"
    }
  ];

  const empty = messages.length === 0;

  return (
    <div className="nexus-app">

      <style>{`
        .nexus-app {
          background: #0b1015;
          color: #e8eef7;
          border: 1px solid #202a33;
          border-radius: 22px;
          min-height: 76vh;
          display: flex;
          flex-direction: column;
          font-family: Inter, -apple-system,
            BlinkMacSystemFont, "Segoe UI",
            sans-serif;
          overflow: hidden;
          box-sizing: border-box;
        }

        .nexus-app * {
          box-sizing: border-box;
        }

        .nexus-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 26px;
          border-bottom: 1px solid #202a33;
        }

        .nexus-brand {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .nexus-brand-name {
          font-size: 21px;
          font-weight: 600;
          letter-spacing: -0.7px;
        }

        .nexus-subtitle {
          font-size: 10px;
          color: #83928f;
          letter-spacing: 1.6px;
          margin-top: 4px;
        }

        .nexus-new-chat {
          background: transparent;
          border: 1px solid #303c44;
          color: #dce3e8;
          padding: 10px 15px;
          border-radius: 10px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
        }

        .nexus-new-chat:hover {
          background: #19232b;
          border-color: #42e6a4;
        }

        .nexus-main {
          width: 100%;
          max-width: 850px;
          margin: auto;
          padding: 30px 24px 20px;
        }

        .nexus-welcome {
          text-align: center;
          padding: 55px 0 35px;
          animation: nexus-fade 0.6s ease;
        }

        .nexus-welcome h1 {
          font-family: Georgia, "Times New Roman",
            serif;
          font-weight: 400;
          font-size: clamp(30px, 5vw, 49px);
          letter-spacing: -1.8px;
          color: #f1f4f3;
          margin: 18px 0 12px;
          line-height: 1.15;
        }

        .nexus-welcome p {
          color: #8e9ba5;
          font-size: 15px;
          line-height: 1.7;
          margin: 0;
        }

        .nexus-token {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 14px;
          padding: 12px 15px;
          border: 1px solid #26343c;
          border-radius: 12px;
          background: #10171e;
        }

        .nexus-token label {
          color: #42e6a4;
          font-size: 11px;
          font-weight: 600;
          white-space: nowrap;
          letter-spacing: 1px;
        }

        .nexus-token input {
          width: 100%;
          min-width: 0;
          border: none;
          outline: none;
          color: #dce3e8;
          background: transparent;
          font-family: inherit;
          font-size: 13px;
        }

        .nexus-token:focus-within {
          border-color: #42e6a4;
        }

        .nexus-composer {
          background: #151d25;
          border: 1px solid #34434b;
          border-radius: 22px;
          padding: 17px;
          box-shadow: 0 12px 35px
            rgba(0, 0, 0, 0.16);
          transition: border-color 0.2s;
        }

        .nexus-composer:focus-within {
          border-color: #42e6a4;
        }

        .nexus-composer textarea {
          background: transparent;
          border: none;
          outline: none;
          color: #edf2f5;
          width: 100%;
          min-height: 65px;
          max-height: 180px;
          resize: vertical;
          font-family: inherit;
          font-size: 16px;
          line-height: 1.6;
        }

        .nexus-composer textarea::placeholder {
          color: #82909c;
        }

        .nexus-composer-bottom {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .nexus-model {
          color: #9aa7af;
          font-size: 12px;
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .nexus-online {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #42e6a4;
          box-shadow: 0 0 8px #42e6a4;
        }

        .nexus-send {
          border: none;
          border-radius: 12px;
          background: #42e6a4;
          color: #071a12;
          width: 42px;
          height: 42px;
          font-size: 23px;
          cursor: pointer;
          font-weight: 600;
        }

        .nexus-send:hover {
          background: #72f2bd;
        }

        .nexus-app button:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .nexus-suggestions {
          display: flex;
          justify-content: center;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 20px;
        }

        .nexus-suggestion {
          display: flex;
          align-items: center;
          gap: 8px;
          border: 1px solid #29353d;
          background: transparent;
          color: #b9c4cb;
          border-radius: 30px;
          padding: 10px 15px;
          font-family: inherit;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .nexus-suggestion:hover {
          color: #42e6a4;
          background: #14271f;
          border-color: #327858;
        }

        .nexus-suggestion-icon {
          color: #42e6a4;
          font-size: 17px;
        }

        .nexus-conversation {
          height: clamp(300px, 48vh, 560px);
          overflow-y: auto;
          padding: 12px 6px 25px;
          scrollbar-width: thin;
          scrollbar-color: #34443e transparent;
        }

        .nexus-user-row {
          display: flex;
          justify-content: flex-end;
          margin: 12px 0 30px;
        }

        .nexus-user-message {
          background: #1c2929;
          color: #e8eef7;
          border: 1px solid #2a3b37;
          border-radius: 19px 19px 5px 19px;
          padding: 14px 19px;
          max-width: 85%;
          font-size: 15px;
          line-height: 1.65;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
          animation: nexus-fade 0.25s ease;
        }

        .nexus-message-token {
          font-size: 10px;
          color: #8caaa0;
          margin-bottom: 6px;
          overflow-wrap: anywhere;
        }

        .nexus-ai-row {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          margin-bottom: 30px;
          animation: nexus-fade 0.35s ease;
        }

        .nexus-ai-avatar {
          flex-shrink: 0;
          padding-top: 2px;
        }

        .nexus-ai-message {
          min-width: 0;
          flex: 1;
          color: #dce3e8;
          font-size: 15px;
          line-height: 1.85;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        }

        .nexus-ai-name {
          font-size: 13px;
          font-weight: 600;
          color: #42e6a4;
          margin-bottom: 9px;
          letter-spacing: 0.5px;
        }

        .nexus-thinking {
          display: flex;
          align-items: center;
          gap: 5px;
          color: #8eaaa0;
          font-size: 13px;
          padding: 12px 0;
        }

        .nexus-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #42e6a4;
          animation: nexus-pulse 1.3s infinite;
        }

        .nexus-dot:nth-child(2) {
          animation-delay: 0.2s;
        }

        .nexus-dot:nth-child(3) {
          animation-delay: 0.4s;
        }

        .nexus-footer {
          text-align: center;
          color: #74828c;
          font-size: 11px;
          line-height: 1.6;
          padding: 20px 10px 6px;
        }

        .nexus-app button:focus-visible,
        .nexus-app textarea:focus-visible,
        .nexus-app input:focus-visible {
          outline: 2px solid #42e6a4;
          outline-offset: 3px;
        }

        @keyframes nexus-pulse {
          0%, 80%, 100% {
            opacity: 0.3;
            transform: translateY(0);
          }
          40% {
            opacity: 1;
            transform: translateY(-5px);
          }
        }

        @keyframes nexus-fade {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
.nexus-app {
  min-height: 55vh;
  border-radius: 18px;
}

.nexus-header {
  padding: 12px 20px;
}

.nexus-main {
  padding: 15px 20px 10px;
}

.nexus-welcome {
  padding: 18px 0 22px;
}

.nexus-welcome svg {
  width: 56px;
  height: 56px;
}

.nexus-welcome h1 {
  font-size: clamp(26px, 4vw, 38px);
  margin: 10px 0 8px;
}

.nexus-welcome p {
  font-size: 13px;
  line-height: 1.5;
}

.nexus-token {
  padding: 9px 12px;
  margin-bottom: 10px;
}

.nexus-composer {
  padding: 12px;
  border-radius: 16px;
}

.nexus-composer textarea {
  min-height: 42px;
  font-size: 14px;
}

.nexus-send {
  width: 34px;
  height: 34px;
}

.nexus-suggestions {
  margin-top: 12px;
  gap: 6px;
}

.nexus-suggestion {
  padding: 7px 12px;
}

.nexus-conversation {
  height: clamp(220px, 35vh, 400px);
}

.nexus-footer {
  padding: 12px 5px 0;
}
        @media (prefers-reduced-motion: reduce) {
          .nexus-app * {
            animation: none !important;
            transition: none !important;
          }
        }

        @media (max-width: 600px) {
          .nexus-header {
            padding: 15px;
          }

          .nexus-main {
            padding: 18px 14px;
          }

          .nexus-welcome {
            padding: 35px 0 28px;
          }

          .nexus-ai-message {
            font-size: 14px;
          }

          .nexus-ai-row {
            gap: 9px;
          }

          .nexus-suggestion {
            padding: 8px 11px;
            font-size: 11px;
          }
        }
      `}</style>

      <header className="nexus-header">
        <div className="nexus-brand">
          <NexusLogo size={36} />

          <div>
            <div className="nexus-brand-name">
              Nexus
            </div>

            <div className="nexus-subtitle">
              POWERED BY TRADEPILOT
            </div>
          </div>
        </div>

        <button
          className="nexus-new-chat"
          onClick={newChat}
          disabled={loading}
        >
          + New chat
        </button>
      </header>

      <main className="nexus-main">

        {empty ? (
          <div className="nexus-welcome">
            <NexusLogo size={82} />

            <h1>What moves the market?</h1>

            <p>
              Meet Nexus, your AI market research assistant.
              <br />
              Explore market data with a smarter perspective.
            </p>
          </div>
        ) : (
          <div
            className="nexus-conversation"
            role="log"
            aria-label="Nexus conversation"
          >
            {messages.map((item, index) =>
              item.role === "user" ? (
                <div
                  key={index}
                  className="nexus-user-row"
                >
                  <div className="nexus-user-message">
                    <div className="nexus-message-token">
                      TOKEN: {item.token}
                    </div>
                    {item.content}
                  </div>
                </div>
              ) : (
                <div
                  key={index}
                  className="nexus-ai-row"
                >
                  <div className="nexus-ai-avatar">
                    <NexusLogo size={32} />
                  </div>

                  <div className="nexus-ai-message">
                    <div className="nexus-ai-name">
                      Nexus
                    </div>

                    {formatResponse(item.content)}
                  </div>
                </div>
              )
            )}

            {loading && (
              <div className="nexus-ai-row">
                <div className="nexus-ai-avatar">
                  <NexusLogo size={32} />
                </div>

                <div className="nexus-thinking">
                  <span className="nexus-dot" />
                  <span className="nexus-dot" />
                  <span className="nexus-dot" />

                  <span style={{ marginLeft: 8 }}>
                    Analyzing market data
                  </span>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}

        <div className="nexus-token">
          <label htmlFor="nexus-token-input">
            TOKEN
          </label>

          <input
            id="nexus-token-input"
            value={token}
            onChange={e => setToken(e.target.value)}
            placeholder="Symbol or contract address"
            maxLength={100}
            disabled={loading}
          />
        </div>

        <form
          className="nexus-composer"
          onSubmit={e => {
            e.preventDefault();
            sendMessage(message);
          }}
        >
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Ask Nexus anything about the market..."
            aria-label="Message Nexus"
            maxLength={1000}
            onKeyDown={e => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                sendMessage(message);
              }
            }}
          />

          <div className="nexus-composer-bottom">
            <div className="nexus-model">
              <span className="nexus-online" />
              Nexus 1.0
            </div>

            <button
              className="nexus-send"
              type="submit"
              aria-label="Send message"
              disabled={
                loading ||
                !message.trim() ||
                !token.trim()
              }
            >
              ↑
            </button>
          </div>
        </form>

        <div className="nexus-suggestions">
          {suggestions.map(item => (
            <button
              key={item.label}
              className="nexus-suggestion"
              disabled={loading || !token.trim()}
              onClick={() => sendMessage(item.question)}
            >
              <span className="nexus-suggestion-icon">
                {item.icon}
              </span>

              {item.label}
            </button>
          ))}
        </div>

        <div className="nexus-footer">
          Nexus can make mistakes. Verify market information.
          <br />
          Educational research only.
        </div>

      </main>
    </div>
  );
}
