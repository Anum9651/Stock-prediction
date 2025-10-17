import { useEffect, useState } from "react";
import {
  addHolding,
  createPortfolio,
  deleteHolding,
  getSummary,
} from "../lib/api";

export default function PortfolioPanel() {
  const [pid, setPid] = useState<number | null>(null);
  const [pname, setPname] = useState("My Portfolio");

  const [ticker, setTicker] = useState("AAPL");
  const [qty, setQty] = useState<number>(1);
  const [avg, setAvg] = useState<number>(200);

  const [summary, setSummary] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function ensurePortfolio() {
    if (pid) return pid;
    const p = await createPortfolio(pname.trim() || "My Portfolio");
    setPid(p.id);
    return p.id;
  }

  async function refresh() {
    if (!pid) return;
    setLoading(true);
    setErr(null);
    try {
      const s = await getSummary(pid);
      setSummary(s);
    } catch (e: any) {
      setErr(e?.response?.data?.detail || e.message);
    } finally {
      setLoading(false);
    }
  }

  async function onCreate() {
    const p = await createPortfolio(pname.trim() || "My Portfolio");
    setPid(p.id);
    setSummary(null);
  }

  async function onAdd() {
    const id = await ensurePortfolio();
    await addHolding(id, {
      ticker: ticker.trim().toUpperCase(),
      qty,
      avg_price: avg,
    });
    await refresh();
  }

  async function onDelete(hid: number) {
    if (!pid) return;
    await deleteHolding(pid, hid);
    await refresh();
  }

  useEffect(() => {
    if (pid) refresh();
  }, [pid]);

  return (
    <div className="rounded-2xl bg-white shadow p-4 space-y-3">
      <div className="text-lg font-medium">Portfolio</div>

      <div className="flex gap-2 items-end">
        <div>
          <label className="text-sm text-neutral-600">Name</label>
          <input
            className="mt-1 rounded-lg border px-3 py-2"
            value={pname}
            onChange={(e) => setPname(e.target.value)}
          />
        </div>
        <button onClick={onCreate} className="rounded-lg bg-black text-white px-4 py-2">
          Create
        </button>
        {pid && <div className="text-sm text-neutral-500">ID: {pid}</div>}
      </div>

      {pid && (
        <>
          <div className="flex gap-3 items-end">
            <div>
              <label className="text-sm text-neutral-600">Ticker</label>
              <input
                className="mt-1 w-28 rounded-lg border px-3 py-2"
                value={ticker}
                onChange={(e) => setTicker(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm text-neutral-600">Qty</label>
              <input
                type="number"
                className="mt-1 w-28 rounded-lg border px-3 py-2"
                value={qty}
                onChange={(e) => setQty(parseFloat(e.target.value))}
              />
            </div>
            <div>
              <label className="text-sm text-neutral-600">Avg Price</label>
              <input
                type="number"
                className="mt-1 w-28 rounded-lg border px-3 py-2"
                value={avg}
                onChange={(e) => setAvg(parseFloat(e.target.value))}
              />
            </div>
            <button onClick={onAdd} className="rounded-lg bg-blue-600 text-white px-4 py-2">
              Add Holding
            </button>
            <button onClick={refresh} className="rounded-lg border px-4 py-2">
              Refresh
            </button>
          </div>

          {err && <div className="text-red-600 text-sm">{err}</div>}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2">Ticker</th>
                  <th>Qty</th>
                  <th>Avg</th>
                  <th>Last</th>
                  <th>Cost</th>
                  <th>Value</th>
                  <th>PnL</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(summary?.positions ?? []).map((p: any) => (
                  <tr key={p.id} className="border-b">
                    <td className="py-2">{p.ticker}</td>
                    <td>{p.qty}</td>
                    <td>${p.avg_price.toFixed(2)}</td>
                    <td>{p.last != null ? `$${p.last.toFixed(2)}` : "—"}</td>
                    <td>${p.cost.toFixed(2)}</td>
                    <td>{p.value != null ? `$${p.value.toFixed(2)}` : "—"}</td>
                    <td className={(p.pnl ?? 0) >= 0 ? "text-green-600" : "text-red-600"}>
                      {p.pnl != null ? `$${p.pnl.toFixed(2)}` : "—"}
                    </td>
                    <td>
                      <button className="text-red-600" onClick={() => onDelete(p.id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="text-sm">
            <span className="mr-4">Cost: <b>{summary?.totals?.cost?.toFixed?.(2) ?? "-"}</b></span>
            <span className="mr-4">Value: <b>{summary?.totals?.value?.toFixed?.(2) ?? "-"}</b></span>
            <span>
              PnL:{" "}
              <b className={(summary?.totals?.pnl ?? 0) >= 0 ? "text-green-600" : "text-red-600"}>
                {summary?.totals?.pnl?.toFixed?.(2) ?? "-"}
              </b>
            </span>
          </div>

          {loading && <div className="text-sm text-neutral-500">Loading…</div>}
        </>
      )}
    </div>
  );
}
