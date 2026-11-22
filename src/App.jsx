
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

function rugPullRisk(pair) {
  const warnings = [];
  const liquidity = Number(pair.liquidity?.usd || 0);
  const volume = Number(pair.volume?.h24 || 0);
  const change = Number(pair.priceChange?.h24 || 0);
  const age = tokenAge(pair);

  if (!liquidity) {
    warnings.push("Liquidity data unavailable");
  } else if (liquidity < 10000) {
    warnings.push("Very low liquidity");
  }

  if (age !== null && age < 1) {
    warnings.push("Token pair created less than 24 hours ago");
  }

  if (liquidity > 0 && volume / liquidity > 10) {
    warnings.push("Unusually high volume relative to liquidity");
  }

  if (Math.abs(change) > 50) {
    warnings.push("Extreme price volatility");
  }

  if (volume === 0) {
    warnings.push("No recorded 24-hour trading volume");
  }

  return warnings;
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



function MarketOutlook({ pair }) {
  const changes = ["m5", "h1", "h6", "h24"]
    .map(key => pair.priceChange?.[key])
    .filter(v => v != null && Number.isFinite(Number(v)))
    .map(Number);

  const up = changes.filter(v => v > 0).length;
  const down = changes.filter(v => v < 0).length;
  const flat = changes.filter(v => v === 0).length;
  const total = changes.length;

  const direction = total === 0
    ? "NO DATA"
    : up > down
    ? "UPWARD"
    : down > up
    ? "DOWNWARD"
    : "MIXED";

  const color = direction === "UPWARD"
    ? "#42e6a4"
    : direction === "DOWNWARD"
    ? "#ff647c"
    : "#94a3b8";

  const upPercent = total ? Math.round(up / total * 100) : 0;
  const downPercent = total ? Math.round(down / total * 100) : 0;
  const flatPercent = total ? Math.round(flat / total * 100) : 0;

  return (
    <div style={{
      background: "#080c12",
      border: "1px solid #243244",
      borderRadius: 12,
      padding: 20,
      marginTop: 20,
      marginBottom: 20
    }}>
      <div style={{
        color: "#42e6a4",
        fontSize: 12,
        fontWeight: "bold",
        letterSpacing: 2
      }}>
        MARKET OUTLOOK
      </div>

      <p style={{
        color: "#94a3b8",
        fontSize: 11
      }}>
        OBSERVED HISTORICAL DIRECTION
      </p>

      <h2 style={{
        color,
        fontSize: 30,
        margin: "10px 0"
      }}>
        {direction === "UPWARD" ? "↗ " :
         direction === "DOWNWARD" ? "↘ " : "→ "}
        {direction}
      </h2>

      <div style={{
        display: "flex",
        justifyContent: "space-between",
        marginTop: 20
      }}>
        <div style={{ color: "#42e6a4" }}>
          <small>RISING</small>
          <h2>{upPercent}%</h2>
        </div>

        <div style={{ color: "#94a3b8" }}>
          <small>FLAT</small>
          <h2>{flatPercent}%</h2>
        </div>

        <div style={{ color: "#ff647c" }}>
          <small>FALLING</small>
          <h2>{downPercent}%</h2>
        </div>
      </div>

      <div style={{
        display: "flex",
        height: 9,
        borderRadius: 10,
        overflow: "hidden",
        background: "#243244"
      }}>
        <div style={{
          flex: up,
          background: "#42e6a4"
        }} />
        <div style={{
          flex: flat,
          background: "#94a3b8"
        }} />
        <div style={{
          flex: down,
          background: "#ff647c"
        }} />
      </div>

      <p style={{
        color: "#94a3b8",
        fontSize: 11
      }}>
        Historical timeframe agreement: {total}/4 available.
        These are not future probabilities.
      </p>

      <hr style={{
        border: 0,
        borderTop: "1px solid #243244",
        margin: "20px 0"
      }} />

      <small style={{ color: "#94a3b8" }}>
        NEXT HOUR OUTLOOK
      </small>

      <h3 style={{ color: "#94a3b8" }}>
        UNCERTAIN
      </h3>

      <svg viewBox="0 0 320 145" width="100%">
        {[20, 60, 100].map(y => (
          <line
            key={y}
            x1="10"
            x2="310"
            y1={y}
            y2={y}
            stroke="#243244"
            strokeDasharray="4 4"
          />
        ))}

        <path
          d="M10 65 L60 55 L110 40 L160 48 L210 22 L310 10"
          stroke="#42e6a4"
          strokeWidth="2.5"
          strokeDasharray="5 4"
          fill="none"
        />

        <path
          d="M10 65 L60 80 L110 75 L160 100 L210 90 L310 120"
          stroke="#ff647c"
          strokeWidth="2.5"
          strokeDasharray="5 4"
          fill="none"
        />

        <path
          d="M10 65 L60 60 L110 70 L160 60 L210 70 L310 65"
          stroke="#94a3b8"
          strokeWidth="2"
          strokeDasharray="5 4"
          fill="none"
        />

        <text x="10" y="140" fill="#94a3b8" fontSize="10">
          Now
        </text>

        <text x="310" y="140" fill="#94a3b8"
          fontSize="10" textAnchor="end">
          +1 Hour
        </text>
      </svg>

      <p style={{
        color: "#94a3b8",
        fontSize: 10
      }}>
        Illustrative future scenarios, not price predictions.
      </p>
    </div>
  );
}

function RugPullDetector({ pair }) {
  const warnings = rugPullRisk(pair);

  return (
    <div style={{
      background: "#101822",
      border: "1px solid #243244",
      borderRadius: 12,
      padding: 16,
      marginBottom: 20
    }}>
      <h3 style={{ color: "#ffb454", fontSize: 14 }}>
        RUG PULL RISK DETECTOR
      </h3>

      <h2 style={{ color: "#ffb454" }}>
        {warnings.length} Warning Signs
      </h2>

      {warnings.length === 0 && (
        <p>No warning signs detected by basic checks.</p>
      )}

      {warnings.map((warning, i) => (
        <p key={i} style={{ color: "#ff647c", fontSize: 13 }}>
          ⚠ {warning}
        </p>
      ))}

      <p style={{ color: "#94a3b8", fontSize: 12 }}>
        Mint authority: Unverified
      </p>

      <p style={{ color: "#94a3b8", fontSize: 12 }}>
        Holder concentration: Unverified
      </p>

      <p style={{ color: "#94a3b8", fontSize: 12 }}>
        Liquidity lock: Unverified
      </p>

      <p style={{ color: "#94a3b8", fontSize: 10 }}>
        Basic warning checks only. Cannot confirm
        whether a token is safe or a scam.
      </p>
    </div>
  );
}
function TokenChart({ pair }) {
  const [expanded, setExpanded] = useState(false);
  const [points, setPoints] = useState([]);
  const [busy, setBusy] = useState(false);
  const [chartError, setChartError] = useState("");
  const [period, setPeriod] = useState("hour");

  async function loadChart(timeframe) {
    setExpanded(true);
    setPeriod(timeframe);
    setBusy(true);
    setChartError("");
    setPoints([]);

    try {
      const response = await fetch(
        `https://api.geckoterminal.com/api/v2/networks/solana/pools/${encodeURIComponent(pair.pairAddress)}/ohlcv/${timeframe}?aggregate=${timeframe === "minute" ? 5 : 1}&limit=48&currency=usd`
      );

      if (!response.ok) {
        throw new Error("Chart unavailable");
      }

      const data = await response.json();

      const candles =
        data.data?.attributes?.ohlcv_list || [];

      const values = candles
        .filter(c => Number.isFinite(Number(c[4])))
        .sort((a, b) => a[0] - b[0])
        .map(c => ({
          time: Number(c[0]),
          open: Number(c[1]),
          high: Number(c[2]),
          low: Number(c[3]),
          close: Number(c[4])
        }));

      if (values.length < 2) {
        throw new Error("Not enough historical data");
      }

      setPoints(values);
    } catch (err) {
      setChartError("Chart error: " + err.message);
    } finally {
      setBusy(false);
    }
  }

 
  const min = Math.min(...points.map(c => c.low));
  const max = Math.max(...points.map(c => c.high));
  const range = max - min || 1;
  
  const candleWidth = 145 / Math.max(points.length, 1);
  const risingCandles = points.filter(
    c => c.close > c.open
  ).length;
  
  const fallingCandles = points.filter(
    c => c.close < c.open
  ).length;
  
  const risingPercent = points.length
    ? Math.round(risingCandles / points.length * 100)
    : 0;
  
  const fallingPercent = points.length
    ? Math.round(fallingCandles / points.length * 100)
    : 0;
  
  const getY = (value) =>
    150 - ((value - min) / range) * 130;


  return (
    <div style={{ marginBottom: 20 }}>
      <button
        disabled={busy}
        onClick={() =>
          expanded ? setExpanded(false) : loadChart(period)
        }
        style={{ ...buttonStyle, width: "100%" }}
      >
        {expanded ? "HIDE PRICE CHART" : "VIEW PRICE CHART"}
      </button>

      {expanded && (
        <div style={{
          background: "#080c12",
          border: "1px solid #243244",
          borderRadius: 12,
          padding: 15,
          marginTop: 12
        }}>
          <div style={{
            display: "flex",
            gap: 8,
            marginBottom: 15
          }}>
            {[
              ["minute", "4H"],
              ["hour", "2D"],
              ["day", "48D"]
            ].map(([value, label]) => (
              <button
                key={value}
                disabled={busy}
                onClick={() => loadChart(value)}
                style={{
                  ...buttonStyle,
                  flex: 1,
                  padding: 8,
                  background: period === value
                    ? "#174d3b"
                    : "#101822"
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {busy && <p>Loading historical prices...</p>}

          {chartError && (
            <p style={{ color: "#ff647c" }}>
              {chartError}
            </p>
          )}

          {points.length > 1 && (
            <svg viewBox="0 0 320 175" width="100%">
              {[20, 65, 110, 155].map(y => (
                <line
                  key={y}
                  x1="10"
                  y1={y}
                  x2="310"
                  y2={y}
                  stroke="#243244"
                  strokeDasharray="4 4"
                />
              ))}
             
{points.map((c, i) => {
  const x = 15 + i * candleWidth;
  const color = c.close >= c.open
    ? "#42e6a4"
    : "#ff647c";

  return (
    <g key={c.time}>
      <line
        x1={x}
        x2={x}
        y1={getY(c.high)}
        y2={getY(c.low)}
        stroke={color}
        strokeWidth="1.2"
      />
      <rect
        x={x - candleWidth * 0.35}
        y={Math.min(getY(c.open), getY(c.close))}
        width={candleWidth * 0.7}
        height={Math.max(
          Math.abs(getY(c.open) - getY(c.close)),
          1
        )}
        fill={color}
        rx="0.5"
      />
    </g>
  );
})}

<line
  x1="160"
  x2="160"
  y1="5"
  y2="155"
  stroke="#64748b"
  strokeDasharray="4 4"
/>

<path
  d="M160 85 L185 70 L210 78 L235 48 L260 55 L285 30 L310 15"
  stroke="#42e6a4"
  strokeWidth="2"
  strokeDasharray="4 3"
  fill="none"
/>

<path
  d="M160 85 L185 100 L210 92 L235 120 L260 112 L285 138 L310 150"
  stroke="#ff647c"
  strokeWidth="2"
  strokeDasharray="4 3"
  fill="none"
/>

<text x="235" y="18" fill="#42e6a4"
  fontSize="16" fontWeight="bold">
  {risingPercent}%
</text>
<text x="235" y="30" fill="#42e6a4" fontSize="9">
  Historical rises
</text>
<text x="225" y="165" fill="#ff647c" fontSize="11">
{fallingPercent}% past falls
</text>

<text x="160" y="170" fill="#94a3b8"
  fontSize="9" textAnchor="middle">
  Hypothetical
</text>

            </svg>
          )}

          <p style={{
            color: "#94a3b8",
            fontSize: 10
          }}>
            Historical closing prices in USD.
            Source: GeckoTerminal.
          </p>
        </div>
      )}
    </div>
  );
}


export default function App() {
  const [activePage, setActivePage] = useState("scanner");
  const [virtualBalance, setVirtualBalance] = useState(() => {
    const saved = localStorage.getItem("tradepilotBalance");
    return saved === null ? 1000 : Number(saved);
  });
  
  const [refillAmount, setRefillAmount] = useState("1000");
  const [portfolioQuery, setPortfolioQuery] = useState("BONK");
const [portfolioTokens, setPortfolioTokens] = useState([]);
const [portfolioLoading, setPortfolioLoading] = useState(false);
const [portfolioError, setPortfolioError] = useState("");
async function refreshHoldings() {
  const updatedHoldings = await Promise.all(
    holdings.map(async holding => {
      try {
        const response = await fetch(
          `https://api.dexscreener.com/latest/dex/pairs/solana/${holding.pairAddress}`
        );

        if (!response.ok) return holding;

        const data = await response.json();
        const currentPrice = Number(data.pairs?.[0]?.priceUsd);

        if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
          return holding;
        }

        const currentValue = holding.quantity * currentPrice;

        return {
          ...holding,
          currentPrice,
          currentValue,
          profitLoss: currentValue - holding.invested,
          profitPercent:
            ((currentValue - holding.invested) /
              holding.invested) * 100
        };
      } catch {
        return holding;
      }
    })
  );

  saveHoldings(updatedHoldings);
  setPortfolioUpdated(new Date());
}

function virtualSell(index) {
  const holding = holdings[index];

  if (!holding) return;

  if (!Number.isFinite(holding.currentValue)) {
    alert("Refresh portfolio prices first.");
    return;
  }

  const sellValue = holding.currentValue;

  const newBalance = virtualBalance + sellValue;

  setVirtualBalance(newBalance);

  localStorage.setItem(
    "tradepilotBalance",
    String(newBalance)
  );

  const remainingHoldings = holdings.filter(
    (_, i) => i !== index
  );

  saveHoldings(remainingHoldings);
  addTransaction({
    type: "SELL",
    symbol: holding.symbol,
    amount: sellValue,
    price: holding.currentPrice
  });
}
function virtualBuy(pair) {
  const amount = Number(
    prompt("Enter an amount in virtual USD:")
  );

  const tokenPrice = Number(pair.priceUsd);

  if (!Number.isFinite(amount) || amount <= 0) {
    return;
  }

  if (amount > virtualBalance) {
    alert("Not enough virtual cash.");
    return;
  }

  if (!Number.isFinite(tokenPrice) || tokenPrice <= 0) {
    alert("Price unavailable.");
    return;
  }

  const newHolding = {
    name: pair.baseToken.name,
    symbol: pair.baseToken.symbol,
    address: pair.baseToken.address,
    pairAddress: pair.pairAddress,
    quantity: amount / tokenPrice,
    entryPrice: tokenPrice,
    invested: amount
  };

  const newBalance = virtualBalance - amount;

  setVirtualBalance(newBalance);

  localStorage.setItem(
    "tradepilotBalance",
    String(newBalance)
  );

  saveHoldings([...holdings, newHolding]);
  addTransaction({
    type: "BUY",
    symbol: pair.baseToken.symbol,
    amount: amount,
    price: tokenPrice
  });
}
async function searchPortfolioTokens() {
  if (!portfolioQuery.trim()) return;

  setPortfolioLoading(true);
  setPortfolioError("");
  setPortfolioTokens([]);

  try {
    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(portfolioQuery)}`
    );

    if (!response.ok) {
      throw new Error("Market data unavailable");
    }

    const data = await response.json();

    const results = (data.pairs || [])
      .filter(pair => pair.chainId === "solana")
      .filter(pair => Number(pair.priceUsd) > 0)
      .slice(0, 20);

    setPortfolioTokens(results);

    if (results.length === 0) {
      setPortfolioError("No matching tokens found.");
    }
  } catch (err) {
    setPortfolioError(err.message);
  } finally {
    setPortfolioLoading(false);
  }
}
  const [holdings, setHoldings] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem("tradepilotHoldings") || "[]"
      );
    } catch {
      return [];
    }
  });
  React.useEffect(() => {
    if (activePage !== "portfolio" || holdings.length === 0) {
      return;
    }
  
    const interval = setInterval(() => {
      refreshHoldings();
    }, 60000);
  
    return () => clearInterval(interval);
  }, [activePage, holdings]);
  const [portfolioUpdated, setPortfolioUpdated] = useState(null);
  const [transactions, setTransactions] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem("tradepilotTransactions") || "[]"
      );
    } catch {
      return [];
    }
  });
  
  function addTransaction(transaction) {
    setTransactions(previous => {
      const updated = [
        {
          ...transaction,
          date: new Date().toISOString()
        },
        ...previous
      ];
  
      localStorage.setItem(
        "tradepilotTransactions",
        JSON.stringify(updated)
      );
  
      return updated;
    });
  }
  function saveHoldings(newHoldings) {
    setHoldings(newHoldings);
  
    localStorage.setItem(
      "tradepilotHoldings",
      JSON.stringify(newHoldings)
    );
  }
  
  function refillBalance() {
    const amount = Number(refillAmount);
  
    if (!Number.isFinite(amount) || amount < 1 || amount > 100000) {
      alert("Enter an amount between $1 and $100,000.");
      return;
    }
  
    const newBalance = virtualBalance + amount;
  
    setVirtualBalance(newBalance);
  
    localStorage.setItem(
      "tradepilotBalance",
      String(newBalance)
    );
  
    setRefillAmount("");
  }
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
<div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
  <button
    style={{
      ...buttonStyle,
      flex: 1,
      background: activePage === "scanner"
        ? "#174d3b" : "#101822"
    }}
    onClick={() => setActivePage("scanner")}
  >
    MARKET SCANNER
  </button>

  <button
    style={{
      ...buttonStyle,
      flex: 1,
      background: activePage === "portfolio"
        ? "#174d3b" : "#101822"
    }}
    onClick={() => setActivePage("portfolio")}
  >
    VIRTUAL PORTFOLIO
  </button>
</div>
<div style={{
  display: activePage === "scanner" ? "block" : "none"
}}>
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

                <TokenChart pair={pair} />
<MarketOutlook pair={pair} />
<RugPullDetector pair={pair} />
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

        </div>               
        {activePage === "portfolio" && (

<div style={{
    background: "#101822",
    border: "1px solid #243244",
    borderRadius: 16,
    padding: 24,
    marginBottom: 24
  }}>
    <h2 style={{ color: "#42e6a4" }}>
      VIRTUAL PORTFOLIO
    </h2>

    <p style={{ color: "#94a3b8" }}>
      AVAILABLE VIRTUAL CASH
    </p>
    <div style={{
  background: "#080c12",
  border: "1px solid #243244",
  borderRadius: 12,
  padding: 18,
  marginBottom: 20
}}>
  <p style={{ color: "#94a3b8" }}>
    TOTAL VIRTUAL PORTFOLIO VALUE
  </p>

  <h2 style={{ fontSize: 32 }}>
    {(virtualBalance + holdings.reduce(
      (total, holding) =>
        total + (holding.currentValue ?? holding.invested),
      0
    )).toLocaleString("en-US", {
      style: "currency",
      currency: "USD"
    })}
  </h2>

  <p style={{ color: "#94a3b8" }}>
    Virtual holdings: {holdings.length}
  </p>
</div>

    <h1 style={{ color: "#42e6a4", fontSize: 42 }}>
      {virtualBalance.toLocaleString("en-US", {
        style: "currency",
        currency: "USD"
      })}
    </h1>

    <input
      type="number"
      min="1"
      max="100000"
      value={refillAmount}
      onChange={e => setRefillAmount(e.target.value)}
      placeholder="Enter refill amount"
      style={{
        background: "#080c12",
        color: "#e8eef7",
        border: "1px solid #243244",
        borderRadius: 8,
        padding: 14,
        marginRight: 10
      }}
    />

    <button
      style={buttonStyle}
      onClick={refillBalance}
    >
      + REFILL BALANCE
    </button>

    <p style={{ color: "#94a3b8", fontSize: 12 }}>
      Add $1 to $100,000 in virtual USD per refill.
      No real money involved.
    </p>
    <hr style={{
  border: "none",
  borderTop: "1px solid #243244",
  margin: "25px 0"
}} />

<h2 style={{ color: "#42e6a4" }}>
  YOUR VIRTUAL HOLDINGS
</h2>
<details style={{
  background: "#080c12",
  border: "1px solid #243244",
  borderRadius: 12,
  padding: 16,
  marginBottom: 20
}}>
  <summary style={{
    color: "#42e6a4",
    cursor: "pointer",
    fontWeight: "bold"
  }}>
    VIRTUAL TRANSACTION HISTORY
  </summary>

  {transactions.length === 0 && (
    <p>No simulated transactions yet.</p>
  )}

  {transactions.map((transaction, i) => (
    <div key={i} style={{
      borderBottom: "1px solid #243244",
      padding: "12px 0"
    }}>
      <strong>{transaction.type} {transaction.symbol}</strong>

      <p>${transaction.amount.toFixed(2)} virtual USD</p>

      <small style={{ color: "#94a3b8" }}>
        {new Date(transaction.date).toLocaleString()}
      </small>
    </div>
  ))}
</details>
<button
  onClick={refreshHoldings}
  style={{
    ...buttonStyle,
    width: "100%",
    marginBottom: 20
  }}
>
  REFRESH PORTFOLIO PRICES
</button>
<p style={{
  color: "#94a3b8",
  fontSize: 12,
  textAlign: "center",
  marginBottom: 20
}}>
  {portfolioUpdated
    ? "Last refresh: " + portfolioUpdated.toLocaleTimeString()
    : "Prices not refreshed yet"}
</p>

<p style={{
  color: "#94a3b8",
  fontSize: 12
}}>
  Simulated values based on reported market
  prices, excluding fees and slippage.
</p>
<h3 style={{ color: "#42e6a4", marginTop: 24 }}>
  EXPLORE SOLANA TOKENS
</h3>

<div style={{
  display: "flex",
  gap: 10,
  marginBottom: 20
}}>
  <input
    value={portfolioQuery}
    onChange={e => setPortfolioQuery(e.target.value)}
    placeholder="Search tokens..."
    style={{
      flex: 1,
      minWidth: 0,
      background: "#080c12",
      color: "#e8eef7",
      border: "1px solid #243244",
      borderRadius: 8,
      padding: 14
    }}
  />

  <button
    style={buttonStyle}
    onClick={searchPortfolioTokens}
    disabled={portfolioLoading}
  >
    {portfolioLoading ? "LOADING..." : "SEARCH"}
  </button>
</div>

{portfolioError && (
  <p style={{ color: "#ff647c" }}>
    {portfolioError}
  </p>
)}

{portfolioTokens.map(pair => (
  <div key={pair.pairAddress} style={{
    background: "#080c12",
    border: "1px solid #243244",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12
  }}>
    <h3>{pair.baseToken.name}</h3>
    <p>{pair.baseToken.symbol}</p>
    <h2>{price(pair.priceUsd)}</h2>
    <TokenChart pair={pair} />
    <button
  onClick={() => virtualBuy(pair)}
  style={{
    ...buttonStyle,
    width: "100%",
    marginTop: 10
  }}
>
  BUY WITH VIRTUAL CASH
</button>

<p style={{
  color: "#94a3b8",
  fontSize: 12
}}>
  Simulation only — no real transactions.
</p>
  </div>
))}
{holdings.length === 0 ? (
  <p style={{ color: "#94a3b8" }}>
    No simulated holdings yet.
  </p>
) : (
  holdings.map((holding, i) => (
    <div key={i} style={{
      background: "#080c12",
      border: "1px solid #243244",
      borderRadius: 12,
      padding: 16,
      marginBottom: 12
    }}>
      <h3>{holding.name}</h3>
      <p>Token: {holding.symbol}</p>
      <p>Virtual quantity: {holding.quantity}</p>
      <p>
  Original value: ${holding.invested.toFixed(2)}
</p>

<p>
  Updated value: ${
    (holding.currentValue ?? holding.invested).toFixed(2)
  }
</p>

<h3 style={{
  color: holding.profitLoss == null
    ? "#94a3b8"
    : holding.profitLoss >= 0
      ? "#42e6a4"
      : "#ff647c"
}}>
  {holding.profitLoss == null
    ? "Not refreshed yet"
    : `$${holding.profitLoss.toFixed(2)} (${holding.profitPercent.toFixed(2)}%)`}
</h3>
<button
  onClick={() => virtualSell(i)}
  style={{
    ...buttonStyle,
    background: "#3d1720",
    color: "#ff647c",
    border: "1px solid #ff647c",
    width: "100%",
    marginTop: 10
  }}
>
  SELL VIRTUAL HOLDING
</button>
    </div>
  ))
)}
  </div>
)}
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
