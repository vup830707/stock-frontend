import { fiveYearMonths, incrementalMonths, parseSlashDate } from "./fetchMonths";

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

test("parseSlashDate uses local calendar day not UTC", () => {
  const slash = parseSlashDate("2020/01/02");
  expect(slash.getFullYear()).toBe(2020);
  expect(slash.getMonth()).toBe(0);
  expect(slash.getDate()).toBe(2);
  expect(slash.getHours()).toBe(0);

  const dash = parseSlashDate("2020-12-31");
  expect(dash.getFullYear()).toBe(2020);
  expect(dash.getMonth()).toBe(11);
  expect(dash.getDate()).toBe(31);
  expect(dash.getHours()).toBe(0);
});
