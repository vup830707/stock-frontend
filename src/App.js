import { useEffect, useState, useMemo, useCallback } from "react";

import { Line } from "react-chartjs-2";
import { REASON_TEXT } from "./timingCopy";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

// ✅ 放 component 外，避免每次 render 都生成新 function（穩定 deps）
const parseDate = (s) => new Date(String(s).replaceAll("/", "-"));

function App() {
  const [stockNo, setStockNo] = useState("");
  const [stockList, setStockList] = useState([]);
  const [historical, setHistorical] = useState([]);

  const [timing, setTiming] = useState(null);
  const [timingLoading, setTimingLoading] = useState(false);

  // 手動日期
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // ✅ 圖表顯示範圍（只影響圖表，不影響上方「筆數/區間」）
  const [rangeKey, setRangeKey] = useState("ALL"); // 1W,3M,6M,1Y,2Y,5Y,ALL

  // const parseDate = (s) => new Date(s.replaceAll("/", "-"));

  // =====================
  // 讀公司清單
  // =====================
  useEffect(() => {
    const loadCompanies = async () => {
      try {
        // const res = await fetch("http://localhost:8080/api/company/all");
        const res = await fetch("/api/company/all");
        const data = await res.json();
        setStockList(data);
        if (data.length > 0) setStockNo(data[0].stockNo);
      } catch (err) {
        alert("讀取公司清單失敗");
      }
    };
    loadCompanies();
  }, []);

  // =====================
  // 抓歷史股價
  // =====================
  // const loadStockHistory = async (selectedStockNo) => {
  //   if (!selectedStockNo) return;

  //   // const res = await fetch(
  //   //   `http://localhost:8080/api/stock-history?stockNo=${selectedStockNo}`
  //   // );
  //   const res = await fetch(
  //     `/api/stock-history?stockNo=${selectedStockNo}`
  //   );
  //   const data = await res.json();

  //   const uniqueData = Array.from(
  //     new Map(data.map((item) => [item.date, item])).values()
  //   ).sort((a, b) => parseDate(a.date) - parseDate(b.date));

  //   setHistorical(uniqueData);
  //   setPrediction(null);
  // };

  const loadStockHistory = useCallback(async (selectedStockNo) => {
    if (!selectedStockNo) return;

    const res = await fetch(`/api/stock-history?stockNo=${selectedStockNo}`);
    if (!res.ok) {
      console.error("loadStockHistory failed:", res.status, res.statusText);
      alert("讀取歷史股價失敗");
      return;
    }

    const data = await res.json();

    const uniqueData = Array.from(
      new Map(data.map((item) => [item.date, item])).values()
    ).sort((a, b) => parseDate(a.date) - parseDate(b.date));

    setHistorical(uniqueData);
    setTiming(null);
  }, []);

  // useEffect(() => {
  //   if (stockNo) loadStockHistory(stockNo);
  // }, [stockNo]);

  // =====================
  // stockNo 變更 -> 自動抓歷史股價（✅ deps 正確）
  // =====================
  useEffect(() => {
    if (stockNo) loadStockHistory(stockNo);
  }, [stockNo, loadStockHistory]);

  // =====================
  // 手動抓資料（指定區間）
  // =====================
  const fetchStockManualRange = async () => {
    if (!stockNo || !startDate || !endDate) {
      alert("請選擇股票與起訖日期");
      return;
    }

    try {
      // const res = await fetch(
      //   `http://localhost:8080/api/manual/fetch-range?stockNo=${stockNo}&startDate=${startDate}&endDate=${endDate}`
      // );
      const res = await fetch(
        `/api/manual/fetch-range?stockNo=${stockNo}&startDate=${startDate}&endDate=${endDate}`
      );
      const text = await res.text();
      alert(text);
      loadStockHistory(stockNo);
    } catch (err) {
      alert("手動抓資料失敗");
    }
  };

  const evaluateTiming = async () => {
    if (!stockNo) return;

    setTimingLoading(true);
    try {
      const res = await fetch("/api/timing/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stockNo })
      });
      const data = await res.json();
      setTiming(data);
    } catch (err) {
      setTiming({ passed: false, reason: "evaluate_failed" });
    } finally {
      setTimingLoading(false);
    }
  };

  // =====================
  // 圖表顯示用資料：依 rangeKey 篩選（只影響圖表）
  // =====================
  const displayHistorical = useMemo(() => {
    if (historical.length === 0) return [];
    if (rangeKey === "ALL") return historical;

    const end = parseDate(historical.at(-1).date);
    const start = new Date(end);

    const daysBack = { "1W": 7 };
    const monthsBack = { "3M": 3, "6M": 6 };
    const yearsBack = { "1Y": 1, "2Y": 2, "5Y": 5 };

    if (daysBack[rangeKey]) {
      start.setDate(start.getDate() - daysBack[rangeKey]);
    } else if (monthsBack[rangeKey]) {
      start.setMonth(start.getMonth() - monthsBack[rangeKey]);
    } else if (yearsBack[rangeKey]) {
      start.setFullYear(start.getFullYear() - yearsBack[rangeKey]);
    }

    return historical.filter((x) => {
      const d = parseDate(x.date);
      return d >= start && d <= end;
    });
  }, [historical, rangeKey]);

  // =====================
  // 圖表資料（用 displayHistorical）
  // =====================
  const chartData = useMemo(() => {
    const markerData = (side) =>
      timing?.passed
        ? displayHistorical.map((historicalItem) => {
            const hit = (timing.trades || []).some(
              (trade) =>
                trade.date === historicalItem.date && trade.side === side
            );
            return hit ? historicalItem.closePrice : null;
          })
        : null;

    return {
      labels: displayHistorical.map((item) => item.date),
      datasets: [
        {
          label: "歷史收盤價",
          data: displayHistorical.map((item) => item.closePrice),
          borderColor: "#2563eb",
          tension: 0.3
        },
        timing?.passed && {
          label: "買點",
          data: markerData("buy"),
          borderColor: "#16a34a",
          backgroundColor: "#16a34a",
          showLine: false,
          pointRadius: 5,
          spanGaps: false
        },
        timing?.passed && {
          label: "賣點",
          data: markerData("sell"),
          borderColor: "#dc2626",
          backgroundColor: "#dc2626",
          showLine: false,
          pointRadius: 5,
          spanGaps: false
        }
      ].filter(Boolean)
    };
  }, [displayHistorical, timing]);

  const rangeLabel =
    rangeKey === "ALL"
      ? "全部"
      : rangeKey === "1W"
      ? "1週"
      : rangeKey === "3M"
      ? "3月"
      : rangeKey === "6M"
      ? "半年"
      : rangeKey === "1Y"
      ? "1年"
      : rangeKey === "2Y"
      ? "2年"
      : "5年";

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: "top" },
      title: {
        display: true,
        text:
          historical.length > 0
            ? `${historical[0].stockName} 股價圖表（顯示：${rangeLabel}）`
            : "股價圖表"
      }
    }
  };

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>📈 股票分析系統</h1>

      {/* ===================== */}
      {/* 📥 資料取得（筆數/區間保留：顯示整份 historical） */}
      {/* ===================== */}
      <div style={styles.card}>
        <h2 style={styles.sectionTitle}>📥 資料取得</h2>

        <div style={styles.controlRow}>
          <select
            value={stockNo}
            onChange={(e) => setStockNo(e.target.value)}
            style={styles.select}
          >
            {stockList.map((company) => (
              <option key={company.stockNo} value={company.stockNo}>
                {company.stockNo} - {company.stockName}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{ ...styles.select, maxWidth: "150px" }}
          />

          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{ ...styles.select, maxWidth: "150px" }}
          />

          <button style={styles.button} onClick={fetchStockManualRange}>
            抓資料
          </button>
        </div>

        {historical.length > 0 && (
          <div style={styles.infoRow}>
            📊 筆數：{historical.length}　
            📅 區間：{historical[0].date} ~ {historical.at(-1).date}
          </div>
        )}
      </div>

      {/* ===================== */}
      {/* 🚦 進出評估 */}
      {/* ===================== */}
      <div style={styles.card}>
        <h2 style={styles.sectionTitle}>🚦 進出評估</h2>

        <button
          style={{ ...styles.button, background: "#dc2626" }}
          onClick={evaluateTiming}
          disabled={timingLoading}
        >
          {timingLoading ? "評估中..." : "評估進出"}
        </button>

        {timing && (
          <div style={styles.metricRow}>
            <div>{REASON_TEXT[timing.reason] || REASON_TEXT.evaluate_failed}</div>
            {timing.passed && (
              <div>
                目前：{timing.currentSignal === "long" ? "持有" : "空手"}
              </div>
            )}
            {[
              "passed",
              "after_cost_underperformed_buy_hold",
              "too_few_round_trips"
            ].includes(timing.reason) && (
              <>
                <div>策略 NAV：{timing.metrics?.strategyEndNav ?? "-"}</div>
                <div>持有 NAV：{timing.metrics?.buyHoldEndNav ?? "-"}</div>
                <div>交易次數：{timing.metrics?.roundTrips ?? "-"}</div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ===================== */}
      {/* 📊 股價圖表（filter 放這裡） */}
      {/* ===================== */}
      <div style={styles.card}>
        <div style={styles.chartHeaderRow}>
          <div style={styles.chartTitle}>📊 股價圖表</div>

          <div style={styles.rangeRow}>
            {[
              ["1W", "1週"],
              ["3M", "3月"],
              ["6M", "半年"],
              ["1Y", "1年"],
              ["2Y", "2年"],
              ["5Y", "5年"],
              ["ALL", "全部"]
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setRangeKey(key)}
                style={{
                  ...styles.rangeBtn,
                  ...(rangeKey === key ? styles.rangeBtnActive : {})
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {displayHistorical.length > 0 && (
          <div style={styles.chartInfo}>
            顯示區間：{displayHistorical[0].date} ~{" "}
            {displayHistorical.at(-1).date}（{displayHistorical.length} 筆）
          </div>
        )}

        <Line data={chartData} options={chartOptions} />
      </div>
    </div>
  );
}

export default App;

// =====================
// styles
// =====================
const styles = {
  page: {
    minHeight: "100vh",
    background: "#f3f4f6",
    padding: "40px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "20px"
  },
  title: {
    fontSize: "32px",
    fontWeight: "bold"
  },
  sectionTitle: {
    fontSize: "20px",
    fontWeight: "bold",
    marginBottom: "12px"
  },
  card: {
    background: "#ffffff",
    borderRadius: "12px",
    padding: "20px",
    width: "100%",
    maxWidth: "900px",
    boxShadow: "0 10px 25px rgba(0,0,0,0.08)"
  },
  controlRow: {
    display: "flex",
    gap: "12px",
    alignItems: "center",
    flexWrap: "wrap"
  },
  select: {
    padding: "10px 12px",
    fontSize: "16px",
    borderRadius: "8px",
    border: "1px solid #d1d5db",
    flex: 1,
    minWidth: "180px"
  },
  button: {
    padding: "10px 18px",
    fontSize: "16px",
    borderRadius: "8px",
    border: "none",
    background: "#2563eb",
    color: "#ffffff",
    cursor: "pointer"
  },
  infoRow: {
    marginTop: "10px",
    color: "#374151",
    fontSize: "14px"
  },
  metricRow: {
    marginTop: "16px",
    display: "flex",
    gap: "20px",
    flexWrap: "wrap"
  },

  // 圖表 header
  chartHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "10px",
    marginBottom: "8px"
  },
  chartTitle: {
    fontSize: "18px",
    fontWeight: "bold"
  },
  chartInfo: {
    marginBottom: "10px",
    color: "#374151",
    fontSize: "14px"
  },

  // range filter styles
  rangeRow: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap"
  },
  rangeBtn: {
    padding: "6px 10px",
    borderRadius: "999px",
    border: "1px solid #d1d5db",
    background: "#ffffff",
    cursor: "pointer",
    fontSize: "14px"
  },
  rangeBtnActive: {
    border: "1px solid #2563eb",
    background: "#2563eb",
    color: "#ffffff"
  }
};
