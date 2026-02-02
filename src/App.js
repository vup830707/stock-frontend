import { useEffect, useState, useMemo } from "react";
import { Line } from "react-chartjs-2";
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

function App() {
  const [stockNo, setStockNo] = useState("");
  const [stockList, setStockList] = useState([]);
  const [historical, setHistorical] = useState([]);

  // LSTM 預測
  const [prediction, setPrediction] = useState(null);
  const [predictLoading, setPredictLoading] = useState(false);

  // 手動日期
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // ✅ 圖表顯示範圍（只影響圖表，不影響上方「筆數/區間」）
  const [rangeKey, setRangeKey] = useState("ALL"); // 1W,3M,6M,1Y,2Y,5Y,ALL

  const parseDate = (s) => new Date(s.replaceAll("/", "-"));

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
  const loadStockHistory = async (selectedStockNo) => {
    if (!selectedStockNo) return;

    // const res = await fetch(
    //   `http://localhost:8080/api/stock-history?stockNo=${selectedStockNo}`
    // );
    const res = await fetch(
      `/api/stock-history?stockNo=${selectedStockNo}`
    );
    const data = await res.json();

    const uniqueData = Array.from(
      new Map(data.map((item) => [item.date, item])).values()
    ).sort((a, b) => parseDate(a.date) - parseDate(b.date));

    setHistorical(uniqueData);
    setPrediction(null);
  };

  useEffect(() => {
    if (stockNo) loadStockHistory(stockNo);
  }, [stockNo]);

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

  // =====================
  // LSTM 預測（仍用整份 historical 的區間；圖表範圍不影響模型）
  // =====================
  const predictStock = async () => {
    if (!stockNo) return;
    if (historical.length === 0) {
      alert("目前沒有歷史資料可供預測");
      return;
    }

    const start = historical[0].date.replaceAll("/", "-");
    const end = historical.at(-1).date.replaceAll("/", "-");

    setPredictLoading(true);
    try {
      // const res = await fetch("http://localhost:5000/predict_future", {
      const res = await fetch("/ai/predict_future", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: stockNo,
          days: 1,
          startDate: start,
          endDate: end
        })
      });

      const data = await res.json();

      if (!data.historicalPredictions || data.historicalPredictions.length === 0) {
        alert("沒有可用的預測資料");
        return;
      }

      // ✅ 若後端沒回 testDates，提醒一下（避免你又回到猜20%）
      if (!data.testDates || data.testDates.length === 0) {
        console.warn("Backend did not return testDates. Alignment may be inaccurate.");
      }

      setPrediction({ ...data });
    } catch (err) {
      alert("LSTM 預測失敗");
    } finally {
      setPredictLoading(false);
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
  // ✅ 正確對齊：用後端回傳 testDates 精準塞到對應日期
  // （不再用倒數20%推算）
  // =====================
  const alignedPredictionsForChart = useMemo(() => {
    const dispLen = displayHistorical.length;
    if (dispLen === 0) return [];

    // 沒預測就回空（chart datasets 那邊會判斷）
    if (!prediction?.historicalPredictions?.length) {
      return Array(dispLen).fill(null);
    }

    const preds = prediction.historicalPredictions;
    const dates = prediction.testDates || [];

    // 建立 display 範圍內的 date -> index map
    const indexByDate = new Map(displayHistorical.map((h, i) => [h.date, i]));

    // 預設全 null
    const aligned = Array(dispLen).fill(null);

    // 用 testDates 對齊到 display 範圍
    const n = Math.min(preds.length, dates.length);
    for (let i = 0; i < n; i++) {
      const idx = indexByDate.get(dates[i]);
      if (idx != null) aligned[idx] = preds[i];
    }

    return aligned;
  }, [displayHistorical, prediction]);

  // =====================
  // 只是顯示用：訓練/回測筆數（以後端回傳預測長度為準）
  // =====================
  const { trainCount, testCount } = useMemo(() => {
    const totalAll = historical.length;
    const test = prediction?.historicalPredictions?.length ?? 0;
    const train = Math.max(totalAll - test, 0);
    return { trainCount: train, testCount: test };
  }, [historical, prediction]);

  // =====================
  // 圖表資料（用 displayHistorical）
  // =====================
  const chartData = useMemo(() => {
    return {
      labels: displayHistorical.map((item) => item.date),
      datasets: [
        {
          label: "歷史收盤價",
          data: displayHistorical.map((item) => item.closePrice),
          borderColor: "#2563eb",
          tension: 0.3
        },
        prediction?.historicalPredictions && {
          label: "LSTM 回測預測",
          data: alignedPredictionsForChart,
          borderColor: "#dc2626",
          borderDash: [6, 6],
          tension: 0.3,
          spanGaps: false // 遇到 null 不要連線
        }
      ].filter(Boolean)
    };
  }, [displayHistorical, prediction, alignedPredictionsForChart]);

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
      {/* 🧠 模型預測 */}
      {/* ===================== */}
      <div style={styles.card}>
        <h2 style={styles.sectionTitle}>🧠 模型訓練 / 預測</h2>

        <button
          style={{ ...styles.button, background: "#dc2626" }}
          onClick={predictStock}
          disabled={predictLoading}
        >
          {predictLoading ? "模型推論中..." : "📊 執行 LSTM 預測"}
        </button>

        {prediction && (
          <div style={styles.metricRow}>
            <div>
              🎯 Accuracy：
              {prediction.metrics?.accuracy != null
                ? Number(prediction.metrics.accuracy).toFixed(2)
                : "-"}
            </div>
            <div>
              📉 RMSE：
              {prediction.metrics?.rmse != null
                ? Number(prediction.metrics.rmse).toFixed(2)
                : "-"}
            </div>
            <div>
              📏 MAE：
              {prediction.metrics?.mae != null
                ? Number(prediction.metrics.mae).toFixed(2)
                : "-"}
            </div>

            {/* 額外顯示：train/test 只是參考 */}
            <div style={{ opacity: 0.85 }}>
              🧠 訓練：約 {trainCount}　📈 回測：{testCount}
            </div>
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
