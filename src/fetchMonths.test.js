import { fiveYearMonths, incrementalMonths } from "./fetchMonths";

test("fiveYearMonths covers calendar five years inclusive", () => {
  const months = fiveYearMonths(new Date(2026, 8, 10));
  expect(months[0]).toBe("202109");
  expect(months.at(-1)).toBe("202609");
  expect(months).toHaveLength(61);
});

test("incrementalMonths starts at month of the day after last bar", () => {
  const months = incrementalMonths(new Date(2026, 7, 31), new Date(2026, 8, 10));
  expect(months[0]).toBe("202609");
  expect(months.at(-1)).toBe("202609");
});

test("incrementalMonths is empty when last bar is today", () => {
  expect(incrementalMonths(new Date(2026, 8, 10), new Date(2026, 8, 10))).toEqual([]);
});
