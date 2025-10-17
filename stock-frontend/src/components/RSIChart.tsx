import { useEffect, useRef } from "react";
import { createChart, UTCTimestamp } from "lightweight-charts";

type Point = { ts: string; value: number };

function toUnix(ts: string): UTCTimestamp {
  return Math.floor(new Date(ts).getTime() / 1000) as UTCTimestamp;
}

export default function RSIChart({
  data,
  height = 140,
}: {
  data: Point[];
  height?: number;
}) {
  const elRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!elRef.current) return;

    const chart = createChart(elRef.current, {
      height,
      layout: { background: { color: "transparent" }, textColor: "#111" },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
      grid: { vertLines: { color: "#eee" }, horzLines: { color: "#eee" } },
    });

    const series = chart.addLineSeries({ lineWidth: 2, color: "#6366f1" }); // purple line
    series.setData(data.map(p => ({ time: toUnix(p.ts), value: p.value })));


    // 30/70 guide lines
    series.createPriceLine({ price: 70, color: "#999", lineWidth: 1, lineStyle: 2, axisLabelVisible: true });
    series.createPriceLine({ price: 30, color: "#999", lineWidth: 1, lineStyle: 2, axisLabelVisible: true });

    const resize = () => chart.applyOptions({ width: elRef.current!.clientWidth });
    resize();
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      chart.remove();
    };
  }, [data, height]);

  return <div className="w-full" style={{ height }} ref={elRef} />;
}
