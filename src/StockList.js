import { formatNav, formatWinRate } from "./formatters";

export function StockList({
  items,
  selectedStockNo,
  watched,
  onSelect,
  onToggleWatch,
  emptyText = "尚無資料"
}) {
  const watchedSet = watched instanceof Set ? watched : new Set(watched || []);
  if (!items || items.length === 0) {
    return <p className="list-empty">{emptyText}</p>;
  }
  return (
    <ul className="stock-list">
      {items.map((item) => {
        const active = item.stockNo === selectedStockNo;
        const isWatched = watchedSet.has(item.stockNo);
        return (
          <li key={item.stockNo} className={active ? "active" : ""}>
            <button
              type="button"
              className="stock-row"
              aria-label={`選 ${item.stockNo}`}
              onClick={() => onSelect(item.stockNo)}
            >
              <span className="code">{item.stockNo}</span>
              <span className="name">{item.stockName || ""}</span>
              <span className="metric">{formatWinRate(item.metrics?.winRate)}</span>
              <span className="metric">{formatNav(item.metrics?.strategyEndNav)}</span>
              <span className={item.passed ? "tag pass" : "tag"}>{item.passed ? "過" : "—"}</span>
            </button>
            <button
              type="button"
              className="watch-btn"
              aria-label={`關注 ${item.stockNo}`}
              aria-pressed={isWatched}
              onClick={() => onToggleWatch(item.stockNo)}
            >
              {isWatched ? "★" : "☆"}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
