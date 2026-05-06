import React, { useEffect, useState, useMemo } from 'react';
import { finances } from '../../api/client.js';

const nis = n => `₪${parseFloat(n || 0).toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const pct = (a, b) => (b === 0 ? 0 : Math.round((a / b) * 100));

// ── Simple SVG Bar Chart ──────────────────────────────────────────────────────
function BarChart({ months, height = 220 }) {
  const W = 600, H = height, PAD = { top: 20, right: 20, bottom: 40, left: 60 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const maxVal = Math.max(...months.flatMap(m => [m.revenue, m.total_expenses]), 1);
  const barW = (chartW / months.length) * 0.3;
  const gap  = chartW / months.length;

  const yLines = [0, 0.25, 0.5, 0.75, 1].map(f => ({
    y: PAD.top + chartH * (1 - f),
    label: nis(maxVal * f),
  }));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {/* Grid lines */}
      {yLines.map((l, i) => (
        <g key={i}>
          <line x1={PAD.left} y1={l.y} x2={W - PAD.right} y2={l.y} stroke="#e5e7eb" strokeWidth="1" />
          <text x={PAD.left - 6} y={l.y + 4} textAnchor="end" fontSize="9" fill="#9ca3af">{l.label}</text>
        </g>
      ))}
      {/* Bars */}
      {months.map((m, i) => {
        const cx = PAD.left + i * gap + gap / 2;
        const revH  = (m.revenue / maxVal) * chartH;
        const expH  = (m.total_expenses / maxVal) * chartH;
        return (
          <g key={i}>
            {/* Revenue bar */}
            <rect
              x={cx - barW - 1} y={PAD.top + chartH - revH}
              width={barW} height={Math.max(revH, 1)}
              fill="#1e40af" rx="2"
              opacity={m.revenue > 0 ? 1 : 0.2}
            >
              <title>{m.label}: הכנסות {nis(m.revenue)}</title>
            </rect>
            {/* Expenses bar */}
            <rect
              x={cx + 1} y={PAD.top + chartH - expH}
              width={barW} height={Math.max(expH, 1)}
              fill="#dc2626" rx="2"
              opacity={m.total_expenses > 0 ? 1 : 0.2}
            >
              <title>{m.label}: הוצאות {nis(m.total_expenses)}</title>
            </rect>
            {/* Month label */}
            <text x={cx} y={H - PAD.bottom + 14} textAnchor="middle" fontSize="9" fill="#6b7280">
              {m.label.slice(0, 3)}
            </text>
          </g>
        );
      })}
      {/* Legend */}
      <rect x={PAD.left} y={H - 14} width={10} height={10} fill="#1e40af" rx="2" />
      <text x={PAD.left + 14} y={H - 5} fontSize="10" fill="#374151">הכנסות</text>
      <rect x={PAD.left + 80} y={H - 14} width={10} height={10} fill="#dc2626" rx="2" />
      <text x={PAD.left + 94} y={H - 5} fontSize="10" fill="#374151">הוצאות</text>
    </svg>
  );
}

// ── SVG Line Chart (profit trend) ─────────────────────────────────────────────
function LineChart({ current, previous, height = 180 }) {
  const W = 600, H = height, PAD = { top: 20, right: 20, bottom: 40, left: 60 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const allVals = [...current.map(m => m.profit), ...previous.map(m => m.profit)];
  const minVal = Math.min(...allVals, 0);
  const maxVal = Math.max(...allVals, 1);
  const range  = maxVal - minVal || 1;

  const toX = i => PAD.left + (i / (current.length - 1)) * chartW;
  const toY = v => PAD.top + chartH - ((v - minVal) / range) * chartH;

  const pointsStr = arr => arr.map((m, i) => `${toX(i)},${toY(m.profit)}`).join(' ');
  const zeroY = toY(0);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {/* Zero line */}
      {zeroY >= PAD.top && zeroY <= PAD.top + chartH && (
        <line x1={PAD.left} y1={zeroY} x2={W - PAD.right} y2={zeroY} stroke="#9ca3af" strokeWidth="1" strokeDasharray="4,3" />
      )}
      {/* Grid */}
      {[0, 0.5, 1].map((f, i) => {
        const v = minVal + range * f;
        const y = toY(v);
        return (
          <g key={i}>
            <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#e5e7eb" strokeWidth="1" />
            <text x={PAD.left - 6} y={y + 4} textAnchor="end" fontSize="9" fill="#9ca3af">{nis(v)}</text>
          </g>
        );
      })}
      {/* Previous year line */}
      <polyline points={pointsStr(previous)} fill="none" stroke="#9ca3af" strokeWidth="2" strokeDasharray="5,3" />
      {/* Current year line */}
      <polyline points={pointsStr(current)} fill="none" stroke="#1e40af" strokeWidth="2.5" />
      {/* Dots current */}
      {current.map((m, i) => (
        <circle key={i} cx={toX(i)} cy={toY(m.profit)} r="4"
          fill={m.profit >= 0 ? '#16a34a' : '#dc2626'} stroke="white" strokeWidth="1.5">
          <title>{m.label}: {nis(m.profit)}</title>
        </circle>
      ))}
      {/* Month labels */}
      {current.map((m, i) => (
        <text key={i} x={toX(i)} y={H - PAD.bottom + 14} textAnchor="middle" fontSize="9" fill="#6b7280">
          {m.label.slice(0, 3)}
        </text>
      ))}
      {/* Legend */}
      <line x1={PAD.left} y1={H - 10} x2={PAD.left + 20} y2={H - 10} stroke="#1e40af" strokeWidth="2.5" />
      <text x={PAD.left + 24} y={H - 6} fontSize="10" fill="#374151">שנה נוכחית</text>
      <line x1={PAD.left + 110} y1={H - 10} x2={PAD.left + 130} y2={H - 10} stroke="#9ca3af" strokeWidth="2" strokeDasharray="5,3" />
      <text x={PAD.left + 134} y={H - 6} fontSize="10" fill="#374151">שנה קודמת</text>
    </svg>
  );
}

// ── SVG Pie Chart ─────────────────────────────────────────────────────────────
function PieChart({ data, size = 160 }) {
  if (!data || data.length === 0) return <div style={{ color: 'var(--muted)', fontSize: '.85rem', padding: '1rem 0' }}>אין נתונים</div>;

  const total = data.reduce((s, d) => s + parseFloat(d.total || 0), 0);
  if (total === 0) return <div style={{ color: 'var(--muted)', fontSize: '.85rem', padding: '1rem 0' }}>אין נתונים</div>;

  const COLORS = ['#dc2626','#d97706','#7c3aed','#1e40af','#16a34a','#0891b2','#db2777','#84cc16'];
  const cx = size / 2, cy = size / 2, r = size * 0.42;

  let slices = [];
  let angle = -Math.PI / 2;
  data.forEach((d, i) => {
    const frac = parseFloat(d.total) / total;
    const sweep = frac * 2 * Math.PI;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    angle += sweep;
    const x2 = cx + r * Math.cos(angle);
    const y2 = cy + r * Math.sin(angle);
    const large = sweep > Math.PI ? 1 : 0;
    slices.push({ d: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`, color: COLORS[i % COLORS.length], label: d.category, pct: Math.round(frac * 100) });
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
      <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size, flexShrink: 0 }}>
        {slices.map((s, i) => <path key={i} d={s.d} fill={s.color} stroke="white" strokeWidth="1.5"><title>{s.label}: {s.pct}%</title></path>)}
      </svg>
      <div style={{ fontSize: '.8rem' }}>
        {data.map((d, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '.3rem' }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: COLORS[i % COLORS.length], flexShrink: 0, display: 'inline-block' }} />
            <span>{d.category}</span>
            <span style={{ fontWeight: 700 }}>{slices[i]?.pct}%</span>
            <span style={{ color: 'var(--muted)' }}>{nis(d.total)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Trend arrow ───────────────────────────────────────────────────────────────
function Trend({ curr, prev }) {
  if (!prev || prev === 0) return null;
  const diff = curr - prev;
  const p = Math.round(Math.abs(diff / prev) * 100);
  const up = diff >= 0;
  return (
    <span style={{ fontSize: '.75rem', color: up ? '#16a34a' : '#dc2626', marginRight: '.4rem' }}>
      {up ? '▲' : '▼'} {p}%
    </span>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function AnnualSummary() {
  const [year, setYear]     = useState(new Date().getFullYear());
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(false);

  const years = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);

  useEffect(() => {
    setLoading(true);
    finances.annualSummary(year)
      .then(setData)
      .finally(() => setLoading(false));
  }, [year]);

  const curr = data?.totals;
  const prev = data?.prev_year?.totals;
  const profitMargin = curr?.revenue > 0 ? pct(curr.profit, curr.revenue) : 0;

  return (
    <div>
      <div className="finance-toolbar">
        <h3>📈 סיכום שנתי</h3>
        <select className="form-input" style={{ width: 'auto' }} value={year} onChange={e => setYear(+e.target.value)}>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {loading && <div className="spinner" />}

      {data && curr && (
        <>
          {/* ── KPI Cards ── */}
          <div className="kpi-grid cols-4">
            {[
              { label: 'סה"כ הכנסות', value: nis(curr.revenue),       color: '#1e40af', prev: prev?.revenue },
              { label: 'סה"כ הוצאות', value: nis(curr.total_expenses), color: '#dc2626', prev: prev?.total_expenses },
              { label: 'רווח נקי',    value: nis(curr.profit),         color: curr.profit >= 0 ? '#16a34a' : '#dc2626', prev: prev?.profit },
              { label: 'מרווח רווח', value: `${profitMargin}%`,        color: '#7c3aed' },
            ].map(c => (
              <div key={c.label} className="card" style={{ padding: '1.2rem', textAlign: 'center', borderTop: `4px solid ${c.color}` }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: c.color }}>{c.value}</div>
                {c.prev !== undefined && <Trend curr={curr[c.label === 'סה"כ הכנסות' ? 'revenue' : c.label === 'סה"כ הוצאות' ? 'total_expenses' : 'profit']} prev={c.prev} />}
                <div style={{ fontSize: '.8rem', color: 'var(--muted)', marginTop: '.3rem' }}>{c.label}</div>
                {c.prev !== undefined && <div style={{ fontSize: '.72rem', color: 'var(--muted)' }}>שנה קודמת: {nis(c.prev)}</div>}
              </div>
            ))}
          </div>

          {/* ── Charts Row ── */}
          <div className="charts-row">
            <div className="card" style={{ padding: '1.2rem' }}>
              <div style={{ fontWeight: 700, marginBottom: '.8rem', color: '#374151' }}>📊 הכנסות מול הוצאות — {year}</div>
              <BarChart months={data.months} />
            </div>
            <div className="card" style={{ padding: '1.2rem' }}>
              <div style={{ fontWeight: 700, marginBottom: '.8rem', color: '#374151' }}>📉 מגמת רווח — {year} לעומת {year - 1}</div>
              <LineChart current={data.months} previous={data.prev_year?.months || data.months.map(m => ({ ...m, profit: 0 }))} />
            </div>
          </div>

          {/* ── Expense categories pie ── */}
          {data.expense_categories?.length > 0 && (
            <div className="card" style={{ padding: '1.2rem', marginBottom: '1rem' }}>
              <div style={{ fontWeight: 700, marginBottom: '.8rem', color: '#374151' }}>🥧 הוצאות לפי קטגוריה — {year}</div>
              <PieChart data={data.expense_categories} />
            </div>
          )}

          {/* ── Monthly breakdown table ── */}
          <div className="card table-wrap">
            <div style={{ fontWeight: 700, padding: '1rem 1rem .5rem', color: '#374151' }}>
              פירוט חודשי — {year} לעומת {year - 1}
            </div>
            <table>
              <thead>
                <tr>
                  <th>חודש</th>
                  <th>הזמנות</th>
                  <th>הכנסות {year}</th>
                  <th>הכנסות {year - 1}</th>
                  <th>שינוי</th>
                  <th>הוצאות</th>
                  <th>רווח</th>
                  <th>מרווח</th>
                </tr>
              </thead>
              <tbody>
                {data.months.map((m, i) => {
                  const pm = data.prev_year?.months?.[i] || {};
                  const revDiff = m.revenue - (pm.revenue || 0);
                  const margin  = m.revenue > 0 ? pct(m.profit, m.revenue) : 0;
                  const hasData = m.revenue > 0 || m.total_expenses > 0;
                  return (
                    <tr key={m.month} style={!hasData ? { color: 'var(--muted)' } : {}}>
                      <td><strong>{m.label}</strong></td>
                      <td style={{ textAlign: 'center' }}>{m.orders_count || '-'}</td>
                      <td style={{ fontWeight: hasData ? 700 : 400 }}>{hasData ? nis(m.revenue) : '-'}</td>
                      <td style={{ color: 'var(--muted)' }}>{pm.revenue > 0 ? nis(pm.revenue) : '-'}</td>
                      <td>
                        {pm.revenue > 0 && m.revenue > 0 && (
                          <span style={{ color: revDiff >= 0 ? '#16a34a' : '#dc2626', fontSize: '.8rem', fontWeight: 600 }}>
                            {revDiff >= 0 ? '▲' : '▼'} {Math.abs(pct(revDiff, pm.revenue))}%
                          </span>
                        )}
                      </td>
                      <td style={{ color: '#dc2626' }}>{m.total_expenses > 0 ? nis(m.total_expenses) : '-'}</td>
                      <td style={{ fontWeight: 700, color: m.profit >= 0 ? '#16a34a' : '#dc2626' }}>
                        {hasData ? nis(m.profit) : '-'}
                      </td>
                      <td>
                        {hasData && (
                          <span style={{
                            padding: '2px 8px', borderRadius: 10, fontSize: '.75rem', fontWeight: 700,
                            background: margin >= 20 ? '#f0fdf4' : margin >= 0 ? '#fffbeb' : '#fef2f2',
                            color:      margin >= 20 ? '#16a34a' : margin >= 0 ? '#d97706' : '#dc2626',
                          }}>
                            {margin}%
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 800, background: '#f0f4ff' }}>
                  <td>סה"כ {year}</td>
                  <td style={{ textAlign: 'center' }}>{curr.orders_count}</td>
                  <td style={{ color: '#1e40af' }}>{nis(curr.revenue)}</td>
                  <td style={{ color: 'var(--muted)' }}>{prev ? nis(prev.revenue) : '-'}</td>
                  <td>
                    {prev && prev.revenue > 0 && (
                      <span style={{ color: curr.revenue >= prev.revenue ? '#16a34a' : '#dc2626', fontSize: '.85rem' }}>
                        {curr.revenue >= prev.revenue ? '▲' : '▼'} {Math.abs(pct(curr.revenue - prev.revenue, prev.revenue))}%
                      </span>
                    )}
                  </td>
                  <td style={{ color: '#dc2626' }}>{nis(curr.total_expenses)}</td>
                  <td style={{ color: curr.profit >= 0 ? '#16a34a' : '#dc2626' }}>{nis(curr.profit)}</td>
                  <td>
                    <span style={{
                      padding: '2px 8px', borderRadius: 10, fontSize: '.8rem', fontWeight: 700,
                      background: profitMargin >= 20 ? '#f0fdf4' : '#fffbeb',
                      color:      profitMargin >= 20 ? '#16a34a' : '#d97706',
                    }}>
                      {profitMargin}%
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
