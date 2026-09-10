# 進出評估看板：搜尋、排行、觀察清單、單檔詳情

日期：2026-09-10  
專案：`stock-frontend`（後端在另一個專案依本契約實作）

## 目標

讓使用者不必背代號就能找股票，能從排行看出表現好的標的，鎖定後能看勝率與近期表現，並用本機觀察清單追蹤關注標的。

## 範圍（已確認）

1. **公司搜尋／自動完成**（代號或名稱）
2. **全市場排行**（後端批次評估結果）
3. **單檔詳情補強**：勝率、近期績效、交易明細、資料狀態（通過與否都顯示 metrics）
4. **觀察清單**：僅存瀏覽器 `localStorage`；可用 batch／逐檔 evaluate 更新狀態並排序

不做：登入／雲端同步觀察清單、成交量圖、LSTM 預測 UI。

## 版面（方案 1）

維持現有深色看板風格，改為兩欄。

### 左欄（約 320px）

- 上方：搜尋框（代號或名稱）
- 下方分頁：**排行**｜**觀察**｜**搜尋結果**
- 列表列：代號、名稱、**勝率**（主）、策略 NAV（次）、是否通過；可加入／取消關注
- 點一列 → 右側載入該檔

### 右欄

- 沿用：報價、抓近五年／更新、評估進出、區間、K 線、狀態列
- 報價旁：關注按鈕
- 下方 **詳情區**（`TimingDetail`）：勝率、策略／買進持有 NAV、回合數、近期表現、資料狀態（有效日線根數／日期區間／是否足夠評估）、買賣明細表
- K 線買賣標記：僅在 `passed === true` 時顯示（與現況一致）

### 手機

左欄改為可收合抽屜；預設先顯示右欄圖表。

## API 契約（後端另一專案）

前端依此實作；API 未就緒時該區塊降級（空列表／短錯誤），不阻擋既有圖表流程。

### 1. 公司搜尋

`GET /api/company/search?q={keyword}`

- `q`：代號或名稱片段
- 回應：`[{ "stockNo": "2330", "stockName": "台積電" }, ...]`（建議上限 30）
- 備案：若暫無 search，前端可改打 `GET /api/company/all` 再本地過濾

### 2. 全市場排行

`GET /api/timing/leaderboard?sort=winRate&limit=50`

```json
{
  "updatedAt": "2026-09-10T12:00:00Z",
  "items": [
    {
      "stockNo": "2330",
      "stockName": "台積電",
      "passed": true,
      "currentSignal": "long",
      "metrics": {
        "winRate": 0.62,
        "strategyEndNav": 1.35,
        "buyHoldEndNav": 1.20,
        "roundTrips": 40,
        "recentReturn": 0.08
      }
    }
  ]
}
```

- 預設 `sort=winRate` 降序；亦支援 `sort=strategyEndNav`
- `recentReturn`：近約 60 個交易日之策略報酬（後端實作時寫死定義即可）
- `currentSignal`：`"long"`｜其它／`null`（空手）

### 3. 單檔評估（擴充既有）

`POST /api/timing/evaluate` body：`{ "stockNo": "2330" }`

- **保留**既有：`passed`、`reason`、`trades`、`currentSignal`、`metrics.strategyEndNav`、`metrics.buyHoldEndNav`、`metrics.roundTrips`
- **新增** `metrics`：
  - `winRate`：0–1
  - `recentReturn`：近約 60 日策略報酬
  - `maxDrawdown`：可選
- `trades` 建議：`[{ "date": "2024/01/02", "side": "buy"|"sell", "price": 100.5 }]`（`price` 可選）
- **未通過門檻時仍應回傳** `metrics`／`trades`，供詳情區顯示

### 4. 觀察清單批次狀態（建議）

`POST /api/timing/evaluate-batch` body：`{ "stockNos": ["2330", "2317"] }`

- 回應 `items` 形狀與 leaderboard 的 `items` 相同
- 若無此 API：前端對觀察清單逐檔呼叫 `evaluate`

### 5. 不變

- `GET /api/stock-history?stockNo=`
- `POST /api/manual/fetch-month`

## 前端模組

| 模組 | 職責 |
|------|------|
| `App.js` | 兩欄版面、選中 `stockNo`、歷史／評估／抓資料編排 |
| `CompanySearch.js` | 防抖搜尋、選中回呼 |
| `SidePanel.js` | 排行／觀察／搜尋結果分頁 |
| `StockList.js` | 共用列表列 |
| `watchlistStorage.js` | localStorage 讀寫；key 固定為 `stock-timing-watchlist`，值為 `string[]`（stockNo） |
| `TimingDetail.js` | 單檔詳情區 |
| `api/*.js` | 薄封裝：search、leaderboard、evaluate、evaluateBatch |

## 資料流

1. 開頁：讀觀察清單 → 打 evaluate-batch（或逐檔）→ 拉 leaderboard
2. 搜尋：輸入防抖 → `company/search` → 切到「搜尋結果」
3. 選股：設 `stockNo` → 載入 history → 清空舊 timing；使用者按「評估進出」
4. 關注：只改 localStorage + UI
5. 詳情：evaluate 後無論 passed 都餵給 `TimingDetail`；缺欄位顯示 `-`

## 錯誤與降級

- search／leaderboard／batch 失敗：該區短訊息，不擋右欄
- 新 metrics 缺失：顯示 `-`，不 throw

## 測試重點

- 搜尋會呼叫 search（或 all + 過濾）；更新／移除「禁止打 company API」的舊斷言
- 關注寫入與重新載入後仍在
- fail 路徑詳情仍顯示 metrics
- 點 leaderboard 列會切換股票並載入 history

## 後端待辦（另一專案，摘要）

- [ ] `GET /api/company/search`（或確保 `/api/company/all` 可用）
- [ ] `GET /api/timing/leaderboard`
- [ ] 擴充 `POST /api/timing/evaluate` metrics；fail 也回 metrics
- [ ] （建議）`POST /api/timing/evaluate-batch`
- [ ] 批次排程：定期評估多檔並寫入排行資料

## 非目標

- 使用者帳號與雲端觀察清單
- 成交量副圖
- 恢復 LSTM／`/ai/` 預測 UI
