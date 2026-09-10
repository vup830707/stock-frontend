import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

let mockLineData;
let mockTimingResponse;

jest.mock("react-chartjs-2", () => ({
  Line: ({ data }) => {
    mockLineData = data;
    return <div data-testid="stock-chart" />;
  }
}));

beforeEach(() => {
  mockLineData = null;
  mockTimingResponse = {
    passed: false,
    reason: "after_cost_underperformed_buy_hold",
    metrics: {
      strategyEndNav: 0.9,
      buyHoldEndNav: 1.2,
      roundTrips: 4,
      oosStart: "2022/01/01",
      oosEnd: "2025/01/01",
      barCount: 700
    },
    trades: [],
    currentSignal: null
  };
  global.fetch = jest.fn((url) => {
    if (String(url).includes("/api/company/all")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve([{ stockNo: "2330", stockName: "台積電" }])
      });
    }
    if (String(url).includes("/api/stock-history")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              stockNo: "2330",
              stockName: "台積電",
              date: "2020/01/02",
              closePrice: 100
            },
            {
              stockNo: "2330",
              stockName: "台積電",
              date: "2020/01/03",
              closePrice: 101
            }
          ])
      });
    }
    if (String(url).includes("/api/timing/evaluate")) {
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

test("failed gate shows reason and no current signal", async () => {
  render(<App />);
  await screen.findByText(/2330/);
  const button = await screen.findByRole("button", { name: /評估進出/ });
  await userEvent.click(button);
  await waitFor(() => {
    expect(screen.getByText(/不提供進出建議/)).toBeInTheDocument();
  });
  expect(screen.queryByText(/目前：持有/)).not.toBeInTheDocument();
  expect(screen.queryByText(/目前：空手/)).not.toBeInTheDocument();
  expect(mockLineData.datasets).toHaveLength(1);
});

test("insufficient data hides comparison metrics", async () => {
  mockTimingResponse = {
    passed: false,
    reason: "insufficient_data",
    metrics: {
      strategyEndNav: 0,
      buyHoldEndNav: 0,
      roundTrips: 0
    },
    trades: [],
    currentSignal: null
  };

  render(<App />);
  await screen.findByText(/2330/);
  await userEvent.click(
    await screen.findByRole("button", { name: /評估進出/ })
  );
  await screen.findByText(/資料不足/);

  expect(screen.queryByText(/策略 NAV/)).not.toBeInTheDocument();
  expect(screen.queryByText(/持有 NAV/)).not.toBeInTheDocument();
  expect(screen.queryByText(/交易次數/)).not.toBeInTheDocument();
});
