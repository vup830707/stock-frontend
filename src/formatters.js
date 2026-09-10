export function formatNav(n) {
  if (n == null) return "-";
  const value = Number(n);
  return Number.isFinite(value) ? value.toFixed(2) : "-";
}

export function formatWinRate(n) {
  if (n == null) return "-";
  const value = Number(n);
  if (!Number.isFinite(value)) return "-";
  return `${Math.round(value * 100)}%`;
}

export function formatPct(n) {
  if (n == null) return "-";
  const value = Number(n);
  if (!Number.isFinite(value)) return "-";
  const pct = value * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}
