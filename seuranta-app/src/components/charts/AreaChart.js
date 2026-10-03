import { useId } from 'react';
import smoothPath, { svgId } from './smoothPath';

const W = 600;
const H = 200;

export const formatHour = (iso) => String(new Date(iso).getHours()).padStart(2, '0');
export const formatDay = (iso) => {
  const d = new Date(iso);
  return `${d.getDate()}.${d.getMonth() + 1}.`;
};

const toPercent = (value, [min, max]) => (1 - (value - min) / (max - min)) * 100;
// Akselin ulkopuolelle menevät arvot piirretään reunaan, ettei käyrä karkaa kortin yli
const toY = (value, domain) => Math.min(H, Math.max(0, (toPercent(value, domain) / 100) * H));

function AxisLabels({ axis, align }) {
  return (
    <div className={`relative w-10 shrink-0 text-[11px] text-slate-400 ${align === 'right' ? 'text-left' : 'text-right'}`}>
      <span className="absolute -top-5 inset-x-0">{axis.unit}</span>
      {axis.ticks.map((t) => (
        <span
          key={t}
          className={`absolute -translate-y-1/2 ${align === 'right' ? 'left-2' : 'right-2'}`}
          style={{ top: `${toPercent(t, axis.domain)}%` }}
        >
          {t}
        </span>
      ))}
    </div>
  );
}

/**
 * Yleiskäyttöinen aikasarjakaavio.
 * data:   [{ time, ...arvot }]
 * series: [{ key, color, axis: 'left' | 'right' }]
 * leftAxis / rightAxis: { domain: [min, max], ticks: [...], unit }
 */
export default function AreaChart({
  data,
  series,
  leftAxis,
  rightAxis,
  xKey = 'time',
  xTickEvery = 4,
  formatTick = formatHour,
  height = 'h-56',
}) {
  const baseId = svgId(useId());
  if (data.length < 2) {
    return (
      <div className={`grid place-items-center rounded-lg bg-blue-900/20 text-sm text-slate-400 ${height}`}>
        Ei vielä tarpeeksi dataa kaavioon
      </div>
    );
  }
  const xPos = (i) => (i / (data.length - 1)) * W;
  const xTicks = data
    .map((d, i) => ({ i, label: formatTick(d[xKey]) }))
    .filter(({ i }) => i % xTickEvery === 0);

  return (
    <div className={`flex pt-5 ${height}`}>
      <AxisLabels axis={leftAxis} align="left" />

      <div className="relative flex-1 pb-6">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full border-b border-l border-blue-300/20">
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={`${baseId}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity=".35" />
                <stop offset="100%" stopColor={s.color} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>

          {leftAxis.ticks.map((t) => {
            const y = (toPercent(t, leftAxis.domain) / 100) * H;
            return <line key={t} x1="0" x2={W} y1={y} y2={y} stroke="#60a5fa" strokeOpacity=".12" vectorEffect="non-scaling-stroke" />;
          })}
          {xTicks.map(({ i }) => (
            <line key={i} x1={xPos(i)} x2={xPos(i)} y1="0" y2={H} stroke="#60a5fa" strokeOpacity=".08" vectorEffect="non-scaling-stroke" />
          ))}

          {series.map((s) => {
            const axis = s.axis === 'right' ? rightAxis : leftAxis;
            const points = data
              .map((d, i) => (d[s.key] == null ? null : [xPos(i), toY(d[s.key], axis.domain)]))
              .filter(Boolean);
            if (points.length < 2) return null;
            const line = smoothPath(points);
            return (
              <g key={s.key}>
                <path d={`${line} L${points[points.length - 1][0]},${H} L${points[0][0]},${H}Z`} fill={`url(#${baseId}-${s.key})`} />
                <path d={line} fill="none" stroke={s.color} strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
              </g>
            );
          })}
        </svg>

        <div className="absolute inset-x-0 bottom-0 h-5 text-[11px] text-slate-400">
          {xTicks.map(({ i, label }) => (
            <span key={i} className="absolute -translate-x-1/2" style={{ left: `${(i / (data.length - 1)) * 100}%` }}>
              {label}
            </span>
          ))}
        </div>
      </div>

      {rightAxis ? <AxisLabels axis={rightAxis} align="right" /> : <div className="w-4" />}
    </div>
  );
}
