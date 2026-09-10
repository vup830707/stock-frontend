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
