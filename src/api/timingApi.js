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
