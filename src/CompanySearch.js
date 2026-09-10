import { useEffect, useRef, useState } from "react";
import { searchCompanies } from "./api/timingApi";

export function CompanySearch({ onResults, onPick, disabled = false, debounceMs = 300 }) {
  const [q, setQ] = useState("");
  const [options, setOptions] = useState([]);
  const onResultsRef = useRef(onResults);
  const onPickRef = useRef(onPick);

  useEffect(() => {
    onResultsRef.current = onResults;
  }, [onResults]);

  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);

  useEffect(() => {
    const trimmed = q.trim();
    if (!trimmed) {
      setOptions([]);
      onResultsRef.current([]);
      return undefined;
    }
    const t = setTimeout(async () => {
      const items = await searchCompanies(trimmed);
      setOptions(items);
      onResultsRef.current(items);
    }, debounceMs);
    return () => clearTimeout(t);
  }, [q, debounceMs]);

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
                  onPickRef.current(o.stockNo);
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
