// stock-frontend/src/components/PortfolioCard.tsx
import { useEffect, useMemo, useState } from "react";
import {
  addHolding,
  deleteHolding,
  getPortfolio,
  getSummary,
  createPortfolio,
  updateHolding,
  type Portfolio,
} from "../lib/api";

type Position = {
  id: number;
  ticker: string;
  qty: number;
  avg_price: number;
  last: number | null;
  cost: number;
  value: number | null;
  pnl: number | null;
};

export default function PortfolioCard({
  initialPortfolioId = 1,
  defaultName = "My Portfolio",
}: {
  initialPortfolioId?: number;
  defaultName?: string;
}) {
  const [pid, setPid] = useState<number>(initialPortfolioId);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [totals, setTotals] = useState<{ cost: number; value: number; pnl: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // add form
  const [ticker, setTicker] = useState("");
  const [qty, setQty] = useState<string>("");
  const [avg, setAvg] = useState<string>("");

  // inline edit state
  const [editId, setEditId] = useState<number | null>(null);
  const [editQty, setEditQty] = useState<string>("");
  const [editAvg, setEditAvg] = useState<string>("");

  async function ensurePortfolio() {
    setErr(null);
    try {
      const p = await getPortfolio(pid);
      setPortfolio(p);
    } catch {
      const created = await createPortfolio(defaultName);
      setPid(created.id);
      const p = await getPortfolio(created.id);
      setPortfolio(p);
    }
  }

  async function load() {
    if (!pid) return;
    setLoading(true);
    setErr(null);
    try {
      const p = await getPortfolio(pid);
      setPortfolio(p);
      const sum = await getSummary(pid);
      setPositions(sum.positions as Position[]);
      setTotals(sum.totals);
    } catch (e: any) {
      setErr(e?.response?.data?.detail || e.message || "Failed to load portfolio");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    ensurePortfolio().then(load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pid]);

  const disabled = useMemo(() => loading, [loading]);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!ticker || !qty || !avg) return;
    setLoading(true);
    setErr(null);
    try {
      await addHolding(pid, { ticker: ticker.toUpperCase().trim(), qty: parseFloat(qty), avg_price: parseFloat(avg) });
      setTicker("");
      setQty("");
      setAvg("");
      await load();
    } catch (e: any) {
      setErr(e?.response?.data?.detail || e.message || "Failed to add holding");
    } finally {
      setLoading(false);
    }
  }

  async function onDelete(hid: number) {
    setLoading(true);
    setErr(null);
    try {
      await deleteHolding(pid, hid);
      await load();
    } catch (e: any) {
      setErr(e?.response?.data?.detail || e.message || "Failed to delete holding");
    } finally {
      setLoading(false);
    }
  }

  function beginEdit(row: Position) {
    setEditId(row.id);
    setEditQty(String(row.qty));
    setEditAvg(String(row.avg_price));
  }

  function cancelEdit() {
    setEditId(null);
    setEditQty("");
    setEditAvg("");
  }

  async function saveEdit(hid: number) {
    if (!editQty && !editAvg) return;
    setLoading(true);
    setErr(null);
    try {
      const patch: Partial<{ qty: number; avg_price: number }> = {};
      if (editQty) patch.qty = parseFloat(editQty);
      if (editAvg) patch.avg_price = parseFloat(editAvg);
      await updateHolding(pid, hid, patch);
      cancelEdit();
      await load();
    } catch (e: any) {
      setErr(e?.response?.data?.detail || e.message || "Failed to update holding");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl bg-white shadow p-5 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-neutral-500">Portfolio</div>
          <div className="text-xl font-semibold">{portfolio?.name ?? defaultName}</div>
        </div>
        {totals && (
          <div className="text-right">
            <div className="text-sm text-neutral-500">Total Value</div>
            <div className="text-2xl font-semibold">
              {totals.value.toLocaleString(undefined, { style: "currency", currency: "USD" })}
            </div>
            <div
              className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-sm font-medium mt-1 ${
                totals.pnl >= 0 ? "bg-green-50 text-green-700 ring-1 ring-green-200" : "bg-red-50 text-red-700 ring-1 ring-red-200"
              }`}
              title="Total Profit / Loss"
            >
              <span className="h-2 w-2 rounded-full bg-current opacity-70" />
              {totals.pnl.toLocaleString(undefined, { style: "currency", currency: "USD" })}
            </div>
          </div>
        )}
      </div>

      {/* Add form */}
      <form onSubmit={onAdd} className="grid grid-cols-1 sm:grid-cols-[120px_120px_140px_auto] gap-3 items-end">
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
          <label className="text-sm text-neutral-600">Qty</label>
          <input
            className="mt-1 w-full rounded-lg border px-3 py-2"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder="10"
            inputMode="decimal"
          />
        </div>
        <div>
          <label className="text-sm text-neutral-600">Avg Price</label>
          <input
            className="mt-1 w-full rounded-lg border px-3 py-2"
            value={avg}
            onChange={(e) => setAvg(e.target.value)}
            placeholder="200"
            inputMode="decimal"
          />
        </div>
        <div>
          <button
            type="submit"
            disabled={disabled}
            className="w-full sm:w-auto rounded-lg bg-black text-white px-4 py-2 disabled:opacity-50 hover:bg-neutral-900 transition"
          >
            {loading ? "Adding…" : "Add Holding"}
          </button>
        </div>
      </form>

      {err && <div className="text-sm text-red-600">{err}</div>}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-neutral-500">
              <th className="py-2 pr-4">Ticker</th>
              <th className="py-2 pr-4 text-right">Qty</th>
              <th className="py-2 pr-4 text-right">Avg</th>
              <th className="py-2 pr-4 text-right">Last</th>
              <th className="py-2 pr-4 text-right">Cost</th>
              <th className="py-2 pr-4 text-right">Value</th>
              <th className="py-2 pr-4 text-right">PnL</th>
              <th className="py-2 pr-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {positions.map((p, idx) => {
              const pnlClass = (p.pnl ?? 0) >= 0 ? "text-green-600" : "text-red-600";
              const zebra = idx % 2 === 1 ? "bg-neutral-50/60" : "";
              const isEditing = editId === p.id;

              return (
                <tr key={p.id} className={`${zebra}`}>
                  {/* Ticker pill */}
                  <td className="py-2 pr-4">
                    <span className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 px-2.5 py-1 font-medium ring-1 ring-blue-200">
                      {p.ticker}
                    </span>
                  </td>

                  {/* Qty */}
                  <td className="py-2 pr-4 text-right">
                    {isEditing ? (
                      <input
                        value={editQty}
                        onChange={(e) => setEditQty(e.target.value)}
                        className="w-20 rounded border px-2 py-1 text-right"
                        inputMode="decimal"
                      />
                    ) : (
                      p.qty
                    )}
                  </td>

                  {/* Avg */}
                  <td className="py-2 pr-4 text-right">
                    {isEditing ? (
                      <input
                        value={editAvg}
                        onChange={(e) => setEditAvg(e.target.value)}
                        className="w-24 rounded border px-2 py-1 text-right"
                        inputMode="decimal"
                      />
                    ) : (
                      p.avg_price.toLocaleString(undefined, { style: "currency", currency: "USD" })
                    )}
                  </td>

                  {/* Last */}
                  <td className="py-2 pr-4 text-right">
                    {p.last !== null
                      ? p.last.toLocaleString(undefined, { style: "currency", currency: "USD" })
                      : "—"}
                  </td>

                  {/* Cost */}
                  <td className="py-2 pr-4 text-right">
                    {p.cost.toLocaleString(undefined, { style: "currency", currency: "USD" })}
                  </td>

                  {/* Value */}
                  <td className="py-2 pr-4 text-right">
                    {p.value !== null
                      ? p.value.toLocaleString(undefined, { style: "currency", currency: "USD" })
                      : "—"}
                  </td>

                  {/* PnL */}
                  <td className={`py-2 pr-4 text-right ${pnlClass}`}>
                    {p.pnl !== null
                      ? p.pnl.toLocaleString(undefined, { style: "currency", currency: "USD" })
                      : "—"}
                  </td>

                  {/* Actions */}
                  <td className="py-2 pr-2 text-right">
                    {isEditing ? (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => saveEdit(p.id)}
                          disabled={disabled}
                          className="rounded-lg bg-green-600 text-white px-3 py-1 hover:bg-green-700 disabled:opacity-50"
                          title="Save"
                        >
                          Save
                        </button>
                        <button
                          onClick={cancelEdit}
                          disabled={disabled}
                          className="rounded-lg border px-3 py-1 text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                          title="Cancel"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => beginEdit(p)}
                          disabled={disabled}
                          className="rounded-lg border px-3 py-1 text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                          title="Edit holding"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => onDelete(p.id)}
                          disabled={disabled}
                          className="rounded-lg border px-3 py-1 text-red-600 hover:bg-red-50 disabled:opacity-50"
                          title="Delete holding"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}

            {positions.length === 0 && (
              <tr>
                <td className="py-6 pr-4 text-neutral-500" colSpan={8}>
                  No holdings yet. Add one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
