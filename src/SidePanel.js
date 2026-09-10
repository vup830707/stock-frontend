import { useCallback, useEffect, useState } from "react";
import { fetchLeaderboard, evaluateBatch } from "./api/timingApi";
import { CompanySearch } from "./CompanySearch";
import { StockList } from "./StockList";

function alignWatchItems(watched, batchItems) {
  const byNo = new Map((batchItems || []).map((item) => [item.stockNo, item]));
  return watched.map((stockNo) => byNo.get(stockNo) || { stockNo });
}

export function SidePanel({ selectedStockNo, watched, onSelect, onToggleWatch }) {
  const [tab, setTab] = useState("leaderboard");
  const [leaderboardItems, setLeaderboardItems] = useState([]);
  const [watchItems, setWatchItems] = useState([]);
  const [searchItems, setSearchItems] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchLeaderboard();
        if (!cancelled) {
          setLeaderboardItems(data.items || []);
          setError("");
        }
      } catch {
        if (!cancelled) setError("排行載入失敗");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadWatchItems = useCallback(async () => {
    if (!watched || watched.length === 0) {
      setWatchItems([]);
      return;
    }
    try {
      const data = await evaluateBatch(watched);
      setWatchItems(alignWatchItems(watched, data?.items));
      setError("");
    } catch {
      setWatchItems(watched.map((stockNo) => ({ stockNo })));
      setError("觀察清單載入失敗");
    }
  }, [watched]);

  useEffect(() => {
    loadWatchItems();
  }, [loadWatchItems]);

  useEffect(() => {
    if (tab === "watch") {
      loadWatchItems();
    }
  }, [tab, loadWatchItems]);

  const handleSearchResults = (items) => {
    setSearchItems(items);
    if (items && items.length > 0) {
      setTab("search");
    }
  };

  const listProps = {
    selectedStockNo,
    watched,
    onSelect,
    onToggleWatch
  };

  return (
    <aside className="side-panel">
      <CompanySearch onResults={handleSearchResults} onPick={onSelect} />
      {error && <p className="side-panel-error">{error}</p>}
      <div role="tablist" className="side-panel-tabs">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "leaderboard"}
          onClick={() => setTab("leaderboard")}
        >
          排行
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "watch"}
          onClick={() => setTab("watch")}
        >
          觀察
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "search"}
          onClick={() => setTab("search")}
        >
          搜尋結果
        </button>
      </div>
      {tab === "leaderboard" && (
        <StockList items={leaderboardItems} emptyText="尚無排行資料" {...listProps} />
      )}
      {tab === "watch" && (
        <StockList items={watchItems} emptyText="尚無觀察" {...listProps} />
      )}
      {tab === "search" && (
        <StockList items={searchItems} emptyText="尚無搜尋結果" {...listProps} />
      )}
    </aside>
  );
}
