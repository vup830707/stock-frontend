import { formatNav, formatWinRate, formatPct } from "./formatters";
import { MIN_EVALUATE_BARS, countValidOhlcv } from "./fetchMonths";

export function TimingDetail({ timing, historical }) {
  const valid = countValidOhlcv(historical);
  const first = historical?.[0]?.date || "-";
  const last = historical?.at?.(-1)?.date || historical?.[historical.length - 1]?.date || "-";
  const enough = valid >= MIN_EVALUATE_BARS;
  const m = timing?.metrics;

  return (
    <div className="timing-detail" data-testid="timing-detail">
      <div className="detail-block">
        <h3>資料狀態</h3>
        <p>
          有效日線 {valid} 根 · {first} ～ {last} ·{" "}
          {enough ? "可評估" : `不足（需 ${MIN_EVALUATE_BARS}）`}
        </p>
      </div>
      {timing && (
        <>
          <div className="detail-block">
            <h3>評估指標</h3>
            <ul className="metrics">
              <li>勝率 <span>{formatWinRate(m?.winRate)}</span></li>
              <li>策略 NAV <span>{formatNav(m?.strategyEndNav)}</span></li>
              <li>買進持有 <span>{formatNav(m?.buyHoldEndNav)}</span></li>
              <li>回合 <span>{m?.roundTrips ?? "-"}</span></li>
              <li>近期 <span>{formatPct(m?.recentReturn)}</span></li>
              {m?.maxDrawdown != null && (
                <li>最大回撤 <span>{formatPct(m.maxDrawdown)}</span></li>
              )}
            </ul>
          </div>
          <div className="detail-block">
            <h3>買賣明細</h3>
            {(timing.trades || []).length === 0 ? (
              <p>無</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>日期</th>
                    <th>方向</th>
                    <th>價格</th>
                  </tr>
                </thead>
                <tbody>
                  {(timing.trades || []).map((t, i) => (
                    <tr key={`${t.date}-${t.side}-${i}`}>
                      <td>{t.date}</td>
                      <td>{t.side}</td>
                      <td>{t.price != null ? t.price : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
