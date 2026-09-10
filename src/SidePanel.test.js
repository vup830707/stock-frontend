import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SidePanel } from "./SidePanel";

jest.mock("./api/timingApi", () => ({
  fetchLeaderboard: jest.fn(),
  evaluateBatch: jest.fn(),
  searchCompanies: jest.fn()
}));

import { fetchLeaderboard, evaluateBatch, searchCompanies } from "./api/timingApi";

beforeEach(() => {
  fetchLeaderboard.mockResolvedValue({
    updatedAt: "2026-09-10T00:00:00Z",
    items: [
      {
        stockNo: "2330",
        stockName: "台積電",
        passed: true,
        metrics: { winRate: 0.7, strategyEndNav: 1.2 }
      }
    ]
  });
  evaluateBatch.mockResolvedValue({ items: [] });
  searchCompanies.mockResolvedValue([]);
});

test("loads leaderboard on mount and selects stock", async () => {
  const onSelect = jest.fn();
  render(
    <SidePanel
      selectedStockNo=""
      watched={[]}
      onSelect={onSelect}
      onToggleWatch={() => {}}
    />
  );
  expect(await screen.findByText("台積電")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /選 2330/ }));
  expect(onSelect).toHaveBeenCalledWith("2330");
});

test("watch tab requests evaluateBatch", async () => {
  evaluateBatch.mockResolvedValue({
    items: [
      {
        stockNo: "2317",
        stockName: "鴻海",
        passed: false,
        metrics: { winRate: 0.5, strategyEndNav: 1.0 }
      }
    ]
  });
  render(
    <SidePanel
      selectedStockNo=""
      watched={["2317"]}
      onSelect={() => {}}
      onToggleWatch={() => {}}
    />
  );
  await userEvent.click(screen.getByRole("tab", { name: /觀察/ }));
  await waitFor(() => expect(evaluateBatch).toHaveBeenCalledWith(["2317"]));
  expect(await screen.findByText("鴻海")).toBeInTheDocument();
});
