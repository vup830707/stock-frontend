import { act, render, screen, waitFor } from "@testing-library/react";
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

test("leaderboard error is not cleared by successful watch batch", async () => {
  fetchLeaderboard.mockRejectedValue(new Error("fail"));
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
  expect(await screen.findByText("排行載入失敗")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("tab", { name: /觀察/ }));
  expect(await screen.findByText("鴻海")).toBeInTheDocument();
  expect(screen.queryByText("排行載入失敗")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("tab", { name: /排行/ }));
  expect(screen.getByText("排行載入失敗")).toBeInTheDocument();
});

test("watch error is not cleared by successful leaderboard fetch", async () => {
  evaluateBatch.mockRejectedValue(new Error("fail"));
  render(
    <SidePanel
      selectedStockNo=""
      watched={["2317"]}
      onSelect={() => {}}
      onToggleWatch={() => {}}
    />
  );
  expect(await screen.findByText("台積電")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("tab", { name: /觀察/ }));
  expect(await screen.findByText("觀察清單載入失敗")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("tab", { name: /排行/ }));
  expect(screen.getByText("台積電")).toBeInTheDocument();
  expect(screen.queryByText("觀察清單載入失敗")).not.toBeInTheDocument();
});

test("watch tab does not double-fetch when watched changes while active", async () => {
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
  const { rerender } = render(
    <SidePanel
      selectedStockNo=""
      watched={["2317"]}
      onSelect={() => {}}
      onToggleWatch={() => {}}
    />
  );
  await userEvent.click(screen.getByRole("tab", { name: /觀察/ }));
  await waitFor(() => expect(evaluateBatch).toHaveBeenCalledTimes(2));
  evaluateBatch.mockClear();
  rerender(
    <SidePanel
      selectedStockNo=""
      watched={["2317", "2330"]}
      onSelect={() => {}}
      onToggleWatch={() => {}}
    />
  );
  await waitFor(() => expect(evaluateBatch).toHaveBeenCalledTimes(1));
  expect(evaluateBatch).toHaveBeenCalledWith(["2317", "2330"]);
});

test("ignores stale watch batch after watched changes", async () => {
  let finishFirst;
  evaluateBatch.mockImplementation((codes) => {
    if (codes[0] === "2330") {
      return new Promise((resolve) => {
        finishFirst = () =>
          resolve({
            items: [
              {
                stockNo: "2330",
                stockName: "台積電",
                passed: true,
                metrics: { winRate: 0.7, strategyEndNav: 1.2 }
              }
            ]
          });
      });
    }
    return Promise.resolve({
      items: [
        {
          stockNo: "2317",
          stockName: "鴻海",
          passed: false,
          metrics: { winRate: 0.5, strategyEndNav: 1.0 }
        }
      ]
    });
  });
  const { rerender } = render(
    <SidePanel
      selectedStockNo=""
      watched={["2330"]}
      onSelect={() => {}}
      onToggleWatch={() => {}}
    />
  );
  await waitFor(() => expect(finishFirst).toBeDefined());
  rerender(
    <SidePanel
      selectedStockNo=""
      watched={["2317"]}
      onSelect={() => {}}
      onToggleWatch={() => {}}
    />
  );
  await userEvent.click(screen.getByRole("tab", { name: /觀察/ }));
  expect(await screen.findByText("鴻海")).toBeInTheDocument();
  finishFirst();
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
  });
  expect(screen.getByText("鴻海")).toBeInTheDocument();
  expect(screen.queryByText("台積電")).not.toBeInTheDocument();
});
