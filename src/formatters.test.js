import { formatNav, formatWinRate, formatPct } from "./formatters";

test("formatNav", () => {
  expect(formatNav(1.234)).toBe("1.23");
  expect(formatNav(undefined)).toBe("-");
});

test("formatWinRate", () => {
  expect(formatWinRate(0.62)).toBe("62%");
  expect(formatWinRate(null)).toBe("-");
});

test("formatPct", () => {
  expect(formatPct(0.08)).toBe("+8.0%");
  expect(formatPct(-0.05)).toBe("-5.0%");
  expect(formatPct(NaN)).toBe("-");
});
