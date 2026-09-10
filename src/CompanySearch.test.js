import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CompanySearch } from "./CompanySearch";

jest.mock("./api/timingApi", () => ({
  searchCompanies: jest.fn()
}));

import { searchCompanies } from "./api/timingApi";

beforeEach(() => {
  searchCompanies.mockReset();
});

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
  expect(screen.getByLabelText(/搜尋/)).toHaveValue("2330 台積電");
  expect(searchCompanies).toHaveBeenCalledTimes(1);
});

test("empty query calls onResults with empty array", async () => {
  searchCompanies.mockResolvedValue([{ stockNo: "2330", stockName: "台積電" }]);
  const onResults = jest.fn();
  render(<CompanySearch onResults={onResults} onPick={() => {}} debounceMs={0} />);
  const input = screen.getByLabelText(/搜尋/);
  await userEvent.type(input, "台積");
  await waitFor(() => expect(onResults).toHaveBeenCalledWith([{ stockNo: "2330", stockName: "台積電" }]));
  await userEvent.clear(input);
  await waitFor(() => expect(onResults).toHaveBeenCalledWith([]));
});

test("stale search response does not overwrite newer results", async () => {
  let finishSlow;
  searchCompanies.mockImplementation((query) => {
    if (query === "台") {
      return new Promise((resolve) => {
        finishSlow = () => resolve([{ stockNo: "9999", stockName: "慢" }]);
      });
    }
    return Promise.resolve([{ stockNo: "2330", stockName: "台積電" }]);
  });
  const onResults = jest.fn();
  render(<CompanySearch onResults={onResults} onPick={() => {}} debounceMs={0} />);
  const input = screen.getByLabelText(/搜尋/);
  await userEvent.type(input, "台");
  await waitFor(() => expect(finishSlow).toBeDefined());
  await userEvent.type(input, "積");
  await waitFor(() =>
    expect(onResults).toHaveBeenCalledWith([{ stockNo: "2330", stockName: "台積電" }])
  );
  finishSlow();
  await waitFor(() => {
    expect(screen.queryByRole("option", { name: /9999 慢/ })).not.toBeInTheDocument();
  });
});

test("pick does not trigger another search", async () => {
  searchCompanies.mockResolvedValue([{ stockNo: "2330", stockName: "台積電" }]);
  const onPick = jest.fn();
  render(<CompanySearch onResults={() => {}} onPick={onPick} debounceMs={0} />);
  await userEvent.type(screen.getByLabelText(/搜尋/), "台積");
  await waitFor(() => expect(searchCompanies).toHaveBeenCalledTimes(1));
  await userEvent.click(await screen.findByRole("option", { name: /2330 台積電/ }));
  await waitFor(() => expect(onPick).toHaveBeenCalledWith("2330"));
  expect(searchCompanies).toHaveBeenCalledTimes(1);
});
