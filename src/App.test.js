import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

let mockChartTrades;
let mockTimingResponse;
let historyRows;
let mockLeaderboardResponse;

jest.mock("./CandleChart", () => ({
  CandleChart: ({ trades }) => {
    mockChartTrades = trades;
    return <div data-testid="stock-chart" />;
  }
}));

function barDate(i) {
  const d = new Date(2020, 0, 2 + i);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

beforeEach(() => {
  mockChartTrades = undefined;
  historyRows = [];
  mockLeaderboardResponse = { updatedAt: null, items: [] };
  mockTimingResponse = {
    passed: false,
    reason: "after_cost_underperformed_buy_hold",
    metrics: {
      strategyEndNav: 0.9,
      buyHoldEndNav: 1.2,
      roundTrips: 4
    },
    trades: [{ date: "2020/01/03", side: "buy" }],
    currentSignal: null
  };
  global.fetch = jest.fn((url, options = {}) => {
    const u = String(url);
    if (u.includes("/api/stock-history")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(historyRows)
      });
    }
    if (u.includes("/api/manual/fetch-month")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ twseOk: true, upserted: 1, stockName: "台積電" })
      });
    }
    if (u.includes("/api/timing/evaluate")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockTimingResponse)
      });
    }
    if (u.includes("/api/company/search")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    }
    if (u.includes("/api/timing/leaderboard")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockLeaderboardResponse)
      });
    }
    if (u.includes("/api/timing/evaluate-batch")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ items: [] }) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

test("empty ticker shows five-year fetch and no date inputs", async () => {
  render(<App />);
  expect(await screen.findByRole("button", { name: /抓近五年/ })).toBeInTheDocument();
  expect(document.querySelector('input[type="date"]')).toBeNull();
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
});

test("entering a ticker loads that stock history", async () => {
  historyRows = [
    {
      stockNo: "2330",
      stockName: "台積電",
      date: "2020/01/02",
      openPrice: 100,
      highPrice: 101,
      lowPrice: 99,
      closePrice: 100,
      volume: 1
    }
  ];
  render(<App />);
  const input = screen.getByLabelText(/代號/);
  await userEvent.type(input, "2330{enter}");
  await screen.findByText("台積電");
  expect(global.fetch).toHaveBeenCalledWith("/api/stock-history?stockNo=2330");
  expect(global.fetch.mock.calls.some(([url]) => String(url).includes("/api/company/all"))).toBe(false);
});

test("failed gate shows reason and does not pass trades to the chart", async () => {
  historyRows = Array.from({ length: 627 }, (_, i) => ({
    stockNo: "2330",
    stockName: "台積電",
    date: barDate(i),
    openPrice: 100,
    highPrice: 101,
    lowPrice: 99,
    closePrice: 100 + i,
    volume: 1
  }));
  render(<App />);
  await userEvent.type(screen.getByLabelText(/代號/), "2330{enter}");
  await screen.findByText("台積電");
  await userEvent.click(await screen.findByRole("button", { name: /評估進出/ }));
  await waitFor(() => {
    expect(screen.getByText(/不提供進出建議/)).toBeInTheDocument();
  });
  expect(screen.queryByText(/下一根開盤才算/)).not.toBeInTheDocument();
  expect(screen.queryByText(/^空手/)).not.toBeInTheDocument();
  expect(mockChartTrades).toEqual([]);
});

test("insufficient data hides comparison metrics", async () => {
  mockTimingResponse = {
    passed: false,
    reason: "insufficient_data",
    metrics: { strategyEndNav: 0, buyHoldEndNav: 0, roundTrips: 0 },
    trades: [],
    currentSignal: null
  };
  historyRows = Array.from({ length: 627 }, (_, i) => ({
    stockNo: "2330",
    stockName: "台積電",
    date: barDate(i),
    closePrice: 100,
    openPrice: 100,
    highPrice: 100,
    lowPrice: 100,
    volume: 1
  }));
  render(<App />);
  await userEvent.type(screen.getByLabelText(/代號/), "2330{enter}");
  await userEvent.click(await screen.findByRole("button", { name: /評估進出/ }));
  await screen.findByText(/請先抓近五年日線/);
  expect(screen.queryByText(/策略 0/)).not.toBeInTheDocument();
  const detail = screen.getByTestId("timing-detail");
  expect(detail).toHaveTextContent("0.00");
  expect(detail).toHaveTextContent("0");
});

function ohlcvBar(i, extra = {}) {
  return {
    stockNo: "2330",
    stockName: "台積電",
    date: barDate(i),
    openPrice: 100,
    highPrice: 101,
    lowPrice: 99,
    closePrice: 100,
    volume: 1,
    ...extra
  };
}

function yesterdaySlash() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

test("evaluate is disabled when history is shorter than 627 bars", async () => {
  historyRows = [
    {
      stockNo: "2330",
      stockName: "台積電",
      date: "2020/01/02",
      openPrice: 100,
      highPrice: 101,
      lowPrice: 99,
      closePrice: 100,
      volume: 1
    }
  ];
  render(<App />);
  await userEvent.type(screen.getByLabelText(/代號/), "2330{enter}");
  await screen.findByText("台積電");
  expect(screen.getByRole("button", { name: /評估進出/ })).toBeDisabled();
  expect(screen.getByText(/日線不足/)).toBeInTheDocument();
});

test("evaluate is disabled when raw length is 627 but valid ohlcv is below 627", async () => {
  historyRows = Array.from({ length: 627 }, (_, i) =>
    i === 0 ? ohlcvBar(i, { openPrice: null, highPrice: null, lowPrice: null, closePrice: null }) : ohlcvBar(i)
  );
  render(<App />);
  await userEvent.type(screen.getByLabelText(/代號/), "2330{enter}");
  await screen.findByText("台積電");
  expect(screen.getByRole("button", { name: /評估進出/ })).toBeDisabled();
  expect(screen.getByText(/日線不足/)).toBeInTheDocument();
});

test("non-ok fetch-month is a miss and does not parse the body", async () => {
  historyRows = [ohlcvBar(0, { date: yesterdaySlash() })];
  const monthJson = jest.fn(() => Promise.resolve("<html>error</html>"));
  global.fetch = jest.fn((url) => {
    const u = String(url);
    if (u.includes("/api/stock-history")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(historyRows) });
    }
    if (u.includes("/api/manual/fetch-month")) {
      return Promise.resolve({ ok: false, json: monthJson });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
  });
  render(<App />);
  await userEvent.type(screen.getByLabelText(/代號/), "2330{enter}");
  await screen.findByText("台積電");
  await userEvent.click(screen.getByRole("button", { name: /更新資料/ }));
  await waitFor(() => {
    expect(screen.getByRole("button", { name: /更新資料/ })).toBeEnabled();
  });
  expect(monthJson).not.toHaveBeenCalled();
  expect(screen.queryByText(/正在抓/)).not.toBeInTheDocument();
  expect(screen.getByText(/日線不足/)).toBeInTheDocument();
});

test("fetch-month throw sets a failure status and clears fetching", async () => {
  historyRows = [ohlcvBar(0, { date: yesterdaySlash() })];
  global.fetch = jest.fn((url) => {
    const u = String(url);
    if (u.includes("/api/stock-history")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(historyRows) });
    }
    if (u.includes("/api/manual/fetch-month")) {
      return Promise.reject(new Error("network"));
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
  });
  render(<App />);
  await userEvent.type(screen.getByLabelText(/代號/), "2330{enter}");
  await screen.findByText("台積電");
  await userEvent.click(screen.getByRole("button", { name: /更新資料/ }));
  await waitFor(() => {
    expect(screen.getByText(/抓取日線失敗/)).toBeInTheDocument();
  });
  expect(screen.queryByText(/正在抓/)).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /更新資料/ })).toBeEnabled();
});

test("ignores stale history response after a newer ticker submit", async () => {
  let finish2330;
  const rows2330 = [ohlcvBar(0, { stockName: "台積電" })];
  const rows2317 = [ohlcvBar(0, { stockNo: "2317", stockName: "鴻海" })];
  global.fetch = jest.fn((url) => {
    const u = String(url);
    if (u.includes("/api/stock-history?stockNo=2330")) {
      return new Promise((resolve) => {
        finish2330 = () =>
          resolve({ ok: true, json: () => Promise.resolve(rows2330) });
      });
    }
    if (u.includes("/api/stock-history?stockNo=2317")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(rows2317) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
  });
  render(<App />);
  const input = screen.getByLabelText(/代號/);
  await userEvent.type(input, "2330{enter}");
  await waitFor(() => expect(finish2330).toBeDefined());
  await userEvent.clear(input);
  await userEvent.type(input, "2317{enter}");
  await screen.findByText("鴻海");
  finish2330();
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
  });
  expect(screen.getByText("鴻海")).toBeInTheDocument();
  expect(screen.queryByText("台積電")).not.toBeInTheDocument();
});

test("ignores stale evaluate after a newer ticker submit", async () => {
  let finishEval;
  historyRows = Array.from({ length: 627 }, (_, i) => ohlcvBar(i));
  global.fetch = jest.fn((url, options = {}) => {
    const u = String(url);
    if (u.includes("/api/stock-history?stockNo=2330")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(historyRows) });
    }
    if (u.includes("/api/stock-history?stockNo=2317")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([ohlcvBar(0, { stockNo: "2317", stockName: "鴻海" })])
      });
    }
    if (u.includes("/api/timing/evaluate")) {
      return new Promise((resolve) => {
        finishEval = () =>
          resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                passed: true,
                reason: "passed",
                metrics: { strategyEndNav: 1.1, buyHoldEndNav: 1.0, roundTrips: 3 },
                trades: [{ date: "2020/01/03", side: "buy" }],
                currentSignal: "long"
              })
          });
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
  });
  render(<App />);
  await userEvent.type(screen.getByLabelText(/代號/), "2330{enter}");
  await screen.findByText("台積電");
  await userEvent.click(screen.getByRole("button", { name: /評估進出/ }));
  await waitFor(() => expect(finishEval).toBeDefined());
  const input = screen.getByLabelText(/代號/);
  await userEvent.clear(input);
  await userEvent.type(input, "2317{enter}");
  await screen.findByText("鴻海");
  finishEval();
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
  });
  expect(screen.getByText("鴻海")).toBeInTheDocument();
  expect(screen.queryByText(/下一根開盤才算/)).not.toBeInTheDocument();
});

test("passed strip rounds NAV to two decimals", async () => {
  mockTimingResponse = {
    passed: true,
    reason: "passed",
    metrics: {
      strategyEndNav: 0.9916320707917428,
      buyHoldEndNav: 0.8219793457767723,
      roundTrips: 67
    },
    trades: [],
    currentSignal: "long"
  };
  historyRows = Array.from({ length: 627 }, (_, i) => ohlcvBar(i));
  render(<App />);
  await userEvent.type(screen.getByLabelText(/代號/), "2330{enter}");
  await screen.findByText("台積電");
  await userEvent.click(await screen.findByRole("button", { name: /評估進出/ }));
  await screen.findByText(/策略 0\.99/);
  expect(screen.getByText(/持有 0\.82/)).toBeInTheDocument();
  expect(screen.getByText(/67 次/)).toBeInTheDocument();
  expect(screen.queryByText(/0\.991632/)).not.toBeInTheDocument();
});

test("leaderboard row selects stock and loads history", async () => {
  mockLeaderboardResponse = {
    updatedAt: "2026-09-10T00:00:00Z",
    items: [
      {
        stockNo: "2317",
        stockName: "鴻海",
        passed: true,
        metrics: { winRate: 0.6, strategyEndNav: 1.1 }
      }
    ]
  };
  historyRows = [
    {
      stockNo: "2317",
      stockName: "鴻海",
      date: "2020/01/02",
      openPrice: 100,
      highPrice: 101,
      lowPrice: 99,
      closePrice: 100,
      volume: 1
    }
  ];
  render(<App />);
  expect(await screen.findByText("鴻海")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /選 2317/ }));
  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith("/api/stock-history?stockNo=2317");
  });
  const quote = document.querySelector(".quote");
  expect(quote).toHaveTextContent("鴻海");
});

test("watch toggle persists in localStorage", async () => {
  localStorage.clear();
  historyRows = [
    {
      stockNo: "2330",
      stockName: "台積電",
      date: "2020/01/02",
      openPrice: 100,
      highPrice: 101,
      lowPrice: 99,
      closePrice: 100,
      volume: 1
    }
  ];
  render(<App />);
  await userEvent.type(screen.getByLabelText(/代號/), "2330{enter}");
  await screen.findByText("台積電");
  await userEvent.click(screen.getByRole("button", { name: /關注/ }));
  expect(JSON.parse(localStorage.getItem("stock-timing-watchlist"))).toEqual(["2330"]);
});

test("failed evaluate still shows metrics in timing-detail", async () => {
  mockTimingResponse = {
    passed: false,
    reason: "after_cost_underperformed_buy_hold",
    metrics: {
      winRate: 0.4,
      strategyEndNav: 0.9,
      buyHoldEndNav: 1.2,
      roundTrips: 4,
      recentReturn: -0.01
    },
    trades: [{ date: "2020/01/03", side: "buy", price: 10 }],
    currentSignal: null
  };
  historyRows = Array.from({ length: 627 }, (_, i) => ohlcvBar(i));
  render(<App />);
  await userEvent.type(screen.getByLabelText(/代號/), "2330{enter}");
  await screen.findByText("台積電");
  await userEvent.click(await screen.findByRole("button", { name: /評估進出/ }));
  const detail = screen.getByTestId("timing-detail");
  await waitFor(() => {
    expect(detail).toHaveTextContent("40%");
    expect(detail).toHaveTextContent("0.90");
  });
});
