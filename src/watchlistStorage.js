import { TICKER_RE } from "./fetchMonths";

export const WATCHLIST_KEY = "stock-timing-watchlist";

export function loadWatchlist() {
  try {
    const raw = localStorage.getItem(WATCHLIST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x) => typeof x === "string" && TICKER_RE.test(x));
  } catch {
    return [];
  }
}

export function saveWatchlist(stockNos) {
  const cleaned = (stockNos || []).filter((x) => typeof x === "string" && TICKER_RE.test(x));
  localStorage.setItem(WATCHLIST_KEY, JSON.stringify(cleaned));
}

export function toggleWatchlist(stockNo) {
  if (!TICKER_RE.test(stockNo)) return loadWatchlist();
  const current = loadWatchlist();
  const next = current.includes(stockNo)
    ? current.filter((x) => x !== stockNo)
    : [stockNo, ...current];
  saveWatchlist(next);
  return next;
}
