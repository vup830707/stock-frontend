import { useCallback, useEffect, useRef, useState } from "react";
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
  const [leaderboardError, setLeaderboardError] = useState("");
  const [watchError, setWatchError] = useState("");
  const watchRequestRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchLeaderboard();
        if (!cancelled) {
          setLeaderboardItems(data.items || []);
          setLeaderboardError("");
        }
      } catch {
        if (!cancelled) setLeaderboardError("排行載入失敗");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadWatchItems = useCallback(async () => {
    const requestId = ++watchRequestRef.current;
    if (!watched || watched.length === 0) {
      if (requestId === watchRequestRef.current) {
        setWatchItems([]);
        setWatchError("");
      }
      return;
    }
    try {
      const data = await evaluateBatch(watched);
      if (requestId !== watchRequestRef.current) return;
      setWatchItems(alignWatchItems(watched, data?.items));
      setWatchError("");
    } catch {
      if (requestId !== watchRequestRef.current) return;
      setWatchItems(watched.map((stockNo) => ({ stockNo })));
      setWatchError("觀察清單載入失敗");
    }
  }, [watched]);

  useEffect(() => {
    loadWatchItems();
  }, [loadWatchItems]);

  const prevTabRef = useRef(tab);
  useEffect(() => {
    if (tab === "watch" && prevTabRef.current !== "watch") {
      loadWatchItems();
    }
    prevTabRef.current = tab;
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
        <>
          {leaderboardError && <p className="side-panel-error">{leaderboardError}</p>}
          <StockList items={leaderboardItems} emptyText="尚無排行資料" {...listProps} />
        </>
      )}
      {tab === "watch" && (
        <>
          {watchError && <p className="side-panel-error">{watchError}</p>}
          <StockList items={watchItems} emptyText="尚無觀察" {...listProps} />
        </>
      )}
      {tab === "search" && (
        <StockList items={searchItems} emptyText="尚無搜尋結果" {...listProps} />
      )}
    </aside>
  );
}
