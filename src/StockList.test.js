import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StockList } from "./StockList";

const items = [
  {
    stockNo: "2330",
    stockName: "台積電",
    passed: true,
    metrics: { winRate: 0.62, strategyEndNav: 1.35 }
  }
];

test("renders win rate and nav; select and watch callbacks", async () => {
  const onSelect = jest.fn();
  const onToggleWatch = jest.fn();
  render(
    <StockList
      items={items}
      selectedStockNo=""
      watched={[]}
      onSelect={onSelect}
      onToggleWatch={onToggleWatch}
    />
  );
  expect(screen.getByText("2330")).toBeInTheDocument();
  expect(screen.getByText("台積電")).toBeInTheDocument();
  expect(screen.getByText("62%")).toBeInTheDocument();
  expect(screen.getByText("1.35")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /選 2330/ }));
  expect(onSelect).toHaveBeenCalledWith("2330");
  await userEvent.click(screen.getByRole("button", { name: /關注 2330/ }));
  expect(onToggleWatch).toHaveBeenCalledWith("2330");
});

test("shows emptyText when no items", () => {
  render(
    <StockList
      items={[]}
      selectedStockNo=""
      watched={[]}
      onSelect={() => {}}
      onToggleWatch={() => {}}
      emptyText="尚無資料"
    />
  );
  expect(screen.getByText("尚無資料")).toBeInTheDocument();
});
