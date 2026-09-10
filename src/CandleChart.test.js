import { render } from "@testing-library/react";
import { CandleChart } from "./CandleChart";

const mockSetData = jest.fn();
const mockSetMarkers = jest.fn();
const mockRemove = jest.fn();

jest.mock("lightweight-charts", () => ({
  createChart: () => ({
    addCandlestickSeries: () => ({ setData: mockSetData, setMarkers: mockSetMarkers }),
    timeScale: () => ({ fitContent: jest.fn() }),
    remove: mockRemove
  })
}));

beforeEach(() => {
  mockSetData.mockClear();
  mockSetMarkers.mockClear();
});

test("maps slash dates and passed trades to markers", () => {
  render(
    <CandleChart
      bars={[
        {
          date: "2024/01/02",
          openPrice: 1,
          highPrice: 2,
          lowPrice: 0.5,
          closePrice: 1.5
        }
      ]}
      trades={[{ date: "2024/01/02", side: "buy" }]}
    />
  );
  expect(mockSetData).toHaveBeenCalledWith([
    { time: "2024-01-02", open: 1, high: 2, low: 0.5, close: 1.5 }
  ]);
  expect(mockSetMarkers).toHaveBeenCalledWith([
    expect.objectContaining({ time: "2024-01-02", text: "買", position: "belowBar" })
  ]);
});
