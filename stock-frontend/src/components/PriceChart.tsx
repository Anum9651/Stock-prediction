import { useEffect, useRef } from "react";
import { createChart, UTCTimestamp } from "lightweight-charts";

type Candle = {
  ts: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type LinePoint = { ts: string; value: number };

type Colors = {
  sma20?: string;
  sma50?: string;
  ema12?: string;
  ema26?: string;
  bbUpper?: string;
  bbMid?: string;
  bbLower?: string;
};

function toUnix(ts: string): UTCTimestamp {
  return Math.floor(new Date(ts).getTime() / 1000) as UTCTimestamp;
}

export default function PriceChart({
  candles,
  sma20 = [],
  sma50 = [],
  ema12 = [],
  ema26 = [],
  bbUpper = [],
  bbMid = [],
  bbLower = [],
  colors = {},
  height = 520,
  showVolume = true,
}: {
  candles: Candle[];
  sma20?: LinePoint[];
  sma50?: LinePoint[];
  ema12?: LinePoint[];
  ema26?: LinePoint[];
  bbUpper?: LinePoint[];
  bbMid?: LinePoint[];
  bbLower?: LinePoint[];
  colors?: Colors;
  height?: number;
  showVolume?: boolean;
}) {
  const elRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!elRef.current) return;

    const chart = createChart(elRef.current, {
      height,
      layout: { background: { color: "transparent" }, textColor: "#111" },
      grid: { vertLines: { color: "#eee" }, horzLines: { color: "#eee" } },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.1, bottom: showVolume ? 0.25 : 0.1 } },
      timeScale: { borderVisible: false },
      crosshair: { mode: 1 },
    });

    // Candles
    const candleSeries = chart.addCandlestickSeries();
    candleSeries.setData(
      candles.map((c) => ({
        time: toUnix(c.ts),
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
    );

    // Volume (separate bottom scale)
    if (showVolume) {
      const volumeSeries = chart.addHistogramSeries({
        priceScaleId: "",
        priceFormat: { type: "volume" },
      });

      chart.priceScale("").applyOptions({
        scaleMargins: { top: 0.75, bottom: 0 },
      });

      volumeSeries.setData(
        candles.map((c) => ({
          time: toUnix(c.ts),
          value: c.volume,
          color: c.close >= c.open ? "rgba(14, 159, 110, 0.8)" : "rgba(225, 63, 63, 0.8)",
        }))
      );
    }

    // Overlays
    const addLine = (pts: LinePoint[], color: string, width: 1 | 2 | 3 | 4 = 2) => {
      if (!pts.length) return;
      // lineWidth expects a constrained type; pass a literal union
      const s = chart.addLineSeries({ color, lineWidth: width });
      s.setData(pts.map((p) => ({ time: toUnix(p.ts), value: p.value })));
    };

    addLine(sma20, colors.sma20 ?? "#1d4ed8");
    addLine(sma50, colors.sma50 ?? "#0ea5e9");
    addLine(ema12, colors.ema12 ?? "#22c55e");
    addLine(ema26, colors.ema26 ?? "#f59e0b");

    // Bollinger (upper/mid/lower)
    addLine(bbUpper, colors.bbUpper ?? "#a855f7", 1);
    addLine(bbMid,   colors.bbMid   ?? "#7c3aed", 1);
    addLine(bbLower, colors.bbLower ?? "#a855f7", 1);

    const resize = () => chart.applyOptions({ width: elRef.current!.clientWidth });
    resize();
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      chart.remove();
    };
  }, [candles, sma20, sma50, ema12, ema26, bbUpper, bbMid, bbLower, colors, height, showVolume]);

  return <div className="w-full" style={{ height }} ref={elRef} />;
}
