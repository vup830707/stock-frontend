import { render, screen } from "@testing-library/react";
import { TimingDetail } from "./TimingDetail";

const bars = [
  { date: "2020/01/02", openPrice: 1, highPrice: 1, lowPrice: 1, closePrice: 1 },
  { date: "2020/01/03", openPrice: 1, highPrice: 1, lowPrice: 1, closePrice: 1 }
];

test("shows data status from historical without timing", () => {
  render(<TimingDetail timing={null} historical={bars} />);
  expect(screen.getByText(/有效日線/)).toBeInTheDocument();
  expect(screen.getByText(/2/)).toBeInTheDocument();
  expect(screen.getByText(/2020\/01\/02/)).toBeInTheDocument();
});

test("shows metrics and trades even when not passed", () => {
  render(
    <TimingDetail
      historical={bars}
      timing={{
        passed: false,
        reason: "after_cost_underperformed_buy_hold",
        currentSignal: null,
        metrics: {
          winRate: 0.4,
          strategyEndNav: 0.9,
          buyHoldEndNav: 1.1,
          roundTrips: 5,
          recentReturn: -0.02
        },
        trades: [{ date: "2020/01/02", side: "buy", price: 100 }]
      }}
    />
  );
  expect(screen.getByText("40%")).toBeInTheDocument();
  expect(screen.getByText("0.90")).toBeInTheDocument();
  expect(screen.getByText("-2.0%")).toBeInTheDocument();
  expect(screen.getByText("buy")).toBeInTheDocument();
  expect(screen.getByText("100")).toBeInTheDocument();
});

test("missing metrics show dash", () => {
  render(
    <TimingDetail
      historical={[]}
      timing={{ passed: true, reason: "passed", metrics: {}, trades: [], currentSignal: "long" }}
    />
  );
  expect(screen.getAllByText("-").length).toBeGreaterThan(0);
});
