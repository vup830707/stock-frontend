import { useEffect, useRef, useState } from "react";
import { searchCompanies } from "./api/timingApi";

export function CompanySearch({ onResults, onPick, disabled = false, debounceMs = 300 }) {
  const [q, setQ] = useState("");
  const [options, setOptions] = useState([]);
  const onResultsRef = useRef(onResults);
  const onPickRef = useRef(onPick);
  const searchRequestRef = useRef(0);
  const skipSearchRef = useRef(false);

  useEffect(() => {
    onResultsRef.current = onResults;
  }, [onResults]);

  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);

  useEffect(() => {
    if (skipSearchRef.current) {
      skipSearchRef.current = false;
      return undefined;
    }
    const trimmed = q.trim();
    if (!trimmed) {
      setOptions([]);
      onResultsRef.current([]);
      return undefined;
    }
    const requestId = ++searchRequestRef.current;
    const t = setTimeout(async () => {
      const items = await searchCompanies(trimmed);
      if (requestId !== searchRequestRef.current) return;
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
                  skipSearchRef.current = true;
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
