
import React, { useState } from "react";
import { supabase } from "./supabase";
import Login from "./Login";
import Admin from "./Admin";
import AccessGate from "./AccessGate";
import ResearchAssistant from "./ResearchAssistant";
import { loadPortfolio, savePortfolio } from "./portfolio";

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

    <p style={{
  color: "#94a3b8",
  fontSize: 12,
  lineHeight: 1.6
}}>
  Future price direction is uncertain.
  This analysis reflects historical market activity only.
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
  const [period, setPeriod] = useState("minute");
  const [indicator, setIndicator] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);
  const [updated, setUpdated] = useState(null);

  const green = "#42e6a4";
  const red = "#ff647c";
  const muted = "#94a3b8";
async function fetchChartWithRetry(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url);

      if (response.ok) return response;

      if (response.status !== 429 && response.status < 500) {
        return response;
      }

      throw new Error("Market data temporarily unavailable");
    } catch (error) {
      if (attempt === 2) throw error;

      await new Promise(resolve =>
        setTimeout(resolve, 3000 * (attempt + 1))
      );
    }
  }
}
  async function loadChart(timeframe) {
    setExpanded(true);
    setPeriod(timeframe);
    setBusy(true);
    setChartError("");
    setPoints([]);

    try {
      const response = await fetchChartWithRetry(
        `https://api.geckoterminal.com/api/v2/networks/solana/pools/${encodeURIComponent(pair.pairAddress)}/ohlcv/${timeframe}?aggregate=${timeframe === "minute" ? 5 : 1}&limit=48&currency=usd&token=${encodeURIComponent(pair.baseToken.address)}`
      );

      if (!response.ok) {
        throw new Error("Chart unavailable");
      }

      const data = await response.json();
      const candles = data.data?.attributes?.ohlcv_list || [];

      const values = candles
        .map(c => ({
          time: Number(c[0]),
          open: Number(c[1]),
          high: Number(c[2]),
          low: Number(c[3]),
          close: Number(c[4])
        }))
        .filter(c =>
          Object.values(c).every(Number.isFinite) &&
          c.low > 0 &&
          c.high >= Math.max(c.open, c.close) &&
          c.low <= Math.min(c.open, c.close)
        )
        .sort((a, b) => a.time - b.time);

      if (values.length < 2) {
        throw new Error("Not enough historical data");
      }

      setPoints(values);
      setUpdated(new Date());
    } catch (err) {
      setChartError("Chart error: " + err.message);
    } finally {
      setBusy(false);
    }
  }

  function ema(values, length) {
    const k = 2 / (length + 1);
    return values.reduce(
      (previous, current) =>
        current * k + previous * (1 - k),
      values[0]
    );
  }

  function calculateSetup() {
    const seconds = period === "minute"
      ? 300
      : period === "hour" ? 3600 : 86400;

    const closed = points.filter(
      c => c.time + seconds <= Date.now() / 1000
    );

    if (closed.length < 25) return null;

    const closes = closed.map(c => c.close);
    const current = closes[closes.length - 1];

    const fast = ema(closes, 9);
    const slow = ema(closes, 21);

    const ranges = closed.slice(1).map((c, i) =>
      Math.max(
        c.high - c.low,
        Math.abs(c.high - closed[i].close),
        Math.abs(c.low - closed[i].close)
      )
    ).slice(-14);

    const atr = ranges.reduce((a, b) => a + b, 0)
      / ranges.length;

    if (!Number.isFinite(atr) || atr <= 0) return null;

    const bullish = fast > slow && current > fast;
    const bearish = fast < slow && current < fast;

    const direction = bullish
      ? "BULLISH"
      : bearish ? "BEARISH" : "NEUTRAL";

    const entryLow = current - atr * 0.5;
    const entryHigh = current - atr * 0.2;
    const target = current + atr * 1.5;
    const stop = current - atr * 1.2;

    const latest = closed[closed.length - 1];

    const fresh =
      Date.now() / 1000 - latest.time < seconds * 3;

    const validSetup =
      bullish &&
      fresh &&
      stop > 0 &&
      Number(pair.liquidity?.usd || 0) >= 10000;

    return {
      direction,
      current,
      atr,
      fast,
      slow,
      entryLow,
      entryHigh,
      target,
      stop,
      validSetup,
      fresh,
      time: latest.time + seconds,
      horizon: seconds * 6,
      scenario: bullish
        ? target
        : bearish
          ? Math.max(current - atr * 1.5, 0)
          : current
    };
  }

  const setup = calculateSetup();
  const showProjection = indicator && !!setup;
const showLevels = showProjection && setup.stop > 0;

  const historyEnd = showProjection ? 340 : 470;
  const candleWidth = (historyEnd - 20) /
    Math.max(points.length, 1);

  const chartValues = points.flatMap(
    c => [c.high, c.low]
  );

  if (showProjection) {
    chartValues.push(setup.scenario);
  }

  if (showLevels) {
    chartValues.push(
      setup.target,
      setup.stop,
      setup.entryLow,
      setup.entryHigh
    );
  }

  const rawMin = points.length
    ? Math.min(...chartValues) : 0;

  const rawMax = points.length
    ? Math.max(...chartValues) : 1;

  const padding = (rawMax - rawMin || rawMax * 0.01 || 1)
    * 0.12;

  const min = rawMin - padding;
  const max = rawMax + padding;

  const getY = value =>
    230 - ((value - min) / (max - min || 1)) * 205;

  const formatPrice = value =>
    "$" + Number(value).toPrecision(5);

  const outlookColor = setup?.direction === "BULLISH"
    ? green
    : setup?.direction === "BEARISH"
      ? red
      : muted;

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
  padding: fullScreen ? 24 : 12,
  marginTop: fullScreen ? 0 : 12,
  position: fullScreen ? "fixed" : "relative",
  inset: fullScreen ? 0 : "auto",
  zIndex: fullScreen ? 9999 : "auto",
  overflowY: fullScreen ? "auto" : "visible"
}}>

  <button
    onClick={() => setFullScreen(!fullScreen)}
    style={{
      ...buttonStyle,
      width: "100%",
      marginBottom: 12
    }}
  >
    {fullScreen
      ? "✕ CLOSE FULL SCREEN"
      : "⛶ EXPAND CHART"}
  </button>
        <div style={{
          background: "#080c12",
          border: "1px solid #243244",
          borderRadius: 12,
          padding: 12,
          marginTop: 12
        }}>

          <button
            onClick={() => setIndicator(!indicator)}
            aria-pressed={indicator}
            style={{
              ...buttonStyle,
              width: "100%",
              marginBottom: 12,
              background: indicator ? "#174d3b" : "#101822",
              boxShadow: indicator
                ? "0 0 15px #42e6a422" : "none"
            }}
          >
            ✦ NEXUS AI INDICATOR {indicator ? "ON" : "OFF"}
          </button>

          <div style={{
            display: "flex",
            gap: 6,
            marginBottom: 12
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
                    ? "#174d3b" : "#101822"
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {busy && <p>Loading market data...</p>}

          {chartError && (
            <p style={{ color: red }}>{chartError}</p>
          )}

          {indicator && setup && (
            <div style={{
              border: "1px solid #243244",
              borderRadius: 10,
              padding: 12,
              marginBottom: 12
            }}>
              <div style={{
                color: green,
                fontSize: 10,
                letterSpacing: 2
              }}>
                NEXUS INTELLIGENCE • BETA
              </div>

              <h2 style={{
                color: outlookColor,
                margin: "8px 0"
              }}>
                {setup.direction === "BULLISH" ? "↗ " :
                 setup.direction === "BEARISH" ? "↘ " : "→ "}
                {setup.direction}
              </h2>

              <small style={{ color: muted }}>
                Historical EMA momentum analysis
              </small>
            </div>
          )}

          {points.length > 1 && (
            <svg viewBox="0 0 500 265" width="100%">

              {Array.from({ length: 5 }, (_, i) => {
                const value = min + (max - min) * i / 4;
                return (
                  <g key={i}>
                    <line
                      x1="10"
                      x2="490"
                      y1={getY(value)}
                      y2={getY(value)}
                      stroke="#243244"
                      strokeDasharray="4 4"
                    />
                  </g>
                );
              })}

              {showProjection && (
                <rect
                  x="350"
                  y="15"
                  width="140"
                  height="220"
                  fill="#42e6a4"
                  opacity="0.025"
                />
              )}

              {showLevels && (
                <g>
                  <circle
  cx="365"
  cy={getY(setup.entryHigh)}
  r="5"
  fill="#42e6a4"
  stroke="white"
  strokeWidth="1.5"
/>

<circle
  cx="480"
  cy={getY(setup.target)}
  r="5"
  fill="#ff647c"
  stroke="white"
  strokeWidth="1.5"
/>

<text
  x="420"
  y={(getY(setup.target) + getY(setup.entryHigh)) / 2}
  fill="#42e6a4"
  fontSize="15"
  fontWeight="bold"
  textAnchor="middle"
>
  +{((setup.target / setup.entryHigh - 1) * 100).toFixed(2)}%
</text>

<text
  x="420"
  y={(getY(setup.stop) + getY(setup.entryHigh)) / 2}
  fill="#ff647c"
  fontSize="12"
  fontWeight="bold"
  textAnchor="middle"
>
  {((setup.stop / setup.entryHigh - 1) * 100).toFixed(2)}%
</text>
                  <rect
  x="350"
  y={getY(setup.target)}
  width="140"
  height={getY(setup.entryHigh) - getY(setup.target)}
  fill="#42e6a4"
  opacity="0.16"
/>

<rect
  x="350"
  y={getY(setup.entryHigh)}
  width="140"
  height={getY(setup.stop) - getY(setup.entryHigh)}
  fill="#ff647c"
  opacity="0.16"
/>
                  <rect
                    x="350"
                    y={getY(setup.entryHigh)}
                    width="140"
                    height={Math.max(
                      getY(setup.entryLow) -
                      getY(setup.entryHigh), 1
                    )}
                    fill={green}
                    opacity="0.2"
                  />

                  {[
                    [setup.target, "SELL TARGET " + formatPrice(setup.target), red],
[setup.entryHigh, "BUY ZONE " + formatPrice(setup.entryHigh), green],
[setup.stop, "STOP LOSS " + formatPrice(setup.stop), "#fbbf24"]
                  ].map(([value, label, color]) => (
                    <g key={label}>
                      <line
                        x1="350"
                        x2="490"
                        y1={getY(value)}
                        y2={getY(value)}
                        stroke={color}
                        strokeDasharray="4 3"
                      />
                      <text
                        x="488"
                        y={getY(value) - 5}
                        fill={color}
                        fontSize="12"
fontWeight="bold"
textAnchor="end"
                      >
                        {label}
                      </text>
                    </g>
                  ))}
                </g>
              )}

              {points.map((c, i) => {
                const x = 20 + i * candleWidth;
                const color = c.close >= c.open
                  ? green : red;

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
                      y={Math.min(
                        getY(c.open), getY(c.close)
                      )}
                      width={candleWidth * 0.7}
                      height={Math.max(
                        Math.abs(
                          getY(c.open) - getY(c.close)
                        ), 1
                      )}
                      fill={color}
                      rx="0.5"
                    />
                  </g>
                );
              })}

              {showProjection && (
                <g>
                  <line
                    x1="350"
                    x2="350"
                    y1="10"
                    y2="240"
                    stroke={muted}
                    strokeDasharray="3 4"
                  />

                  <text
                    x="350"
                    y="10"
                    fill={muted}
                    fontSize="9"
                    textAnchor="middle"
                  >
                    SCENARIO
                  </text>

                  <path
                    d={`M 350 ${getY(setup.current)}
                        L 490 ${getY(setup.scenario)}`}
                    fill="none"
                    stroke={outlookColor}
                    strokeWidth="2"
                    strokeDasharray="6 5"
                  />

                  <circle
                    cx="490"
                    cy={getY(setup.scenario)}
                    r="3"
                    fill={outlookColor}
                  />

                  <text
                    x="420"
                    y="255"
                    fill={muted}
                    fontSize="9"
                    textAnchor="middle"
                  >
                    Hypothetical path
                  </text>
                </g>
              )}

              <text
                x="15"
                y="255"
                fill={muted}
                fontSize="10"
              >
                Historical candles
              </text>

            </svg>
          )}

          {indicator && !busy && !setup && !chartError && (
            <p style={{ color: muted, fontSize: 12 }}>
              Insufficient completed candles for analysis.
            </p>
          )}

          {indicator && setup && !setup.fresh && (
            <p style={{ color: "#fbbf24", fontSize: 12 }}>
              Market data is stale. Refresh before analysis.
            </p>
          )}

          {showLevels && (
            <div style={{
              display: "grid",
              gap: 8,
              marginTop: 10
            }}>
              {[
                [
                  "HYPOTHETICAL BUY ZONE",
                  `${formatPrice(setup.entryLow)} – ${formatPrice(setup.entryHigh)}`,
                  green
                ],
                [
                  "HYPOTHETICAL SELL TARGET",
                  formatPrice(setup.target),
                  red
                ],
                [
                  "STOP-LOSS REFERENCE",
                  formatPrice(setup.stop),
                  "#fbbf24"
                ]
              ].map(([label, value, color]) => (
                <div key={label} style={{
                  background: "#101822",
                  border: `1px solid ${color}44`,
                  borderRadius: 8,
                  padding: 10
                }}>
                  <div style={{
                    color,
                    fontSize: 10,
                    letterSpacing: 1
                  }}>
                    {label}
                  </div>
                  <strong style={{
                    color,
                    fontSize: 15,
                    overflowWrap: "anywhere"
                  }}>
                    {value}
                  </strong>
                </div>
              ))}
            </div>
          )}

          {indicator && setup && !setup.validSetup && (
            <p style={{
              color: "#fbbf24",
              fontSize: 12
            }}>
              Illustrative levels only — no qualifying bullish setup.
            </p>
          )}

          {indicator && setup && (
            <div style={{
              background: "#101822",
              borderRadius: 8,
              padding: 12,
              marginTop: 12
            }}>
              <strong style={{
                color: green,
                fontSize: 11
              }}>
                ✦ NEXUS ANALYSIS
              </strong>

              <p style={{
                color: muted,
                fontSize: 12,
                lineHeight: 1.6
              }}>
                {setup.direction === "BULLISH"
                  ? "The 9-period EMA is above the 21-period EMA, and the latest completed close is above the faster EMA."
                  : setup.direction === "BEARISH"
                    ? "The faster EMA is below the slower EMA, with price showing negative historical momentum."
                    : "The moving averages do not confirm a clear directional trend."}
                {" "}Scenario levels use recent average true range.
                They are illustrative, not validated forecasts.
              </p>

              <p style={{
                color: muted,
                fontSize: 11
              }}>
                Scenario horizon: {
                  period === "minute" ? "30 minutes" :
                  period === "hour" ? "6 hours" : "6 days"
                }
              </p>

              <p style={{
                color: muted,
                fontSize: 10
              }}>
                Based on completed candles through {
                  new Date(setup.time * 1000).toLocaleString()
                }.
              </p>
            </div>
          )}

          <button
            disabled={busy}
            onClick={() => loadChart(period)}
            style={{
              ...buttonStyle,
              width: "100%",
              marginTop: 12,
              fontSize: 11
            }}
          >
            ↻ REFRESH MARKET DATA
          </button>

          <p style={{
            color: muted,
            fontSize: 10,
            lineHeight: 1.5
          }}>
            Source: GeckoTerminal.
            {updated && ` Retrieved: ${updated.toLocaleTimeString()}.`}
            {indicator && " Experimental rule-based indicator for research and simulated trading only. Not a trained AI forecast. Accuracy has not been validated."}
          </p>
        </div>
      )}
    </div>
  );
}

function Dashboard({ userId }) {
  const [activePage, setActivePage] = useState("scanner");
  const [virtualBalance, setVirtualBalance] = useState(1000);
const [portfolioReady, setPortfolioReady] = useState(false);
const [portfolioSyncError, setPortfolioSyncError] = useState("");
  
  const [refillAmount, setRefillAmount] = useState("1000");
  const [portfolioQuery, setPortfolioQuery] = useState("BONK");
const [portfolioTokens, setPortfolioTokens] = useState([]);
const [portfolioLoading, setPortfolioLoading] = useState(false);
const [portfolioError, setPortfolioError] = useState("");
async function refreshHoldings() {
  if (!portfolioReady || portfolioSyncError) return;
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
  if (!portfolioReady || portfolioSyncError) {
    alert("Portfolio unavailable. Please refresh the page.");
    return;
  }
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
  if (!portfolioReady || portfolioSyncError) {
    alert("Portfolio unavailable. Please refresh the page.");
    return;
  }
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
const [holdings, setHoldings] = useState([]);
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
  const [transactions, setTransactions] = useState([]);
  React.useEffect(() => {
    let cancelled = false;
  
    setPortfolioReady(false);
    setPortfolioSyncError("");
  
    async function restorePortfolio() {
      try {
        const saved = await loadPortfolio(userId);
  
        if (cancelled) return;
  
        setVirtualBalance(saved.balance);
        setHoldings(saved.holdings);
        setTransactions(saved.transactions);
        setPortfolioReady(true);
      } catch (error) {
        if (!cancelled) {
          setPortfolioSyncError(error.message);
        }
      }
    }
  
    restorePortfolio();
  
    return () => {
      cancelled = true;
    };
  }, [userId]);
  const portfolioSaveQueue = React.useRef(Promise.resolve());

React.useEffect(() => {
  if (!portfolioReady || !userId) return;

  portfolioSaveQueue.current = portfolioSaveQueue.current
    .catch(() => {})
    .then(async () => {
      try {
        await savePortfolio(
          userId,
          virtualBalance,
          holdings,
          transactions
        );

        setPortfolioSyncError("");
      } catch (error) {
        setPortfolioSyncError(error.message);
      }
    });
}, [
  userId,
  portfolioReady,
  virtualBalance,
  holdings,
  transactions
]);
  
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
    if (!portfolioReady || portfolioSyncError) {
      alert("Portfolio unavailable. Please refresh the page.");
      return;
    }
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

  <button
    style={{
      ...buttonStyle,
      flex: 1,
      background: activePage === "assistant"
        ? "#174d3b" : "#101822"
    }}
    onClick={() => setActivePage("assistant")}
  >
    ✦ AI ASSISTANT
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
              id="token-search"
name="token-search"
aria-label="Search token name or address"
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

<div style={{
  color: theme.muted,
  fontSize: 11,
  marginTop: 6,
  overflowWrap: "anywhere"
}}>
  Token address: {pair.baseToken?.address || "Unavailable"}
</div>

<div style={{
  color: "#fbbf24",
  fontSize: 10,
  marginTop: 6
}}>
  Tokens with identical names may be different assets.
</div>
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
                <a
  href={`https://dexscreener.com/solana/${pair.pairAddress}`}
  target="_blank"
  rel="noopener noreferrer"
  style={{
    ...buttonStyle,
    display: "block",
    textAlign: "center",
    textDecoration: "none",
    marginBottom: 12
  }}
>
  VIEW TOKEN RESEARCH ↗
</a>
<button
  onClick={async () => {
    try {
      await navigator.clipboard.writeText(
        pair.baseToken.address
      );
      alert("Token address copied!");
    } catch {
      alert("Unable to copy token address.");
    }
  }}
  style={{
    ...buttonStyle,
    width: "100%",
    marginBottom: 12
  }}
>
  COPY TOKEN ADDRESS
</button>
<button
  onClick={() => {
    setPortfolioQuery(pair.baseToken.address);
    setActivePage("portfolio");
    window.scrollTo(0, 0);
  }}
  style={{
    ...buttonStyle,
    width: "100%",
    marginBottom: 12
  }}
>
  EXPLORE IN VIRTUAL PORTFOLIO
</button>
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
        {activePage === "assistant" && (
  <ResearchAssistant />
)}
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
<p style={{ color: "#94a3b8" }}>
  AVAILABLE VIRTUAL CASH
</p>
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
      id="refill-amount"
name="refill-amount"
aria-label="Virtual balance refill amount"
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
    id="portfolio-token-search"
name="portfolio-token-search"
aria-label="Search tokens for virtual portfolio"
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
  <a
  href="/policies.html"
  style={{
    display: "block",
    color: "#42e6a4",
    fontSize: 13,
    marginTop: 16,
    textDecoration: "underline"
  }}
>
  Privacy Policy | Terms of Service | Refund Policy
</a>
</footer>

      
    </div>
    </div>    
  );
}
export default function App() {
  const [session, setSession] = useState(null);
  const [accessType, setAccessType] = useState(null);
const [accessRefresh, setAccessRefresh] = useState(0);
  const [showAdmin, setShowAdmin] = useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setAccessType(null);
    setShowAdmin(false);
  
    if (!session?.user?.id) return;
  
    async function checkAccess() {
      try {
        const { data, error } = await supabase
          .from("user_access")
          .select("access_type")
          .eq("user_id", session.user.id)
          .maybeSingle();
  
        if (error) throw error;
  
        if (!cancelled) {
          setAccessType(data?.access_type || "none");
        }
      } catch (error) {
        if (!cancelled) {
          setAccessType("error");
        }
      }
    }
  
    checkAccess();
  
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, accessRefresh]);
  
  const [checking, setChecking] = useState(true);

  React.useEffect(() => {
    const { data: { subscription } } =
      supabase.auth.onAuthStateChange((event, session) => {
        setSession(session);
        setChecking(false);
      });

    return () => subscription.unsubscribe();
  }, []);

  if (checking) {
    return (
      <div style={{
        background: "#080c12",
        color: "#42e6a4",
        minHeight: "100vh",
        padding: 30
      }}>
        Loading TradePilot AI...
      </div>
    );
  }

  if (!session) {
    return <Login />;
  }
  if (accessType === null) {
  return (
    <div style={{
      background: "#080c12",
      color: "#42e6a4",
      minHeight: "100vh",
      padding: 30
    }}>
      Checking access permissions...
    </div>
  );
}

const sandboxPaidAccess =
  import.meta.env.VITE_ENABLE_SANDBOX_CHECKOUT === "true" &&
  import.meta.env.VITE_ENABLE_PRODUCTION_CHECKOUT !== "true" &&
  window.location.hostname === "ai-research-assistant.tradepilotai.pages.dev" &&
  accessType === "test_paid";

if (
  !["admin", "free", "paid"].includes(accessType) &&
  !sandboxPaidAccess
) {
  return (
    <AccessGate
      onRefresh={() => setAccessRefresh(prev => prev + 1)}
    />
  );
}
  if (accessType === "admin" && showAdmin) {
    return (
      <Admin onBack={() => setShowAdmin(false)} />
    );
  }

  return (
    <>
      <div style={{
        background: "#080c12",
        padding: "12px 28px",
        display: "flex",
        justifyContent: "flex-end"
      }}>
        <button
          onClick={async () => {
            const { error } = await supabase.auth.signOut();
            if (error) alert(error.message);
          }}
          style={{
            background: "#101822",
            color: "#42e6a4",
            border: "1px solid #42e6a4",
            borderRadius: 8,
            padding: "10px 18px",
            cursor: "pointer",
            fontWeight: "bold"
          }}
        >
          LOG OUT
        </button>
        {accessType === "admin" && (
  <button
    onClick={() => setShowAdmin(true)}
    style={{
      color: "#42e6a4",
      background: "#174d3b",
      border: "1px solid #42e6a4",
      borderRadius: 8,
      padding: "10px 18px",
      marginLeft: 12,
      fontWeight: "bold",
      cursor: "pointer"
    }}
  >
    ADMIN
  </button>
)}
      </div>
      <Dashboard
  key={session.user.id}
  userId={session.user.id}
/>
    </>
  );
}
