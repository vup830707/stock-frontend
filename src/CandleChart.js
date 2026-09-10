import { useEffect, useRef } from "react";
import { createChart } from "lightweight-charts";

const UP = "#ef5350";
const DOWN = "#26a69a";

function toTime(date) {
  return String(date).replaceAll("/", "-");
}

export function CandleChart({ bars, trades }) {
  const hostRef = useRef(null);

  useEffect(() => {
    if (!hostRef.current || !bars || bars.length === 0) return undefined;
    const chart = createChart(hostRef.current, {
      autoSize: true,
      layout: { background: { color: "#161616" }, textColor: "#ddd" },
      grid: { vertLines: { color: "#333" }, horzLines: { color: "#333" } },
      rightPriceScale: { borderColor: "#444" },
      timeScale: { borderColor: "#444" }
    });
    const series = chart.addCandlestickSeries({
      upColor: UP,
      downColor: DOWN,
      borderVisible: false,
      wickUpColor: UP,
      wickDownColor: DOWN
    });
    const data = bars.map((bar) => ({
      time: toTime(bar.date),
      open: bar.openPrice,
      high: bar.highPrice,
      low: bar.lowPrice,
      close: bar.closePrice
    }));
    const visibleTimes = new Set(data.map((bar) => bar.time));
    series.setData(data);
    series.setMarkers(
      (trades || [])
        .filter((trade) => visibleTimes.has(toTime(trade.date)))
        .slice()
        .sort((a, b) => toTime(a.date).localeCompare(toTime(b.date)))
        .map((trade) =>
          trade.side === "buy"
            ? {
                time: toTime(trade.date),
                position: "belowBar",
                color: "#42a5f5",
                shape: "arrowUp",
                text: "買"
              }
            : {
                time: toTime(trade.date),
                position: "aboveBar",
                color: "#ffca28",
                shape: "arrowDown",
                text: "賣"
              }
        )
    );
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [bars, trades]);

  if (!bars || bars.length === 0) return null;
  return <div ref={hostRef} style={{ width: "100%", height: 420 }} />;
}
