import axios from "axios";

/* ---------- axios instance ---------- */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE, // e.g. http://localhost:8000
  timeout: 20000,
});

/* ---------- Stock ---------- */
export type Candle = {
  ts: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export async function getStock(ticker: string, range = "1y", interval = "1d") {
  const { data } = await api.get(`/stock`, { params: { ticker, range, interval } });
  return data as { ticker: string; interval: string; data: Candle[] };
}

/* ---------- Indicators ---------- */
export type IndicatorsResponse = {
  ticker: string;
  interval: string;
  indicators: {
    sma20?: { ts: string; sma20: number }[];
    sma50?: { ts: string; sma50: number }[];
    ema12?: { ts: string; ema12: number }[];
    ema26?: { ts: string; ema26: number }[];
    bb?: { ts: string; upper: number; mid: number; lower: number }[];
    rsi14?: { ts: string; rsi14: number }[];
  };
};

export async function getIndicators(ticker: string, range = "1y", interval = "1d") {
  const { data } = await api.get(`/indicators`, { params: { ticker, range, interval } });
  return data as IndicatorsResponse;
}

/* ---------- Portfolio ---------- */
export type Holding = { id: number; ticker: string; qty: number; avg_price: number };
export type Portfolio = { id: number; name: string; holdings: Holding[] };

export async function createPortfolio(name: string) {
  const { data } = await api.post(`/portfolio`, { name });
  return data as Portfolio;
}

export async function getPortfolio(id: number) {
  const { data } = await api.get(`/portfolio/${id}`);
  return data as Portfolio;
}

export async function addHolding(
  pfId: number,
  payload: { ticker: string; qty: number; avg_price: number }
) {
  const { data } = await api.post(`/portfolio/${pfId}/holdings`, payload);
  return data as Portfolio;
}

export async function updateHolding(
  pfId: number,
  holdingId: number,
  patch: Partial<{ qty: number; avg_price: number }>
) {
  const { data } = await api.patch(`/portfolio/${pfId}/holdings/${holdingId}`, patch);
  return data as Portfolio;
}

export async function deleteHolding(pfId: number, holdingId: number) {
  const { data } = await api.delete(`/portfolio/${pfId}/holdings/${holdingId}`);
  return data as Portfolio;
}

export async function deletePortfolio(pfId: number) {
  const { data } = await api.delete(`/portfolio/${pfId}`);
  return data as { ok: true };
}

export async function getSummary(pid: number) {
  const { data } = await api.get(`/portfolio/${pid}/summary`);
  return data as {
    id: number;
    name: string;
    positions: {
      id: number;
      ticker: string;
      qty: number;
      avg_price: number;
      last: number | null;
      value: number | null;
      cost: number;
      pnl: number | null;
    }[];
    totals: { cost: number; value: number; pnl: number };
  };
}
