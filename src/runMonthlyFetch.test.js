import { runMonthlyFetch } from "./runMonthlyFetch";

test("reports progress and anyOk", async () => {
  const progress = [];
  const postMonth = jest.fn()
    .mockResolvedValueOnce({ twseOk: false })
    .mockResolvedValueOnce({ twseOk: true });

  const result = await runMonthlyFetch({
    months: ["202103", "202104"],
    postMonth,
    delayMs: 0,
    onProgress: (p) => progress.push(p)
  });

  expect(progress).toEqual([
    { index: 1, total: 2, yearMonth: "202103" },
    { index: 2, total: 2, yearMonth: "202104" }
  ]);
  expect(postMonth).toHaveBeenCalledTimes(2);
  expect(result.anyOk).toBe(true);
});
