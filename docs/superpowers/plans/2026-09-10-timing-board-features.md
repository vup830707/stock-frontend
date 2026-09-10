# Timing Board Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在現有進出評估看板上加入公司搜尋、全市場排行、本機觀察清單、以及單檔評估詳情（勝率／近期／交易／資料狀態）。

**Architecture:** 維持單頁 CRA、無 router。兩欄版面：左欄 `SidePanel`（搜尋＋排行／觀察／搜尋結果），右欄沿用圖表流程並加 `TimingDetail`。API 薄封裝於 `src/api/`；觀察清單只寫 `localStorage`。後端未就緒時各列表降級，不擋圖表。

**Tech Stack:** React 18、Create React App、Jest + Testing Library、`lightweight-charts`（既有）、無新依賴。

**Spec:** `docs/superpowers/specs/2026-09-10-timing-board-features-design.md`

## Global Constraints

- 觀察清單 key：`stock-timing-watchlist`，值為 `string[]`（四碼 stockNo）
- K 線買賣標記：僅 `timing.passed === true` 時傳入 trades（不變）
- 詳情區：無論 passed／fail 都顯示 metrics（缺欄位顯示 `-`）
- 列表主指標：勝率；次：策略 NAV
- 測試指令：`CI=true npm test -- --watchAll=false`（或針對單檔）
- 文案維持繁體中文；不引入 router、不恢復 LSTM UI
- 每個 task 結束後 commit；分支：`cursor/timing-board-features-0808`

---

## File map

| Path | Role |
|------|------|
| Create `src/api/timingApi.js` | `searchCompanies`, `fetchLeaderboard`, `evaluateTiming`, `evaluateBatch` |
| Create `src/api/timingApi.test.js` | API 單元測試 |
| Create `src/watchlistStorage.js` | localStorage 讀寫 |
| Create `src/watchlistStorage.test.js` | 儲存測試 |
| Create `src/formatters.js` | `formatNav`, `formatWinRate`, `formatPct` |
| Create `src/formatters.test.js` | 格式化測試 |
| Create `src/TimingDetail.js` | 單檔詳情 UI |
| Create `src/TimingDetail.test.js` | 詳情測試 |
| Create `src/StockList.js` | 共用列表 |
| Create `src/StockList.test.js` | 列表測試 |
| Create `src/CompanySearch.js` | 防抖搜尋 |
| Create `src/CompanySearch.test.js` | 搜尋測試 |
| Create `src/SidePanel.js` | 左欄分頁容器 |
| Create `src/SidePanel.test.js` | 分頁／資料載入測試 |
| Modify `src/App.js` | 兩欄編排、關注、選股、詳情 |
| Modify `src/App.css` | 兩欄＋手機抽屜＋詳情樣式 |
| Modify `src/App.test.js` | 更新舊斷言、補整合測試 |

---

### Task 1: API 薄封裝

**Files:**
- Create: `src/api/timingApi.js`
- Test: `src/api/timingApi.test.js`

**Interfaces:**
- Consumes: 瀏覽器 `fetch`
- Produces:
  - `searchCompanies(q: string): Promise<{stockNo: string, stockName: string}[]>`
  - `fetchLeaderboard({ sort?: string, limit?: number } = {}): Promise<{ updatedAt: string|null, items: LeaderboardItem[] }>`
  - `evaluateTiming(stockNo: string): Promise<object>`（原 evaluate JSON）
  - `evaluateBatch(stockNos: string[]): Promise<{ items: LeaderboardItem[] }>`
  - LeaderboardItem：`{ stockNo, stockName, passed, currentSignal, metrics }`

- [ ] **Step 1: Write the failing test**

```js
// src/api/timingApi.test.js
import {
  searchCompanies,
  fetchLeaderboard,
  evaluateTiming,
  evaluateBatch
} from "./timingApi";

afterEach(() => {
  jest.restoreAllMocks();
});

test("searchCompanies hits /api/company/search and returns json array", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => [{ stockNo: "2330", stockName: "台積電" }]
  });
  await expect(searchCompanies("台積")).resolves.toEqual([
    { stockNo: "2330", stockName: "台積電" }
  ]);
  expect(global.fetch).toHaveBeenCalledWith("/api/company/search?q=%E5%8F%B0%E7%A9%8D");
});

test("searchCompanies returns [] when response not ok", async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, json: async () => [] });
  await expect(searchCompanies("x")).resolves.toEqual([]);
});

test("fetchLeaderboard passes sort and limit", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ updatedAt: "2026-09-10T00:00:00Z", items: [] })
  });
  await fetchLeaderboard({ sort: "winRate", limit: 50 });
  expect(global.fetch).toHaveBeenCalledWith(
    "/api/timing/leaderboard?sort=winRate&limit=50"
  );
});

test("fetchLeaderboard returns empty shape when not ok", async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false });
  await expect(fetchLeaderboard()).resolves.toEqual({ updatedAt: null, items: [] });
});

test("evaluateTiming posts stockNo", async () => {
  const body = { passed: true, metrics: {}, trades: [], currentSignal: "long", reason: "passed" };
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => body });
  await expect(evaluateTiming("2330")).resolves.toEqual(body);
  expect(global.fetch).toHaveBeenCalledWith("/api/timing/evaluate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stockNo: "2330" })
  });
});

test("evaluateBatch posts stockNos", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ items: [{ stockNo: "2330" }] })
  });
  await expect(evaluateBatch(["2330"])).resolves.toEqual({ items: [{ stockNo: "2330" }] });
  expect(global.fetch).toHaveBeenCalledWith("/api/timing/evaluate-batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stockNos: ["2330"] })
  });
});

test("evaluateBatch returns { items: [] } when not ok", async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false });
  await expect(evaluateBatch(["2330"])).resolves.toEqual({ items: [] });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `CI=true npm test -- --watchAll=false src/api/timingApi.test.js`

Expected: FAIL（module not found）

- [ ] **Step 3: Write minimal implementation**

```js
// src/api/timingApi.js
export async function searchCompanies(q) {
  const res = await fetch(`/api/company/search?q=${encodeURIComponent(q)}`);
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function fetchLeaderboard({ sort = "winRate", limit = 50 } = {}) {
  const res = await fetch(
    `/api/timing/leaderboard?sort=${encodeURIComponent(sort)}&limit=${limit}`
  );
  if (!res.ok) return { updatedAt: null, items: [] };
  const data = await res.json();
  return {
    updatedAt: data?.updatedAt ?? null,
    items: Array.isArray(data?.items) ? data.items : []
  };
}

export async function evaluateTiming(stockNo) {
  const res = await fetch("/api/timing/evaluate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stockNo })
  });
  return res.json();
}

export async function evaluateBatch(stockNos) {
  const res = await fetch("/api/timing/evaluate-batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stockNos })
  });
  if (!res.ok) return { items: [] };
  const data = await res.json();
  return { items: Array.isArray(data?.items) ? data.items : [] };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `CI=true npm test -- --watchAll=false src/api/timingApi.test.js`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/api/timingApi.js src/api/timingApi.test.js
git commit -m "feat: add timing API client helpers"
```

---

### Task 2: 觀察清單 storage

**Files:**
- Create: `src/watchlistStorage.js`
- Test: `src/watchlistStorage.test.js`

**Interfaces:**
- Consumes: `localStorage`
- Produces:
  - `WATCHLIST_KEY = "stock-timing-watchlist"`
  - `loadWatchlist(): string[]`
  - `saveWatchlist(stockNos: string[]): void`
  - `toggleWatchlist(stockNo: string): string[]`（回傳新列表；已存在則移除，否則加到開頭；只接受 `/^\d{4}$/`）

- [ ] **Step 1: Write the failing test**

```js
import {
  WATCHLIST_KEY,
  loadWatchlist,
  saveWatchlist,
  toggleWatchlist
} from "./watchlistStorage";

beforeEach(() => {
  localStorage.clear();
});

test("loadWatchlist returns [] when empty", () => {
  expect(loadWatchlist()).toEqual([]);
});

test("save and load round-trip", () => {
  saveWatchlist(["2330", "2317"]);
  expect(loadWatchlist()).toEqual(["2330", "2317"]);
  expect(JSON.parse(localStorage.getItem(WATCHLIST_KEY))).toEqual(["2330", "2317"]);
});

test("toggle adds then removes", () => {
  expect(toggleWatchlist("2330")).toEqual(["2330"]);
  expect(toggleWatchlist("2317")).toEqual(["2317", "2330"]);
  expect(toggleWatchlist("2330")).toEqual(["2317"]);
});

test("toggle ignores invalid ticker", () => {
  expect(toggleWatchlist("ABC")).toEqual([]);
  expect(loadWatchlist()).toEqual([]);
});

test("loadWatchlist ignores corrupt json", () => {
  localStorage.setItem(WATCHLIST_KEY, "{");
  expect(loadWatchlist()).toEqual([]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `CI=true npm test -- --watchAll=false src/watchlistStorage.test.js`

Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```js
// src/watchlistStorage.js
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
```

- [ ] **Step 4: Run tests**

Run: `CI=true npm test -- --watchAll=false src/watchlistStorage.test.js`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/watchlistStorage.js src/watchlistStorage.test.js
git commit -m "feat: add localStorage watchlist helpers"
```

---

### Task 3: 顯示用 formatters

**Files:**
- Create: `src/formatters.js`
- Test: `src/formatters.test.js`

**Interfaces:**
- Produces:
  - `formatNav(n): string` — 兩位小數，非數字 → `"-"`
  - `formatWinRate(n): string` — `0.62` → `"62%"`；非數字 → `"-"`
  - `formatPct(n): string` — `0.08` → `"+8.0%"`、`-0.05` → `"-5.0%"`；非數字 → `"-"`

- [ ] **Step 1: Write failing tests**

```js
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
```

- [ ] **Step 2: Run — expect FAIL**

`CI=true npm test -- --watchAll=false src/formatters.test.js`

- [ ] **Step 3: Implement**

```js
// src/formatters.js
export function formatNav(n) {
  const value = Number(n);
  return Number.isFinite(value) ? value.toFixed(2) : "-";
}

export function formatWinRate(n) {
  const value = Number(n);
  if (!Number.isFinite(value)) return "-";
  return `${Math.round(value * 100)}%`;
}

export function formatPct(n) {
  const value = Number(n);
  if (!Number.isFinite(value)) return "-";
  const pct = value * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/formatters.js src/formatters.test.js
git commit -m "feat: add metric display formatters"
```

---

### Task 4: TimingDetail 元件

**Files:**
- Create: `src/TimingDetail.js`
- Test: `src/TimingDetail.test.js`

**Interfaces:**
- Consumes: `formatNav`, `formatWinRate`, `formatPct`；`MIN_EVALUATE_BARS`, `countValidOhlcv` from `fetchMonths`
- Props:
  - `timing: object|null`
  - `historical: array`（日線列，含 `date`）
- 顯示區塊：
  - 無 timing：只顯示資料狀態（有效根數、首末日、是否 ≥ `MIN_EVALUATE_BARS`）
  - 有 timing：勝率、策略 NAV、買進持有 NAV、回合、近期 `recentReturn`、可選 `maxDrawdown`；表格列出 `trades`（date／side／price）

- [ ] **Step 1: Write failing tests**

```js
import { render, screen } from "@testing-library/react";
import { TimingDetail } from "./TimingDetail";

const bars = [
  { date: "2020/01/02", openPrice: 1, highPrice: 1, lowPrice: 1, closePrice: 1 },
  { date: "2020/01/03", openPrice: 1, highPrice: 1, lowPrice: 1, closePrice: 1 }
];

test("shows data status from historical without timing", () => {
  render(<TimingDetail timing={null} historical={bars} />);
  expect(screen.getByText(/有效日線/)).toBeInTheDocument();
  expect(screen.getByText(/2/)).toBeInTheDocument();
  expect(screen.getByText(/2020\/01\/02/)).toBeInTheDocument();
});

test("shows metrics and trades even when not passed", () => {
  render(
    <TimingDetail
      historical={bars}
      timing={{
        passed: false,
        reason: "after_cost_underperformed_buy_hold",
        currentSignal: null,
        metrics: {
          winRate: 0.4,
          strategyEndNav: 0.9,
          buyHoldEndNav: 1.1,
          roundTrips: 5,
          recentReturn: -0.02
        },
        trades: [{ date: "2020/01/02", side: "buy", price: 100 }]
      }}
    />
  );
  expect(screen.getByText("40%")).toBeInTheDocument();
  expect(screen.getByText("0.90")).toBeInTheDocument();
  expect(screen.getByText("-2.0%")).toBeInTheDocument();
  expect(screen.getByText("buy")).toBeInTheDocument();
  expect(screen.getByText("100")).toBeInTheDocument();
});

test("missing metrics show dash", () => {
  render(
    <TimingDetail
      historical={[]}
      timing={{ passed: true, reason: "passed", metrics: {}, trades: [], currentSignal: "long" }}
    />
  );
  expect(screen.getAllByText("-").length).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

```jsx
// src/TimingDetail.js
import { formatNav, formatWinRate, formatPct } from "./formatters";
import { MIN_EVALUATE_BARS, countValidOhlcv } from "./fetchMonths";

export function TimingDetail({ timing, historical }) {
  const valid = countValidOhlcv(historical);
  const first = historical?.[0]?.date || "-";
  const last = historical?.at?.(-1)?.date || historical?.[historical.length - 1]?.date || "-";
  const enough = valid >= MIN_EVALUATE_BARS;
  const m = timing?.metrics;

  return (
    <div className="timing-detail" data-testid="timing-detail">
      <div className="detail-block">
        <h3>資料狀態</h3>
        <p>
          有效日線 {valid} 根 · {first} ～ {last} ·{" "}
          {enough ? "可評估" : `不足（需 ${MIN_EVALUATE_BARS}）`}
        </p>
      </div>
      {timing && (
        <>
          <div className="detail-block">
            <h3>評估指標</h3>
            <ul className="metrics">
              <li>勝率 {formatWinRate(m?.winRate)}</li>
              <li>策略 NAV {formatNav(m?.strategyEndNav)}</li>
              <li>買進持有 {formatNav(m?.buyHoldEndNav)}</li>
              <li>回合 {m?.roundTrips ?? "-"}</li>
              <li>近期 {formatPct(m?.recentReturn)}</li>
              {m?.maxDrawdown != null && (
                <li>最大回撤 {formatPct(m.maxDrawdown)}</li>
              )}
            </ul>
          </div>
          <div className="detail-block">
            <h3>買賣明細</h3>
            {(timing.trades || []).length === 0 ? (
              <p>無</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>日期</th>
                    <th>方向</th>
                    <th>價格</th>
                  </tr>
                </thead>
                <tbody>
                  {(timing.trades || []).map((t, i) => (
                    <tr key={`${t.date}-${t.side}-${i}`}>
                      <td>{t.date}</td>
                      <td>{t.side}</td>
                      <td>{t.price != null ? t.price : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/TimingDetail.js src/TimingDetail.test.js
git commit -m "feat: add TimingDetail panel"
```

---

### Task 5: StockList 元件

**Files:**
- Create: `src/StockList.js`
- Test: `src/StockList.test.js`

**Interfaces:**
- Props:
  - `items: LeaderboardItem[]`（至少 `stockNo`, `stockName?`, `passed?`, `metrics?`）
  - `selectedStockNo: string`
  - `watched: Set<string>|string[]`
  - `onSelect(stockNo: string): void`
  - `onToggleWatch(stockNo: string): void`
  - `emptyText?: string`

- [ ] **Step 1: Write failing tests**

```js
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StockList } from "./StockList";

const items = [
  {
    stockNo: "2330",
    stockName: "台積電",
    passed: true,
    metrics: { winRate: 0.62, strategyEndNav: 1.35 }
  }
];

test("renders win rate and nav; select and watch callbacks", async () => {
  const onSelect = jest.fn();
  const onToggleWatch = jest.fn();
  render(
    <StockList
      items={items}
      selectedStockNo=""
      watched={[]}
      onSelect={onSelect}
      onToggleWatch={onToggleWatch}
    />
  );
  expect(screen.getByText("2330")).toBeInTheDocument();
  expect(screen.getByText("台積電")).toBeInTheDocument();
  expect(screen.getByText("62%")).toBeInTheDocument();
  expect(screen.getByText("1.35")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /選 2330/ }));
  expect(onSelect).toHaveBeenCalledWith("2330");
  await userEvent.click(screen.getByRole("button", { name: /關注 2330/ }));
  expect(onToggleWatch).toHaveBeenCalledWith("2330");
});

test("shows emptyText when no items", () => {
  render(
    <StockList
      items={[]}
      selectedStockNo=""
      watched={[]}
      onSelect={() => {}}
      onToggleWatch={() => {}}
      emptyText="尚無資料"
    />
  );
  expect(screen.getByText("尚無資料")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

```jsx
// src/StockList.js
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
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/StockList.js src/StockList.test.js
git commit -m "feat: add StockList for side panel rows"
```

---

### Task 6: CompanySearch 元件

**Files:**
- Create: `src/CompanySearch.js`
- Test: `src/CompanySearch.test.js`

**Interfaces:**
- Consumes: `searchCompanies` from `./api/timingApi`
- Props:
  - `onResults(items: {stockNo, stockName}[]): void` — 每次搜尋完成呼叫（含空）
  - `onPick(stockNo: string): void` — 使用者從下拉點選
  - `disabled?: boolean`
- 行為：輸入 debounce 300ms；`q` trim 後長度 0 → 不打 API、`onResults([])`；長度 ≥ 1 才搜尋

- [ ] **Step 1: Write failing tests**

```js
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CompanySearch } from "./CompanySearch";

jest.mock("./api/timingApi", () => ({
  searchCompanies: jest.fn()
}));

import { searchCompanies } from "./api/timingApi";

beforeEach(() => {
  jest.useFakeTimers();
  searchCompanies.mockReset();
});

afterEach(() => {
  jest.useRealTimers();
});

test("debounced search calls API and onResults", async () => {
  searchCompanies.mockResolvedValue([{ stockNo: "2330", stockName: "台積電" }]);
  const onResults = jest.fn();
  const onPick = jest.fn();
  render(<CompanySearch onResults={onResults} onPick={onPick} />);
  await userEvent.type(screen.getByLabelText(/搜尋/), "台積", { delay: null });
  await act(async () => {
    jest.advanceTimersByTime(300);
  });
  await waitFor(() => expect(searchCompanies).toHaveBeenCalledWith("台積"));
  await waitFor(() =>
    expect(onResults).toHaveBeenCalledWith([{ stockNo: "2330", stockName: "台積電" }])
  );
  await userEvent.click(await screen.findByRole("option", { name: /2330 台積電/ }));
  expect(onPick).toHaveBeenCalledWith("2330");
});
```

注意：若 fake timers 與 user-event 衝突，改用 `waitFor` + 真實 timer（把 debounce 在測試中 mock 成 0），或：

```js
// 實作匯出 DEBOUNCE_MS = 300，測試用 jest.spyOn 難度高時改為：
jest.useRealTimers();
// 並在 waitFor timeout 設 1000
```

實作時優先讓測試穩定：`CompanySearch` 接受可選 `debounceMs = 300`，測試傳 `debounceMs={0}`。

調整後的測試：

```js
test("search with debounceMs 0", async () => {
  searchCompanies.mockResolvedValue([{ stockNo: "2330", stockName: "台積電" }]);
  const onResults = jest.fn();
  const onPick = jest.fn();
  render(<CompanySearch onResults={onResults} onPick={onPick} debounceMs={0} />);
  await userEvent.type(screen.getByLabelText(/搜尋/), "台積");
  await waitFor(() => expect(searchCompanies).toHaveBeenCalledWith("台積"));
  await waitFor(() =>
    expect(onResults).toHaveBeenCalledWith([{ stockNo: "2330", stockName: "台積電" }])
  );
  await userEvent.click(await screen.findByRole("option", { name: /2330 台積電/ }));
  expect(onPick).toHaveBeenCalledWith("2330");
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

```jsx
// src/CompanySearch.js
import { useEffect, useState } from "react";
import { searchCompanies } from "./api/timingApi";

export function CompanySearch({ onResults, onPick, disabled = false, debounceMs = 300 }) {
  const [q, setQ] = useState("");
  const [options, setOptions] = useState([]);

  useEffect(() => {
    const trimmed = q.trim();
    if (!trimmed) {
      setOptions([]);
      onResults([]);
      return undefined;
    }
    const t = setTimeout(async () => {
      const items = await searchCompanies(trimmed);
      setOptions(items);
      onResults(items);
    }, debounceMs);
    return () => clearTimeout(t);
  }, [q, debounceMs]); // onResults 不列入 deps：由父層用穩定 callback 或忽略 eslint

  return (
    <div className="company-search">
      <input
        aria-label="搜尋"
        placeholder="代號或名稱"
        value={q}
        disabled={disabled}
        onChange={(e) => setQ(e.target.value)}
      />
      {options.length > 0 && (
        <ul role="listbox" className="search-options">
          {options.map((o) => (
            <li key={o.stockNo}>
              <button
                type="button"
                role="option"
                onClick={() => {
                  onPick(o.stockNo);
                  setQ(`${o.stockNo} ${o.stockName || ""}`.trim());
                  setOptions([]);
                }}
              >
                {o.stockNo} {o.stockName}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

（實作時若 eslint 警告 `onResults` deps：用 ref 包 `onResults`／`onPick`，或在 effect 內呼叫前檢查 mounted。）

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/CompanySearch.js src/CompanySearch.test.js
git commit -m "feat: add debounced company search"
```

---

### Task 7: SidePanel 元件

**Files:**
- Create: `src/SidePanel.js`
- Test: `src/SidePanel.test.js`

**Interfaces:**
- Consumes: `fetchLeaderboard`, `evaluateBatch`；`CompanySearch`；`StockList`；`loadWatchlist`（僅測試／父層也可傳 watched）
- Props:
  - `selectedStockNo: string`
  - `watched: string[]`
  - `onSelect(stockNo: string): void`
  - `onToggleWatch(stockNo: string): void`
  - `searchItems: {stockNo, stockName}[]` — 由 App 從 CompanySearch.onResults 灌入，或 SidePanel 自管
- 建議：**SidePanel 自管**搜尋結果與分頁 state、開頁拉 leaderboard、watched 變化時拉 evaluateBatch
- 分頁：`排行`｜`觀察`｜`搜尋結果`；有搜尋結果時自動切到「搜尋結果」
- 觀察分頁：用 `watched` 當順序，把 `evaluateBatch` 回傳的 items 對齊；缺結果的代號仍列（metrics 空）

- [ ] **Step 1: Write failing tests**

```js
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SidePanel } from "./SidePanel";

jest.mock("./api/timingApi", () => ({
  fetchLeaderboard: jest.fn(),
  evaluateBatch: jest.fn(),
  searchCompanies: jest.fn()
}));

import { fetchLeaderboard, evaluateBatch, searchCompanies } from "./api/timingApi";

beforeEach(() => {
  fetchLeaderboard.mockResolvedValue({
    updatedAt: "2026-09-10T00:00:00Z",
    items: [
      {
        stockNo: "2330",
        stockName: "台積電",
        passed: true,
        metrics: { winRate: 0.7, strategyEndNav: 1.2 }
      }
    ]
  });
  evaluateBatch.mockResolvedValue({ items: [] });
  searchCompanies.mockResolvedValue([]);
});

test("loads leaderboard on mount and selects stock", async () => {
  const onSelect = jest.fn();
  render(
    <SidePanel
      selectedStockNo=""
      watched={[]}
      onSelect={onSelect}
      onToggleWatch={() => {}}
    />
  );
  expect(await screen.findByText("台積電")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /選 2330/ }));
  expect(onSelect).toHaveBeenCalledWith("2330");
});

test("watch tab requests evaluateBatch", async () => {
  evaluateBatch.mockResolvedValue({
    items: [
      {
        stockNo: "2317",
        stockName: "鴻海",
        passed: false,
        metrics: { winRate: 0.5, strategyEndNav: 1.0 }
      }
    ]
  });
  render(
    <SidePanel
      selectedStockNo=""
      watched={["2317"]}
      onSelect={() => {}}
      onToggleWatch={() => {}}
    />
  );
  await userEvent.click(screen.getByRole("tab", { name: /觀察/ }));
  await waitFor(() => expect(evaluateBatch).toHaveBeenCalledWith(["2317"]));
  expect(await screen.findByText("鴻海")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement SidePanel**

實作要點（完整檔案在實作時寫出）：
- state：`tab`（`leaderboard`｜`watch`｜`search`）、`leaderboardItems`、`watchItems`、`searchItems`、`error`
- mount：`fetchLeaderboard()`
- `watched` 變化或切到觀察：`evaluateBatch(watched)`；若失敗則 `watchItems = watched.map(stockNo => ({ stockNo }))`
- 內嵌 `CompanySearch`：`onResults` 設 searchItems 並 `setTab("search")`；`onPick` → `onSelect`
- 三個 `role="tab"` 按鈕＋對應 `StockList`

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/SidePanel.js src/SidePanel.test.js
git commit -m "feat: add SidePanel with leaderboard and watch tabs"
```

---

### Task 8: 整合 App 兩欄版面 + CSS

**Files:**
- Modify: `src/App.js`
- Modify: `src/App.css`
- Modify: `src/App.test.js`（本 task 只改會壞的舊測試；新整合測試在 Task 9）

**Interfaces:**
- Consumes: `SidePanel`, `TimingDetail`, `loadWatchlist`, `toggleWatchlist`, `formatNav`（改從 formatters 匯入）, `evaluateTiming`（可改走 api 模組）
- 行為：
  - 開頁 `watched = loadWatchlist()`
  - `selectStock(code)`：等同現有 Enter 提交流程（設 stockNo、載 history、清 timing）
  - 右欄報價旁關注鈕：`toggleWatchlist` + setState
  - 保留四碼 input（aria-label 仍「代號」）以相容既有測試；或把代號輸入改成搜尋並更新所有測試——**建議保留右欄代號 input**，左欄另有搜尋，舊測試少改
  - strip 邏輯可簡化：通過時仍短摘要；詳細看 TimingDetail；**fail 時 strip 仍顯示 reason**，但 TimingDetail 顯示 metrics（需改「insufficient data hides comparison metrics」測試：strip 可不顯示策略數字，詳情區要顯示）

- [ ] **Step 1: Update failing App tests first where behavior intentionally changes**

將 `test("insufficient data hides comparison metrics"...)` 改為：
- strip 仍只有 reason 文案
- `within(screen.getByTestId("timing-detail")).getByText(...)` 可見 NAV／回合（若 metrics 為 0 則顯示 `0.00`／`0`）

將「禁止 company/all」測試改為：載入時不強制打 company；搜尋才打 search（Task 9 覆蓋）。

刪除 `App.js` 內本地 `formatNav`，改：

```js
import { formatNav } from "./formatters";
```

`evaluateTiming` 可改：

```js
import { evaluateTiming as postEvaluate } from "./api/timingApi";
// ...
const data = await postEvaluate(code);
```

- [ ] **Step 2: Run existing App tests — note failures**

`CI=true npm test -- --watchAll=false src/App.test.js`

- [ ] **Step 3: Restructure App JSX**

```jsx
return (
  <div className="board">
    <button
      type="button"
      className="sidebar-toggle"
      aria-label="選股列表"
      onClick={() => setSidebarOpen((v) => !v)}
    >
      列表
    </button>
    <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
      <SidePanel
        selectedStockNo={stockNo}
        watched={watched}
        onSelect={(code) => {
          setDraft(code);
          selectStock(code); // 抽出原 submitTicker 邏輯，接受 code 參數
          setSidebarOpen(false);
        }}
        onToggleWatch={(code) => setWatched(toggleWatchlist(code))}
      />
    </aside>
    <main className="main">
      {/* 既有 header / range / chart / strip */}
      <button
        type="button"
        aria-label={watched.includes(stockNo) ? "取消關注" : "關注"}
        disabled={!TICKER_RE.test(stockNo)}
        onClick={() => setWatched(toggleWatchlist(stockNo))}
      >
        {watched.includes(stockNo) ? "★ 已關注" : "☆ 關注"}
      </button>
      <TimingDetail timing={timing} historical={historical} />
    </main>
  </div>
);
```

CSS 重點：
- `.board { display: flex; flex-direction: row; ... }` desktop
- `.sidebar { width: 320px; flex-shrink: 0; overflow: auto; }`
- `.main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 12px; }`
- `@media (max-width: 800px)`：sidebar 固定抽屜、預設關閉；`.sidebar-toggle` 顯示

- [ ] **Step 4: Run App tests — fix until green**

- [ ] **Step 5: Commit**

```bash
git add src/App.js src/App.css src/App.test.js
git commit -m "feat: wire two-column board with side panel and detail"
```

---

### Task 9: App 整合測試補強

**Files:**
- Modify: `src/App.test.js`

**Interfaces:**
- Mock `./api/timingApi` 或擴充 `global.fetch` 分支：
  - `/api/company/search`
  - `/api/timing/leaderboard`
  - `/api/timing/evaluate-batch`

- [ ] **Step 1: Write new tests**

```js
test("leaderboard row selects stock and loads history", async () => {
  // fetch mock: leaderboard returns 2317；history for 2317 returns name 鴻海
  // render App → find 鴻海 in side list → click 選 2317
  // expect stock-history?stockNo=2317 and screen 鴻海 in quote
});

test("watch toggle persists in localStorage", async () => {
  localStorage.clear();
  // load 2330 with history name
  // click 關注
  expect(JSON.parse(localStorage.getItem("stock-timing-watchlist"))).toEqual(["2330"]);
});

test("failed evaluate still shows metrics in timing-detail", async () => {
  mockTimingResponse = {
    passed: false,
    reason: "after_cost_underperformed_buy_hold",
    metrics: {
      winRate: 0.4,
      strategyEndNav: 0.9,
      buyHoldEndNav: 1.2,
      roundTrips: 4,
      recentReturn: -0.01
    },
    trades: [{ date: "2020/01/03", side: "buy", price: 10 }],
    currentSignal: null
  };
  // 627 bars, evaluate, expect detail 40% and 0.90
});
```

在 `beforeEach` 的 fetch mock 加上：

```js
if (u.includes("/api/company/search")) {
  return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
}
if (u.includes("/api/timing/leaderboard")) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ updatedAt: null, items: [] })
  });
}
if (u.includes("/api/timing/evaluate-batch")) {
  return Promise.resolve({ ok: true, json: () => Promise.resolve({ items: [] }) });
}
```

移除／改寫「company list should not be called」reject。

- [ ] **Step 2: Run full suite**

`CI=true npm test -- --watchAll=false`

Expected: all PASS

- [ ] **Step 3: Commit**

```bash
git add src/App.test.js
git commit -m "test: cover leaderboard select, watchlist, fail-path detail"
```

- [ ] **Step 4: Push and update PR**

```bash
git push -u origin cursor/timing-board-features-0808
```

---

## Self-review vs spec

| Spec 項目 | Task |
|-----------|------|
| 公司搜尋 | 1, 6, 7, 8 |
| 全市場排行 | 1, 7, 9 |
| 單檔詳情（勝率／近期／明細／資料狀態） | 3, 4, 8 |
| fail 也顯示 metrics | 4, 8, 9 |
| 觀察清單 localStorage | 2, 8, 9 |
| evaluate-batch 更新觀察 | 1, 7 |
| 兩欄＋手機抽屜 | 8 |
| K 線標記僅 passed | 8（保持現有 `chartTrades`） |
| 後端契約文件 | 已在 spec；本 plan 不改後端 |

**Placeholder scan:** 無 TBD；Task 7 Step 3 要求實作者寫完整 SidePanel 檔——實作時必須一次寫出完整元件而非「要點」略過。

**Type consistency:** `LeaderboardItem.metrics.winRate` / `strategyEndNav` / `recentReturn` 與 spec、formatters、TimingDetail、StockList 一致。

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-10-timing-board-features.md`.

**兩種執行方式：**

1. **Subagent-Driven（建議）** — 每個 task 派一個新 subagent，task 之間我做 review  
2. **Inline Execution** — 本會話依 executing-plans 連續做完，設檢查點  

要哪一種？
