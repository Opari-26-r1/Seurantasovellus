import { useState } from 'react';
import DeviceMarker from './DeviceMarker';
import RoomEditor from './RoomEditor';
import { bounds, loadLayout, saveLayout, toPoints, withDefaults } from '../utils/roomLayout';

const GLOW_TOWARD_RX = 0.25; // 0 = hehku TX:n kohdalla, 1 = RX:n kohdalla

/**
 * Huonekartta: käyttäjän piirtämä huone ja laitteiden sijainnit. Liikettä havaitseva
 * linja valaisee oman alueensa -> liikkeen suunta voidaan arvioida karkeasti.
 * links: [{ tx_id, variance, presence }] linjojen nykytila (/readings/latest)
 */
export default function RoomMap({ txIds, links, occupied }) {
  const [saved, setSaved] = useState(loadLayout);
  const [editing, setEditing] = useState(false);

  const layout = withDefaults(saved, txIds);
  const { walls, devices } = layout;
  const linkById = Object.fromEntries(links.map((l) => [l.tx_id, l]));
  const rx = devices.rx;

  // Koordinaatit ovat metrejä; u skaalaa viivat ja merkit huoneen kokoon
  const b = bounds([...walls, ...Object.values(devices)]);
  const u = Math.max(b.maxX - b.minX, b.maxY - b.minY) / 180;
  const pad = 16 * u;
  const viewBox = [b.minX - pad, b.minY - pad, b.maxX - b.minX + 2 * pad, b.maxY - b.minY + 2 * pad].join(' ');
  const polygon = toPoints(walls);

  const save = (next) => {
    setSaved(next);
    saveLayout(next);
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-blue-400/15 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-white">Huonekartta</h3>
        <div className="flex gap-1.5">
          {saved && (
            <button
              type="button"
              onClick={() => window.confirm('Palautetaanko oletushuone? Oma huone poistetaan.') && save(null)}
              className="rounded-md px-2 py-0.5 text-[11px] text-slate-400 hover:text-white"
            >
              Palauta
            </button>
          )}
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-md border border-blue-400/25 px-2 py-0.5 text-[11px] text-blue-200 hover:bg-blue-600/20"
          >
            Muokkaa huonetta
          </button>
        </div>
      </div>

      <svg viewBox={viewBox} className="max-h-56 w-full self-center" role="img" aria-label="Huonekartta liikehavainnoista">
        <defs>
          <radialGradient id="room-zone-glow">
            <stop offset="0%" stopColor="#34d399" stopOpacity=".55" />
            <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
          </radialGradient>
          <clipPath id="room-clip">
            <polygon points={polygon} />
          </clipPath>
          <filter id="room-link-blur">
            <feGaussianBlur stdDeviation={3 * u} />
          </filter>
        </defs>

        <polygon points={polygon} fill="#0f1f4a" fillOpacity=".4" />

        {/* Liikettä havaitsevan TX:n alue valaistaan */}
        {txIds.map((id) => {
          const p = devices[id];
          if (!linkById[id]?.presence || !p) return null;
          // Hehkun keskipiste siirretään TX:ltä osittain kohti RX:ää, koska liike häiritsee linjan väliä
          const cx = p[0] + (rx[0] - p[0]) * GLOW_TOWARD_RX;
          const cy = p[1] + (rx[1] - p[1]) * GLOW_TOWARD_RX;
          return (
            <circle key={id} cx={cx} cy={cy} r={60 * u} fill="url(#room-zone-glow)" clipPath="url(#room-clip)" className="animate-pulse" />
          );
        })}

        <polygon points={polygon} fill="none" stroke="#2563eb" strokeWidth={4 * u} strokeLinejoin="round" />

        {/* TX -> RX -linjat */}
        {txIds.map((id) => {
          const p = devices[id];
          if (!p) return null;
          const active = linkById[id]?.presence;
          return (
            <g key={id}>
              {active && (
                <line x1={p[0]} y1={p[1]} x2={rx[0]} y2={rx[1]} stroke="#34d399" strokeWidth={6 * u} filter="url(#room-link-blur)" />
              )}
              <line
                x1={p[0]} y1={p[1]} x2={rx[0]} y2={rx[1]}
                stroke={active ? '#34d399' : '#1e40af'}
                strokeWidth={(active ? 2 : 1) * u}
                strokeDasharray={active ? undefined : `${3 * u} ${3 * u}`}
              />
            </g>
          );
        })}

        <DeviceMarker x={rx[0]} y={rx[1]} u={u} label="RX" isRx />
        {txIds.map((id) => {
          const p = devices[id];
          return p ? <DeviceMarker key={id} x={p[0]} y={p[1]} u={u} label={id} active={linkById[id]?.presence} /> : null;
        })}
      </svg>

      <div className="space-y-1.5">
        <p className="flex items-center justify-center gap-2 text-sm font-semibold text-white">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              occupied ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-slate-500'
            }`}
          />
          {occupied == null ? 'Ei tietoa' : occupied ? 'Huoneessa liikettä' : 'Huone tyhjä'}
        </p>
        {txIds.length === 0 ? (
          <p className="text-center text-xs text-slate-400">Ei linjakohtaista dataa</p>
        ) : (
          <ul className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-[11px]" title="Varianssi = CSI-signaalin vaihtelu">
            {txIds.map((id) => {
              const l = linkById[id];
              return (
                <li key={id} className={l?.presence ? 'text-emerald-300' : 'text-slate-400'}>
                  <span className="font-semibold">TX {id}</span> {l?.variance != null ? l.variance.toFixed(1) : '–'}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Ilman omaa tallennettua huonetta editori aloittaa tyhjästä */}
      {editing && (
        <RoomEditor layout={saved ? layout : null} txIds={txIds} onSave={save} onClose={() => setEditing(false)} />
      )}
    </div>
  );
}
