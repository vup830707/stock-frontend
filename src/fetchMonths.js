export const TICKER_RE = /^\d{4}$/;
export const FETCH_YEARS = 5;
export const MIN_EVALUATE_BARS = 627;
export const FETCH_GAP_MS = 200;

export function countValidOhlcv(rows) {
  if (!Array.isArray(rows)) return 0;
  return rows.filter((bar) =>
    Number.isFinite(bar?.openPrice)
    && Number.isFinite(bar?.highPrice)
    && Number.isFinite(bar?.lowPrice)
    && Number.isFinite(bar?.closePrice)
    && bar.openPrice > 0
    && bar.highPrice > 0
    && bar.lowPrice > 0
    && bar.closePrice > 0
  ).length;
}

export function toYearMonth(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}${m}`;
}

function monthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function monthsInclusive(fromDate, toDate) {
  const months = [];
  let cursor = monthStart(fromDate);
  const end = monthStart(toDate);
  while (cursor <= end) {
    months.push(toYearMonth(cursor));
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  return months;
}

export function fiveYearMonths(today) {
  const start = new Date(today.getFullYear() - FETCH_YEARS, today.getMonth(), 1);
  return monthsInclusive(start, today);
}

export function incrementalMonths(lastBarDate, today) {
  const next = new Date(lastBarDate.getFullYear(), lastBarDate.getMonth(), lastBarDate.getDate() + 1);
  if (next > today) return [];
  return monthsInclusive(next, today);
}

export function parseSlashDate(s) {
  const [year, month, day] = String(s).split(/[/-]/).map(Number);
  return new Date(year, month - 1, day);
}
