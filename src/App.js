import { useMemo, useRef, useState } from "react";
import { evaluateTiming as postEvaluate } from "./api/timingApi";
import { CandleChart } from "./CandleChart";
import { SidePanel } from "./SidePanel";
import { TimingDetail } from "./TimingDetail";
import { REASON_TEXT } from "./timingCopy";
import { formatNav } from "./formatters";
import { loadWatchlist, toggleWatchlist } from "./watchlistStorage";
import {
  FETCH_GAP_MS,
  MIN_EVALUATE_BARS,
  TICKER_RE,
  countValidOhlcv,
  fiveYearMonths,
  incrementalMonths,
  parseSlashDate
} from "./fetchMonths";
import { runMonthlyFetch } from "./runMonthlyFetch";
import "./App.css";

const RANGE_OPTIONS = [
  ["1W", "1週"],
  ["3M", "3月"],
  ["6M", "半年"],
  ["1Y", "1年"],
  ["ALL", "全部"]
];

function formatYm(yearMonth) {
  return `${yearMonth.slice(0, 4)}/${yearMonth.slice(4)}`;
}

function App() {
  const [draft, setDraft] = useState("");
  const [stockNo, setStockNo] = useState("");
  const [historical, setHistorical] = useState([]);
  const [timing, setTiming] = useState(null);
  const [timingLoading, setTimingLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [status, setStatus] = useState("輸入四位數代號後按 Enter");
  const [rangeKey, setRangeKey] = useState("ALL");
  const [watched, setWatched] = useState(() => loadWatchlist());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const requestGen = useRef(0);
  const activeCodeRef = useRef("");

  const historyStatus = (rows) => {
    const valid = countValidOhlcv(rows);
    if (valid === 0) return "這檔還沒抓過";
    if (valid < MIN_EVALUATE_BARS) return "日線不足，請先抓近五年";
    return "尚未評估 · 圖上只有日 K";
  };

  const loadStockHistory = async (selectedStockNo, gen) => {
    const res = await fetch(`/api/stock-history?stockNo=${selectedStockNo}`);
    if (gen !== requestGen.current || activeCodeRef.current !== selectedStockNo) {
      return [];
    }
    if (!res.ok) {
      setStatus("讀取歷史股價失敗");
      setHistorical([]);
      return [];
    }
    const data = await res.json();
    if (gen !== requestGen.current || activeCodeRef.current !== selectedStockNo) {
      return [];
    }
    const uniqueData = Array.from(
      new Map(data.map((item) => [item.date, item])).values()
    ).sort((a, b) => parseSlashDate(a.date) - parseSlashDate(b.date));
    setHistorical(uniqueData);
    return uniqueData;
  };

  const selectStock = async (code) => {
    if (fetching) return;
    if (!TICKER_RE.test(code)) {
      setStatus("請輸入四位數上市代號");
      return;
    }
    const gen = ++requestGen.current;
    activeCodeRef.current = code;
    setStockNo(code);
    setTiming(null);
    const rows = await loadStockHistory(code, gen);
    if (gen !== requestGen.current) return;
    setStatus(historyStatus(rows));
  };

  const submitTicker = async () => {
    if (fetching) return;
    if (!TICKER_RE.test(draft)) {
      setStatus("請輸入四位數上市代號");
      return;
    }
    await selectStock(draft);
  };

  const runFetch = async (months) => {
    if (!TICKER_RE.test(stockNo) && !TICKER_RE.test(draft)) {
      setStatus("請輸入四位數上市代號");
      return;
    }
    const code = TICKER_RE.test(stockNo) ? stockNo : draft;
    if (!TICKER_RE.test(stockNo)) {
      requestGen.current += 1;
      setStockNo(code);
    }
    const gen = requestGen.current;
    activeCodeRef.current = code;
    if (months.length === 0) {
      setStatus("已是最新");
      return;
    }
    setFetching(true);
    setTiming(null);
    try {
      const { anyOk } = await runMonthlyFetch({
        months,
        postMonth: async (yearMonth) => {
          const res = await fetch("/api/manual/fetch-month", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ stockNo: code, yearMonth })
          });
          if (!res.ok) {
            return { twseOk: false };
          }
          return res.json();
        },
        delayMs: FETCH_GAP_MS,
        onProgress: (p) => {
          if (gen !== requestGen.current) return;
          setStatus(`正在抓 ${formatYm(p.yearMonth)}（${p.index}/${p.total}）`);
        }
      });
      if (gen !== requestGen.current) return;
      const rows = await loadStockHistory(code, gen);
      if (gen !== requestGen.current) return;
      if (countValidOhlcv(rows) === 0 && !anyOk) {
        setStatus("查無此上市代號或沒有日線");
      } else {
        setStatus(historyStatus(rows));
      }
    } catch {
      if (gen === requestGen.current) {
        setStatus("抓取日線失敗");
      }
    } finally {
      setFetching(false);
    }
  };

  const fetchFiveYears = () => runFetch(fiveYearMonths(new Date()));

  const refreshLatest = () => {
    if (historical.length === 0) {
      fetchFiveYears();
      return;
    }
    const last = parseSlashDate(historical.at(-1).date);
    runFetch(incrementalMonths(last, new Date()));
  };

  const evaluateTiming = async () => {
    if (!stockNo || countValidOhlcv(historical) < MIN_EVALUATE_BARS) return;
    const code = stockNo;
    const gen = requestGen.current;
    setTimingLoading(true);
    try {
      const data = await postEvaluate(code);
      if (gen !== requestGen.current || activeCodeRef.current !== code) return;
      setTiming(data);
    } catch {
      if (gen !== requestGen.current || activeCodeRef.current !== code) return;
      setTiming({ passed: false, reason: "evaluate_failed", trades: [], currentSignal: null });
    } finally {
      setTimingLoading(false);
    }
  };

  const displayHistorical = useMemo(() => {
    if (historical.length === 0) return [];
    if (rangeKey === "ALL") return historical;
    const end = parseSlashDate(historical.at(-1).date);
    const start = new Date(end);
    if (rangeKey === "1W") start.setDate(start.getDate() - 7);
    if (rangeKey === "3M") start.setMonth(start.getMonth() - 3);
    if (rangeKey === "6M") start.setMonth(start.getMonth() - 6);
    if (rangeKey === "1Y") start.setFullYear(start.getFullYear() - 1);
    return historical.filter((row) => {
      const d = parseSlashDate(row.date);
      return d >= start && d <= end;
    });
  }, [historical, rangeKey]);

  const last = historical.at(-1);
  const prev = historical.at(-2);
  const change = last && prev ? last.closePrice - prev.closePrice : 0;
  const changePct = last && prev && prev.closePrice ? (change / prev.closePrice) * 100 : 0;
  const up = change >= 0;
  const canEvaluate = !fetching && !timingLoading && countValidOhlcv(historical) >= MIN_EVALUATE_BARS;
  const chartTrades = timing?.passed ? timing.trades || [] : [];

  let strip = status;
  let stripClass = "strip";
  if (!fetching && timing) {
    const reasonText = REASON_TEXT[timing.reason] || REASON_TEXT.evaluate_failed;
    if (timing.passed) {
      stripClass = "strip pass";
      const side = timing.currentSignal === "long" ? "持有" : "空手";
      strip = `${side} · 下一根開盤才算 · 策略 ${formatNav(timing.metrics?.strategyEndNav)} · 持有 ${formatNav(timing.metrics?.buyHoldEndNav)} · ${timing.metrics?.roundTrips ?? "-"} 次`;
    } else {
      stripClass = "strip fail";
      strip = reasonText;
    }
  }

  return (
    <div className="board">
      <button
        type="button"
        className="sidebar-toggle"
        aria-label="選股列表"
        onClick={() => setSidebarOpen((v) => !v)}
      >
        列表
      </button>
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <SidePanel
          selectedStockNo={stockNo}
          watched={watched}
          onSelect={(code) => {
            setDraft(code);
            selectStock(code);
            setSidebarOpen(false);
          }}
          onToggleWatch={(code) => setWatched(toggleWatchlist(code))}
        />
      </aside>
      <main className="main">
        <div className="board-header">
          <div className="quote">
            <input
              aria-label="代號"
              value={draft}
              disabled={fetching}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitTicker();
              }}
            />
            <span className="name">{last?.stockName || ""}</span>
            {last && (
              <span className={up ? "up" : "down"}>
                {last.closePrice.toFixed(2)} {change >= 0 ? "+" : ""}
                {change.toFixed(2)} {changePct >= 0 ? "+" : ""}
                {changePct.toFixed(2)}%
              </span>
            )}
            <button
              type="button"
              className="watch-btn"
              aria-label={watched.includes(stockNo) ? "取消關注" : "關注"}
              disabled={!TICKER_RE.test(stockNo)}
              onClick={() => setWatched(toggleWatchlist(stockNo))}
            >
              {watched.includes(stockNo) ? "★ 已關注" : "☆ 關注"}
            </button>
          </div>
          <div className="actions">
            {historical.length === 0 ? (
              <button disabled={fetching} onClick={fetchFiveYears}>抓近五年</button>
            ) : (
              <button disabled={fetching} onClick={refreshLatest}>更新資料</button>
            )}
            <button disabled={!canEvaluate} onClick={evaluateTiming}>
              {timingLoading ? "評估中..." : "評估進出"}
            </button>
          </div>
        </div>
        <div className="range">
          {RANGE_OPTIONS.map(([key, label]) => (
            <button
              key={key}
              className={rangeKey === key ? "active" : ""}
              onClick={() => setRangeKey(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <CandleChart bars={displayHistorical} trades={chartTrades} />
        <div className={stripClass}>{strip}</div>
        <TimingDetail timing={timing} historical={historical} />
      </main>
    </div>
  );
}

export default App;
