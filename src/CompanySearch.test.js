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
});
