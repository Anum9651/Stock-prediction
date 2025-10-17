import { useEffect, useMemo, useState } from "react";
import PriceChart from "./components/PriceChart";
import RSIChart from "./components/RSIChart";
import PortfolioCard from "./components/PortfolioCard";
import { getIndicators, getStock } from "./lib/api";

type RangeOpt = "1y" | "5y" | "6mo" | "3mo";
type IntervalOpt = "1d" | "1m" | "5m";
type LinePoint = { ts: string; value: number };

const CHART_COLORS = {
  sma20: "#1d4ed8",
  sma50: "#0ea5e9",
  ema12: "#22c55e",
  ema26: "#f59e0b",
  bbUpper: "#a855f7",
  bbMid: "#7c3aed",
  bbLower: "#a855f7",
};

export default function App() {
  const [ticker, setTicker] = useState("AAPL");
  const [range, setRange] = useState<RangeOpt>("1y");
  const [interval, setInterval] = useState<IntervalOpt>("1d");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [candles, setCandles] = useState<any[]>([]);
  const [sma20, setSma20] = useState<LinePoint[]>([]);
  const [sma50, setSma50] = useState<LinePoint[]>([]);
  const [ema12, setEma12] = useState<LinePoint[]>([]);
  const [ema26, setEma26] = useState<LinePoint[]>([]);
  const [bbUpper, setBbUpper] = useState<LinePoint[]>([]);
  const [bbLower, setBbLower] = useState<LinePoint[]>([]);
  const [bbMid, setBbMid] = useState<LinePoint[]>([]);
  const [rsi, setRsi] = useState<LinePoint[]>([]);

  // toggles
  const [showSma20, setShowSma20] = useState(true);
  const [showSma50, setShowSma50] = useState(true);
  const [showEma12, setShowEma12] = useState(false);
  const [showEma26, setShowEma26] = useState(false);
  const [showBb, setShowBb] = useState(false);
  const [showRsi, setShowRsi] = useState(true);
  const [showVolume, setShowVolume] = useState(true);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const s = await getStock(ticker, range, interval);
      setCandles(s.data);

      const ind = await getIndicators(ticker, range, interval);
      setSma20((ind.indicators.sma20 ?? []).map((p: any) => ({ ts: p.ts, value: p.sma20 })));
      setSma50((ind.indicators.sma50 ?? []).map((p: any) => ({ ts: p.ts, value: p.sma50 })));
      setEma12((ind.indicators.ema12 ?? []).map((p: any) => ({ ts: p.ts, value: p.ema12 })));
      setEma26((ind.indicators.ema26 ?? []).map((p: any) => ({ ts: p.ts, value: p.ema26 })));

      const bb = ind.indicators.bb ?? [];
      setBbUpper(bb.map((p: any) => ({ ts: p.ts, value: p.upper })));
      setBbLower(bb.map((p: any) => ({ ts: p.ts, value: p.lower })));
      setBbMid(bb.map((p: any) => ({ ts: p.ts, value: p.mid })));

      setRsi((ind.indicators.rsi14 ?? []).map((p: any) => ({ ts: p.ts, value: p.rsi14 })));
    } catch (e: any) {
      setError(e?.response?.data?.detail || e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const disabled = useMemo(() => loading, [loading]);

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Stock Viewer</h1>
        <a
          className="text-sm text-blue-600 underline"
          href={import.meta.env.VITE_API_BASE + "/docs"}
          target="_blank"
        >
          API Docs
        </a>
      </header>

      {/* Portfolio (left) + Chart (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-[380px_minmax(0,1fr)] gap-4">
        {/* Left: Portfolio */}
        <PortfolioCard initialPortfolioId={1} defaultName="My Portfolio" />

        {/* Right: Chart card */}
        <div className="rounded-2xl bg-white shadow p-4 space-y-4">
          {/* Controls */}
          <div className="grid grid-cols-[140px_120px_120px_auto] gap-3 items-end">
            <div>
              <label className="text-sm text-neutral-600">Ticker</label>
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                placeholder="AAPL"
              />
            </div>
            <div>
              <label className="text-sm text-neutral-600">Range</label>
              <select
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={range}
                onChange={(e) => setRange(e.target.value as any)}
              >
                <option>1y</option>
                <option>6mo</option>
                <option>3mo</option>
                <option>5y</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-neutral-600">Interval</label>
              <select
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={interval}
                onChange={(e) => setInterval(e.target.value as any)}
              >
                <option>1d</option>
                <option>1m</option>
                <option>5m</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={load}
                disabled={disabled}
                className="rounded-lg bg-black text-white px-4 py-2 disabled:opacity-50"
              >
                {loading ? "Loading…" : "Load"}
              </button>
            </div>
          </div>

          {/* Indicator toggles */}
          <div className="flex flex-wrap gap-4 text-sm text-neutral-700 items-center">
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={showSma20} onChange={(e) => setShowSma20(e.target.checked)} />
              <span className="inline-block w-3 h-3 rounded-full" style={{ background: CHART_COLORS.sma20 }} />
              SMA20
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={showSma50} onChange={(e) => setShowSma50(e.target.checked)} />
              <span className="inline-block w-3 h-3 rounded-full" style={{ background: CHART_COLORS.sma50 }} />
              SMA50
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={showEma12} onChange={(e) => setShowEma12(e.target.checked)} />
              <span className="inline-block w-3 h-3 rounded-full" style={{ background: CHART_COLORS.ema12 }} />
              EMA12
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={showEma26} onChange={(e) => setShowEma26(e.target.checked)} />
              <span className="inline-block w-3 h-3 rounded-full" style={{ background: CHART_COLORS.ema26 }} />
              EMA26
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={showBb} onChange={(e) => setShowBb(e.target.checked)} />
              <span className="inline-block w-3 h-3 rounded-full" style={{ background: CHART_COLORS.bbMid }} />
              Bollinger Bands
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={showRsi} onChange={(e) => setShowRsi(e.target.checked)} />
              <span className="inline-block w-3 h-3 rounded-full bg-red-500" />
              RSI
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={showVolume} onChange={(e) => setShowVolume(e.target.checked)} />
              <span className="inline-block w-3 h-3 rounded-full bg-neutral-700" />
              Volume
            </label>
          </div>

          {error && <div className="text-red-600 text-sm">{error}</div>}

          {/* Chart */}
          <PriceChart
            candles={candles}
            sma20={showSma20 ? sma20 : []}
            sma50={showSma50 ? sma50 : []}
            ema12={showEma12 ? ema12 : []}
            ema26={showEma26 ? ema26 : []}
            bbUpper={showBb ? bbUpper : []}
            bbLower={showBb ? bbLower : []}
            bbMid={showBb ? bbMid : []}
            showVolume={showVolume}
          />
        </div>
      </div>

      {/* RSI panel (full-width under the grid) */}
      {showRsi && (
        <div className="rounded-2xl bg-white shadow p-4">
          <div className="text-sm mb-2 text-neutral-600">RSI (14)</div>
          <RSIChart data={rsi} />
        </div>
      )}

      <footer className="text-xs text-neutral-500">
        Data via your FastAPI backend (cached in Redis, stored in Postgres).
      </footer>
    </div>
  );
}
