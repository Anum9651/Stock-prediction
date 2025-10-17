import { useEffect, useMemo, useState } from "react";
import {
  Portfolio,
  Holding,
  createPortfolio,
  getPortfolio,
  addHolding,
  updateHolding,
  deleteHolding,
  getStock,
} from "../lib/api";

function usd(n: number | undefined) {
  if (n == null || Number.isNaN(n)) return "-";
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

async function fetchLastClose(ticker: string): Promise<number | null> {
  try {
    const s = await getStock(ticker, "1y", "1d");
    const last = s.data[s.data.length - 1];
    return last?.close ?? null;
  } catch {
    return null;
  }
}

export default function PortfolioPanel({ defaultTicker }: { defaultTicker: string }) {
  const [pf, setPf] = useState<Portfolio | null>(null);
  const [name, setName] = useState("My Portfolio");
  const [ticker, setTicker] = useState(defaultTicker);
  const [qty, setQty] = useState<number>(1);
  const [avg, setAvg] = useState<number>(200);
  const [pricing, setPricing] = useState<Record<string, number | null>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = localStorage.getItem("pfId");
    if (id) loadPortfolio(parseInt(id, 10));
  }, []);

  useEffect(() => setTicker(defaultTicker), [defaultTicker]);

  async function loadPortfolio(id: number) {
    setBusy(true);
    setError(null);
    try {
      const data = await getPortfolio(id);
      setPf(data);
      localStorage.setItem("pfId", String(data.id));
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Failed to load portfolio");
    } finally {
      setBusy(false);
    }
  }

  async function onCreate() {
    setBusy(true);
    setError(null);
    try {
      const data = await createPortfolio(name.trim() || "My Portfolio");
      setPf(data);
      localStorage.setItem("pfId", String(data.id));
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Failed to create portfolio");
    } finally {
      setBusy(false);
    }
  }

  async function onAdd() {
    if (!pf) return;
    setBusy(true);
    setError(null);
    try {
      const data = await addHolding(pf.id, { ticker: ticker.trim().toUpperCase(), qty, avg_price: avg });
      setPf(data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Failed to add holding");
    } finally {
      setBusy(false);
    }
  }

  async function onPatch(h: Holding, patch: Partial<Holding>) {
    if (!pf) return;
    setBusy(true);
    setError(null);
    try {
      const data = await updateHolding(pf.id, h.id, { qty: patch.qty, avg_price: patch.avg_price });
      setPf(data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Failed to update");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(h: Holding) {
    if (!pf) return;
    setBusy(true);
    setError(null);
    try {
      const data = await deleteHolding(pf.id, h.id);
      setPf(data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Failed to delete");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    (async () => {
      if (!pf?.holdings?.length) return;
      const uniq = [...new Set(pf.holdings.map(h => h.ticker))];
      const entries = await Promise.all(uniq.map(async t => [t, await fetchLastClose(t)] as const));
      const map: Record<string, number | null> = {};
      for (const [t, v] of entries) map[t] = v;
      setPricing(map);
    })();
  }, [pf?.holdings]);

  const totals = useMemo(() => {
    if (!pf) return { cost: 0, value: 0, pnl: 0 };
    let cost = 0, value = 0;
    for (const h of pf.holdings ?? []) {
      cost += h.qty * h.avg_price;
      const last = pricing[h.ticker] ?? 0;
      value += h.qty * (last || 0);
    }
    return { cost, value, pnl: value - cost };
  }, [pf, pricing]);

  return (
    <div className="rounded-2xl bg-white shadow p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Portfolio</h2>
        {pf && <span className="text-xs text-neutral-500">ID: {pf.id}</span>}
      </div>

      {!pf ? (
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            className="w-full sm:w-64 rounded-lg border px-3 py-2"
            placeholder="Portfolio name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            onClick={onCreate}
            disabled={busy}
            className="rounded-lg bg-black text-white px-4 py-2 disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create"}
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <input
              className="rounded-lg border px-3 py-2"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              placeholder="Ticker"
            />
            <input
              className="rounded-lg border px-3 py-2"
              type="number"
              value={qty}
              onChange={(e) => setQty(parseFloat(e.target.value))}
              placeholder="Qty"
            />
            <input
              className="rounded-lg border px-3 py-2"
              type="number"
              value={avg}
              onChange={(e) => setAvg(parseFloat(e.target.value))}
              placeholder="Avg price"
            />
            <div className="col-span-2 sm:col-span-1 flex gap-2">
              <button
                onClick={onAdd}
                disabled={busy}
                className="rounded-lg bg-black text-white px-4 py-2 disabled:opacity-50"
              >
                {busy ? "Adding…" : "Add Holding"}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-neutral-500">
                  <th className="py-2">Ticker</th>
                  <th className="py-2">Qty</th>
                  <th className="py-2">Avg</th>
                  <th className="py-2">Last</th>
                  <th className="py-2">Cost</th>
                  <th className="py-2">Value</th>
                  <th className="py-2">PnL</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {(pf.holdings ?? []).map(h => {
                  const last = pricing[h.ticker] ?? null;
                  const cost = h.qty * h.avg_price;
                  const val = h.qty * (last || 0);
                  const pnl = val - cost;
                  return (
                    <tr key={h.id} className="border-t">
                      <td className="py-2 font-medium">{h.ticker}</td>
                      <td className="py-2">
                        <input
                          className="w-20 rounded border px-2 py-1"
                          type="number"
                          defaultValue={h.qty}
                          onBlur={(e) => {
                            const v = parseFloat(e.target.value);
                            if (!Number.isNaN(v) && v !== h.qty) onPatch(h, { qty: v });
                          }}
                        />
                      </td>
                      <td className="py-2">
                        <input
                          className="w-24 rounded border px-2 py-1"
                          type="number"
                          defaultValue={h.avg_price}
                          onBlur={(e) => {
                            const v = parseFloat(e.target.value);
                            if (!Number.isNaN(v) && v !== h.avg_price) onPatch(h, { avg_price: v });
                          }}
                        />
                      </td>
                      <td className="py-2">{last == null ? "…" : usd(last)}</td>
                      <td className="py-2">{usd(cost)}</td>
                      <td className="py-2">{usd(val)}</td>
                      <td className={`py-2 ${pnl >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                        {usd(pnl)}
                      </td>
                      <td className="py-2">
                        <button
                          onClick={() => onDelete(h)}
                          className="text-red-600 hover:underline"
                          disabled={busy}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t font-semibold">
                  <td className="py-2">Totals</td>
                  <td />
                  <td />
                  <td />
                  <td className="py-2">{usd(totals.cost)}</td>
                  <td className="py-2">{usd(totals.value)}</td>
                  <td className={`py-2 ${totals.pnl >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                    {usd(totals.pnl)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}

      {error && <div className="text-red-600 text-sm">{error}</div>}
    </div>
  );
}
