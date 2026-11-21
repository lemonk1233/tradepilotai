
import React, { useState } from "react";

const API = "https://api.dexscreener.com";

const theme = {
  background: "#080c12",
  panel: "#101822",
  border: "#243244",
  green: "#42e6a4",
  text: "#e8eef7",
  muted: "#94a3b8",
};

const buttonStyle = {
  padding: "14px 20px",
  background: "#174d3b",
  color: theme.green,
  border: "1px solid #42e6a4",
  borderRadius: 10,
  fontWeight: "bold",
  cursor: "pointer",
};

function money(value) {
  if (value == null || !Number.isFinite(Number(value))) {
    return "N/A";
  }

  return Number(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

function price(value) {
  if (value == null) return "N/A";

  const number = Number(value);
  if (!Number.isFinite(number)) return "N/A";
  if (number === 0) return "$0";
  if (number < 0.00000001) return "$" + number.toExponential(4);
  if (number < 1) return "$" + number.toFixed(10);

  return money(number);
}

function change(value) {
  if (value == null) return "N/A";
  const number = Number(value);
  return (number > 0 ? "+" : "") + number.toFixed(2) + "%";
}

function tokenAge(pair) {
  if (!pair.pairCreatedAt) return null;

  return Math.max(
    0,
    (Date.now() - pair.pairCreatedAt) / 86400000
  );
}

function formatAge(pair) {
  const age = tokenAge(pair);

  if (age === null) return "Unknown";
  if (age < 1) return Math.floor(age * 24) + " hours";
  return Math.floor(age) + " days";
}

function analyze(pair) {
  const warnings = [];

  const liquidity = Number(pair.liquidity?.usd || 0);
  const volume = Number(pair.volume?.h24 || 0);
  const volume1h = Number(pair.volume?.h1 || 0);
  const volume6h = Number(pair.volume?.h6 || 0);
  const age = tokenAge(pair);

  if (liquidity === 0) {
    warnings.push("Missing liquidity data");
  } else if (liquidity < 10000) {
    warnings.push("Low liquidity");
  }

  if (liquidity > 0 && volume / liquidity > 10) {
    warnings.push("Unusually high volume/liquidity ratio");
  }

  if (Math.abs(pair.priceChange?.h24 || 0) > 40) {
    warnings.push("High price volatility");
  }

  if (volume === 0) {
    warnings.push("No reported 24h volume");
  }

  const previousHourlyVolume = (volume6h - volume1h) / 5;

  if (
    previousHourlyVolume > 0 &&
    volume1h > previousHourlyVolume * 2
  ) {
    warnings.push("Recent volume spike");
  }

  if (age !== null && age < 1) {
    warnings.push("Very recently created trading pair");
  }

  if (warnings.length === 0) {
    warnings.push("No basic warnings detected. Risk remains.");
  }

  return warnings;
}

function momentum(pair) {
  const periods = [
    ["5m", pair.priceChange?.m5],
    ["1h", pair.priceChange?.h1],
    ["6h", pair.priceChange?.h6],
    ["24h", pair.priceChange?.h24],
  ];

  const available = periods.filter(
    ([name, value]) =>
      value != null && Number.isFinite(Number(value))
  );

  const positive = available.filter(
    ([name, value]) => Number(value) > 0
  ).length;

  const negative = available.filter(
    ([name, value]) => Number(value) < 0
  ).length;

  let label = "MIXED MOMENTUM";
  let color = "#fbbf24";

  if (available.length < 2) {
    label = "INSUFFICIENT DATA";
    color = theme.muted;
  } else if (positive === available.length) {
    label = "POSITIVE RECENT MOMENTUM";
    color = theme.green;
  } else if (negative === available.length) {
    label = "NEGATIVE RECENT MOMENTUM";
    color = "#ff647c";
  }

  return {
    label,
    color,
    coverage: available.length,
  
    up: available.length > 0
      ? Math.round((positive / available.length) * 100)
      : null,
  
    down: available.length > 0
      ? Math.round((negative / available.length) * 100)
      : null,
  
    flat: available.length > 0
      ? Math.round(
          ((available.length - positive - negative)
            / available.length) * 100
        )
      : null,
  };
}
export default function App() {
  const [query, setQuery] = useState("BONK");
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState("");
  const [mode, setMode] = useState("search");
  const [category, setCategory] = useState("all");

  async function scanTokens(event) {
    event.preventDefault();

    if (!query.trim()) return;

    setLoading(true);
    setError("");
    setTokens([]);
    setMode("search");
    setCategory("all");

    try {
      const response = await fetch(
        `${API}/latest/dex/search?q=${encodeURIComponent(query)}`
      );

      if (!response.ok) {
        throw new Error("Search unavailable");
      }

      const data = await response.json();

      const results = (data.pairs || [])
        .filter((pair) => pair.chainId === "solana")
        .sort(
          (a, b) =>
            (b.liquidity?.usd || 0) -
            (a.liquidity?.usd || 0)
        )
        .slice(0, 20);

      setTokens(results);
      setLastUpdated(new Date());

      if (!results.length) {
        setError("No matching Solana trading pairs.");
      }
    } catch (err) {
      setError("Unable to retrieve market data. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function discoverTokens() {
    setLoading(true);
    setError("");
    setTokens([]);
    setMode("discovery");
    setCategory("all");

    try {
      const response = await fetch(
        `${API}/token-profiles/latest/v1`
      );

      if (!response.ok) {
        throw new Error("Discovery unavailable");
      }

      const profiles = await response.json();

      const addresses = [
        ...new Set(
          profiles
            .filter((token) => token.chainId === "solana")
            .map((token) => token.tokenAddress)
            .filter(Boolean)
        ),
      ].slice(0, 30);

      if (!addresses.length) {
        throw new Error("No Solana profiles");
      }

      const marketResponse = await fetch(
        `${API}/tokens/v1/solana/${addresses.join(",")}`
      );

      if (!marketResponse.ok) {
        throw new Error("Market data unavailable");
      }

      const pairs = await marketResponse.json();

      const grouped = new Map();

      pairs.forEach((pair) => {
        const address = pair.baseToken?.address;

        if (!address || !addresses.includes(address)) return;

        const symbol = pair.baseToken?.symbol?.toUpperCase();

        if (["SOL", "WSOL", "USDC", "USDT"].includes(symbol)) {
          return;
        }

        const previous = grouped.get(address);

        if (
          !previous ||
          (pair.liquidity?.usd || 0) >
            (previous.liquidity?.usd || 0)
        ) {
          grouped.set(address, pair);
        }
      });

      const discovered = Array.from(grouped.values());

      discovered.sort(
        (a, b) =>
          (b.pairCreatedAt || 0) -
          (a.pairCreatedAt || 0)
      );

      setTokens(discovered);
      setLastUpdated(new Date());

      if (!discovered.length) {
        setError("No matching token profiles found.");
      }
    } catch (err) {
      console.error(err);
      setError("Discovery failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const visibleTokens = tokens.filter((pair) => {
    const age = tokenAge(pair);

    if (category === "new") {
      return age !== null && age < 7;
    }

    if (category === "older") {
      return age !== null && age >= 7;
    }

    return true;
  });

  return (
    <div
      style={{
        background: theme.background,
        color: theme.text,
        minHeight: "100vh",
        fontFamily: "Arial, sans-serif",
        padding: 24,
        boxSizing: "border-box",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "auto" }}>
        <div
          style={{
            color: theme.green,
            fontSize: 12,
            letterSpacing: 3,
          }}
        >
          SOLANA MARKET INTELLIGENCE
        </div>

       
<div
  style={{
    display: "flex",
    alignItems: "center",
    gap: 18,
    marginTop: 20,
    marginBottom: 15,
  }}
>
  <svg
    width="64"
    height="64"
    viewBox="0 0 64 64"
    style={{
      flexShrink: 0,
      filter: "drop-shadow(0 0 10px #42e6a433)",
    }}
  >
    <rect
      x="1"
      y="1"
      width="62"
      height="62"
      rx="15"
      fill="#0e231d"
      stroke="#42e6a4"
    />

    <path
      d="M13 18 H39 M26 18 V47 M35 36 L49 22 M39 22 H49 V32"
      stroke="#42e6a4"
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>

  <div>
    <h1 style={{ margin: 0, lineHeight: 1.1 }}>
      TRADEPILOT
      <span style={{ color: theme.green }}> AI</span>
    </h1>

    <div
      style={{
        color: "#81958e",
        fontSize: 11,
        letterSpacing: 4,
        marginTop: 8,
      }}
    >
      SOLANA / ANALYTICS
    </div>
  </div>
</div>


        <p style={{ color: theme.muted }}>
          Live market research, momentum and risk analysis.
        </p>

        <div
          style={{
            background: theme.panel,
            border: `1px solid ${theme.border}`,
            borderRadius: 14,
            padding: 20,
            marginTop: 25,
          }}
        >
          <form
            onSubmit={scanTokens}
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search token name or address"
              style={{
                flex: 1,
                minWidth: 150,
                padding: 14,
                background: "#080c12",
                color: "white",
                border: `1px solid ${theme.border}`,
                borderRadius: 10,
                fontSize: 16,
              }}
            />

            <button
              type="submit"
              disabled={loading}
              style={buttonStyle}
            >
              SCAN TOKEN
            </button>
          </form>

          <button
            onClick={discoverTokens}
            disabled={loading}
            style={{
              ...buttonStyle,
              width: "100%",
              marginTop: 15,
            }}
          >
            {loading
              ? "RETRIEVING MARKET DATA..."
              : "✦ AI TOKEN DISCOVERY"}
          </button>

          <p
            style={{
              fontSize: 12,
              color: theme.muted,
              marginBottom: 0,
            }}
          >
            Discovery uses recent DexScreener profiles.
            Profiles may be promotional.
          </p>
        </div>

        {loading && (
  <div
    role="status"
    style={{
      textAlign: "center",
      padding: 30,
      marginTop: 20,
      background: "#0a1119",
      border: "1px solid #243244",
      borderRadius: 18,
    }}
  >
    <div className="scanner-loader" />

    <div
      style={{
        color: "#42e6a4",
        fontSize: 13,
        letterSpacing: 4,
        fontWeight: 600,
      }}
    >
      SCANNING NETWORK
    </div>

    <p
      style={{
        color: "#94a3b8",
        fontSize: 12,
      }}
    >
      Retrieving market data...
    </p>
  </div>
)}

{lastUpdated && (
  <div
    style={{
      color: "#94a3b8",
      fontSize: 11,
      letterSpacing: 1,
      marginTop: 18,
      textAlign: "right",
    }}
  >
    <span style={{ color: "#42e6a4" }}>◷ </span>
    LAST UPDATED: {lastUpdated.toLocaleTimeString()}
  </div>
)}

        {error && (
          <p style={{ color: "#ff647c" }}>{error}</p>
        )}

        {tokens.length > 0 && (
          <div
            style={{
              background: theme.panel,
              border: `1px solid ${theme.border}`,
              padding: 20,
              borderRadius: 14,
              marginTop: 20,
            }}
          >
            <h3 style={{ color: theme.green, marginTop: 0 }}>
              ◈ MARKET INTELLIGENCE
            </h3>

            <p>Trading pairs found: {tokens.length}</p>

            <p>
              Recently created pairs:{" "}
              {
                tokens.filter((pair) => {
                  const age = tokenAge(pair);
                  return age !== null && age < 7;
                }).length
              }
            </p>

            <p style={{ color: theme.muted, fontSize: 13 }}>
              Momentum describes past price movements.
              It does not predict future returns.
            </p>
          </div>
        )}

        {mode === "discovery" && tokens.length > 0 && (
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              marginTop: 20,
            }}
          >
            {[
              ["all", "All Tokens"],
              ["new", "New Pairs"],
              ["older", "Older Pairs"],
            ].map(([value, label]) => (
              <button
                key={value}
                onClick={() => setCategory(value)}
                style={{
                  ...buttonStyle,
                  background:
                    category === value
                      ? "#174d3b"
                      : theme.panel,
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        <h2 style={{ marginTop: 30 }}>
          {mode === "discovery"
            ? "Discovered Tokens"
            : "Market Results"}
        </h2>

        {!loading && visibleTokens.length === 0 && (
          <p style={{ color: theme.muted }}>
            {tokens.length
              ? "No tokens in this category."
              : "Search a token or start token discovery."}
          </p>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
            gap: 16,
          }}
        >
          {visibleTokens.map((pair, index) => {
            const assessment = analyze(pair);
            const trend = momentum(pair);

            return (
              <div
                key={pair.pairAddress || index}
                style={{
                  background: theme.panel,
                  border: `1px solid ${theme.border}`,
                  borderRadius: 14,
                  padding: 20,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  {pair.info?.imageUrl && (
                    <img
                      src={pair.info.imageUrl}
                      alt=""
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: "50%",
                      }}
                    />
                  )}

                  <div>
                    <h3 style={{ margin: 0 }}>
                      {pair.baseToken?.name}
                    </h3>

                    <span style={{ color: theme.muted }}>
                      {pair.baseToken?.symbol} /{" "}
                      {pair.quoteToken?.symbol}
                    </span>
                  </div>
                </div>

                {mode === "search" && index === 0 && (
                  <p style={{ color: theme.green, fontSize: 12 }}>
                    ★ HIGHEST LIQUIDITY SEARCH RESULT
                  </p>
                )}

                <p style={{ color: theme.muted, fontSize: 12 }}>
                  Pair age: {formatAge(pair)}
                </p>

                <h2 style={{ fontSize: 27 }}>
                  {price(pair.priceUsd)}
                </h2>

                <div
                  style={{
                    background: "#080c12",
                    padding: 14,
                    borderRadius: 10,
                    marginBottom: 15,
                  }}
                >
                  <div
                    style={{
                      color: theme.muted,
                      fontSize: 11,
                      marginBottom: 10,
                    }}
                  >
                    MARKET MOMENTUM
                  </div>

                  <b style={{ color: trend.color }}>
                    {trend.label}
                  </b>

                  {trend.coverage > 0 && (
  <div style={{ marginTop: 18, marginBottom: 18 }}>
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 8,
        fontSize: 12,
      }}
    >
      <div style={{ color: "#42e6a4" }}>
        POSITIVE
        <div style={{ fontSize: 24, fontWeight: 700 }}>
          {trend.up}%
        </div>
      </div>

      <div style={{ color: "#94a3b8" }}>
        FLAT
        <div style={{ fontSize: 24, fontWeight: 700 }}>
          {trend.flat}%
        </div>
      </div>

      <div style={{ color: "#ff647c" }}>
        NEGATIVE
        <div style={{ fontSize: 24, fontWeight: 700 }}>
          {trend.down}%
        </div>
      </div>
    </div>

    <div
      style={{
        display: "flex",
        height: 10,
        borderRadius: 20,
        overflow: "hidden",
        background: "#243244",
        marginTop: 12,
      }}
    >
      <div style={{
        flex: trend.up,
        background: "#42e6a4",
      }} />

      <div style={{
        flex: trend.flat,
        background: "#94a3b8",
      }} />

      <div style={{
        flex: trend.down,
        background: "#ff647c",
      }} />
    </div>

    <p style={{
      fontSize: 10,
      color: "#94a3b8",
      marginTop: 8,
    }}>
      Historical price movement, not future probability.
    </p>
  </div>
)}

                  <p
                    style={{
                      fontSize: 12,
                      color: theme.muted,
                    }}
                  >
                    Data coverage: {trend.coverage}/4 periods
                  </p>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 10,
                    }}
                  >
                    {[
                      ["5m", pair.priceChange?.m5],
                      ["1h", pair.priceChange?.h1],
                      ["6h", pair.priceChange?.h6],
                      ["24h", pair.priceChange?.h24],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <span style={{ color: theme.muted }}>
                          {label}:{" "}
                        </span>

                        <b
                          style={{
                            color:
                              value == null
                                ? theme.muted
                                : value >= 0
                                ? theme.green
                                : "#ff647c",
                          }}
                        >
                          {change(value)}
                        </b>
                      </div>
                    ))}
                  </div>
                </div>

                <p>Liquidity: <b>{money(pair.liquidity?.usd)}</b></p>

                <p>Market cap: <b>{money(pair.marketCap)}</b></p>

                <p>5m volume: <b>{money(pair.volume?.m5)}</b></p>

                <p>1h volume: <b>{money(pair.volume?.h1)}</b></p>

                <p>6h volume: <b>{money(pair.volume?.h6)}</b></p>

                <p>24h volume: <b>{money(pair.volume?.h24)}</b></p>

                <div
                  style={{
                    borderTop: `1px solid ${theme.border}`,
                    paddingTop: 15,
                  }}
                >
                  <b style={{ color: "#fbbf24" }}>
                    RISK ANALYSIS
                  </b>

                  {assessment.map((warning, i) => (
                    <p
                      key={i}
                      style={{
                        color: "#fbbf24",
                        fontSize: 13,
                      }}
                    >
                      • {warning}
                    </p>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        
<footer
  style={{
    marginTop: 50,
    paddingTop: 24,
    borderTop: "1px solid #243244",
  }}
>
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 15,
    }}
  >
    <div>
      <strong style={{
        color: "#42e6a4",
        letterSpacing: 2,
      }}>
        ◈ TRADEPILOT AI
      </strong>

      <p style={{
        color: "#94a3b8",
        fontSize: 11,
      }}>
        SOLANA MARKET INTELLIGENCE
      </p>
    </div>

    <div style={{
      color: "#94a3b8",
      fontSize: 12,
    }}>
      VERSION 1.0
    </div>
  </div>

  <p style={{
    color: "#94a3b8",
    fontSize: 11,
    lineHeight: 1.8,
  }}>
    Data provided by DexScreener.
    <br />
    Educational market research.
    Historical performance does not predict future results.
  </p>
</footer>

      </div>
    </div>
  );
}
