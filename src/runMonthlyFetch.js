import { FETCH_GAP_MS } from "./fetchMonths";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runMonthlyFetch({
  months,
  postMonth,
  delayMs = FETCH_GAP_MS,
  onProgress
}) {
  let anyOk = false;
  for (let i = 0; i < months.length; i++) {
    const yearMonth = months[i];
    onProgress({ index: i + 1, total: months.length, yearMonth });
    const result = await postMonth(yearMonth);
    if (result && result.twseOk) anyOk = true;
    if (i < months.length - 1 && delayMs > 0) {
      await sleep(delayMs);
    }
  }
  return { anyOk };
}
