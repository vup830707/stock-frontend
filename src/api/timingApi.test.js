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
