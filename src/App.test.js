import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

let mockChartTrades;
let mockTimingResponse;
let historyRows;

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
    if (u.includes("/api/company/all")) {
      return Promise.reject(new Error("company list should not be called"));
    }
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
});

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
