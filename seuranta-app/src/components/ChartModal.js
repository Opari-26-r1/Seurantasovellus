import { useCallback, useEffect, useState } from 'react';
import Icon from './Icon';
import AreaChart, { formatDay, formatHour } from './charts/AreaChart';
import usePolling from '../hooks/usePolling';

export const RANGES = [
  { key: '24h', label: '24 h', xTickEvery: 4, formatTick: formatHour },
  { key: '7d', label: '7 pv', xTickEvery: 12, formatTick: formatDay },
  { key: '30d', label: '30 pv', xTickEvery: 12, formatTick: formatDay },
];

function SeriesStats({ data, series }) {
  return (
    <div className="mt-6 grid gap-3 sm:grid-cols-2">
      {series.map((s) => {
        const values = data.map((d) => d[s.key]).filter((v) => v != null);
        const stats = values.length
          ? [
              ['Min', Math.min(...values)],
              ['Keskiarvo', values.reduce((a, b) => a + b, 0) / values.length],
              ['Max', Math.max(...values)],
            ]
          : [['Min', null], ['Keskiarvo', null], ['Max', null]];
        return (
          <div key={s.key} className="rounded-xl border border-blue-400/15 p-4">
            <p className="mb-3 flex items-center gap-2 text-sm text-slate-300">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
              {s.label}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {stats.map(([label, value]) => (
                <div key={label}>
                  <p className="text-[11px] text-slate-400">{label}</p>
                  <p className="text-lg font-semibold text-white">
                    {value == null ? '–' : value.toFixed(1)} <span className="text-xs text-slate-400">{s.unit}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ChartModal({ title, series, leftAxis, rightAxis, onClose }) {
  const [rangeKey, setRangeKey] = useState('24h');
  const range = RANGES.find((r) => r.key === rangeKey);
  const { data, error } = usePolling(`/readings?range=${rangeKey}`, 60000);
  const [closing, setClosing] = useState(false);

  const requestClose = useCallback(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) onClose();
    else setClosing(true);
  }, [onClose]);

  // Esc sulkee, ja taustasivun vieritys estetään modalin ollessa auki
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && requestClose();
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [requestClose]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <button
        aria-label="Sulje"
        onClick={requestClose}
        className={`absolute inset-0 bg-slate-950/70 backdrop-blur-sm ${
          closing ? 'motion-safe:animate-fade-out' : 'motion-safe:animate-fade-in'
        }`}
      />

      <div
        onAnimationEnd={(e) => closing && e.target === e.currentTarget && onClose()}
        className={`relative max-h-full w-full max-w-5xl overflow-y-auto rounded-2xl border border-blue-400/20 bg-[#08163a] p-6 shadow-[0_0_60px_rgba(37,99,235,.25)] ${
          closing ? 'motion-safe:animate-pop-out' : 'motion-safe:animate-pop-in'
        }`}
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-xl font-semibold text-white">{title}</h2>
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg border border-blue-400/20 p-1">
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setRangeKey(r.key)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                    r.key === rangeKey ? 'bg-blue-600 text-white' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <button onClick={requestClose} aria-label="Sulje" className="text-slate-400 hover:text-white">
              <Icon name="close" size={22} />
            </button>
          </div>
        </div>

        {data ? (
          <>
            <AreaChart
              data={data}
              series={series}
              leftAxis={leftAxis}
              rightAxis={rightAxis}
              xTickEvery={range.xTickEvery}
              formatTick={range.formatTick}
              height="h-[26rem]"
            />
            <SeriesStats data={data} series={series} />
          </>
        ) : (
          <div className="grid h-[26rem] place-items-center text-sm text-slate-400">
            {error ? 'Datan haku epäonnistui' : 'Ladataan...'}
          </div>
        )}
      </div>
    </div>
  );
}
