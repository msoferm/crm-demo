import React, { useEffect, useState } from 'react';
import { finances } from '../../api/client.js';

const nis = n => `₪${parseFloat(n || 0).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function Revenue() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    finances.revenue(year)
      .then(setData)
      .finally(() => setLoading(false));
  }, [year]);

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  const totals = data?.months?.reduce((acc, m) => ({
    orders: acc.orders + m.orders_count,
    paid:   acc.paid   + m.paid,
    partial:acc.partial+ m.partial,
    unpaid: acc.unpaid + m.unpaid,
    total:  acc.total  + m.total,
  }), { orders: 0, paid: 0, partial: 0, unpaid: 0, total: 0 });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.2rem' }}>
        <h3 style={{ margin: 0 }}>💰 הכנסות</h3>
        <select className="form-input" style={{ width: 'auto' }} value={year} onChange={e => setYear(+e.target.value)}>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {loading && <div className="spinner" />}

      {totals && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
          {[
            { label: 'סה"כ הכנסות', value: nis(totals.total), color: '#1e40af' },
            { label: 'שולם', value: nis(totals.paid), color: '#16a34a' },
            { label: 'שולם חלקית', value: nis(totals.partial), color: '#d97706' },
            { label: 'לא שולם', value: nis(totals.unpaid), color: '#dc2626' },
          ].map(c => (
            <div key={c.label} className="card" style={{ padding: '1rem', textAlign: 'center', borderTop: `3px solid ${c.color}` }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: c.color }}>{c.value}</div>
              <div style={{ fontSize: '.8rem', color: 'var(--muted)', marginTop: '.3rem' }}>{c.label}</div>
            </div>
          ))}
        </div>
      )}

      {data && (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>חודש</th>
                <th style={{ textAlign: 'center' }}>הזמנות</th>
                <th>סה"כ</th>
                <th>שולם</th>
                <th>חלקי</th>
                <th>לא שולם</th>
                <th style={{ width: 120 }}>% שולם</th>
              </tr>
            </thead>
            <tbody>
              {data.months.map(m => {
                const pct = m.total > 0 ? Math.round((m.paid / m.total) * 100) : 0;
                const hasData = m.total > 0;
                return (
                  <tr key={m.month} style={!hasData ? { color: 'var(--muted)' } : {}}>
                    <td><strong>{m.label}</strong></td>
                    <td style={{ textAlign: 'center' }}>{m.orders_count || '-'}</td>
                    <td style={{ fontWeight: hasData ? 700 : 400 }}>{hasData ? nis(m.total) : '-'}</td>
                    <td style={{ color: '#16a34a' }}>{m.paid > 0 ? nis(m.paid) : '-'}</td>
                    <td style={{ color: '#d97706' }}>{m.partial > 0 ? nis(m.partial) : '-'}</td>
                    <td style={{ color: '#dc2626' }}>{m.unpaid > 0 ? nis(m.unpaid) : '-'}</td>
                    <td>
                      {hasData && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
                          <div style={{ flex: 1, height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: '#16a34a', borderRadius: 4 }} />
                          </div>
                          <span style={{ fontSize: '.75rem', minWidth: 30 }}>{pct}%</span>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {totals && (
              <tfoot>
                <tr style={{ fontWeight: 700, background: '#f0f4ff' }}>
                  <td>סה"כ שנתי</td>
                  <td style={{ textAlign: 'center' }}>{totals.orders}</td>
                  <td>{nis(totals.total)}</td>
                  <td style={{ color: '#16a34a' }}>{nis(totals.paid)}</td>
                  <td style={{ color: '#d97706' }}>{nis(totals.partial)}</td>
                  <td style={{ color: '#dc2626' }}>{nis(totals.unpaid)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
