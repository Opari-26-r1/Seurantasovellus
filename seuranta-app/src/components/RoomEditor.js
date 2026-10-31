import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import DeviceMarker from './DeviceMarker';
import { area, toPoints, withDefaults } from '../utils/roomLayout';

const GRID_W = 20; // metriä
const GRID_H = 14;
const WALL_SNAP = 0.5;
const DEVICE_SNAP = 0.25;
const U = 0.03; // laitemerkkien koko metreinä / 11

const snap = (v, step) => Math.round(v / step) * step;
const clamp = (v, max) => Math.min(max, Math.max(0, v));
const meters = (v) => `${Number(v.toFixed(1))} m`;
const samePoint = (a, b) => a && b && a[0] === b[0] && a[1] === b[1];
const snapPoint = ([x, y]) => [clamp(snap(x, WALL_SNAP), GRID_W), clamp(snap(y, WALL_SNAP), GRID_H)];

function WallLength({ a, b }) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return len > 0 ? (
    <text x={(a[0] + b[0]) / 2} y={(a[1] + b[1]) / 2 - 0.3} fill="#93c5fd" fontSize="0.32" textAnchor="middle" className="pointer-events-none">
      {meters(len)}
    </text>
  ) : null;
}

/**
 * Huoneen muokkausnäkymä 1 m ruudukolla. Ilman tallennettua huonetta aloitetaan tyhjästä:
 * kulmat klikataan yksi kerrallaan ja huone suljetaan klikkaamalla ensimmäistä kulmaa.
 * Suljetun huoneen kulmia ja seiniä voi raahata, ja laitteet raahataan paikoilleen.
 * layout: { walls, devices } metreinä tai null, onSave(layout) tallentaa.
 */
export default function RoomEditor({ layout, txIds, onSave, onClose }) {
  const [walls, setWalls] = useState(layout?.walls ?? []);
  const [devices, setDevices] = useState(layout?.devices ?? {});
  const [drawing, setDrawing] = useState(!layout);
  const [hover, setHover] = useState(null);
  const [closing, setClosing] = useState(false);
  const svgRef = useRef(null);
  const drag = useRef(null);

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

  // Piirtäessä Backspace poistaa viimeisen kulman
  useEffect(() => {
    if (!drawing) return undefined;
    const onKey = (e) => e.key === 'Backspace' && setWalls((w) => w.slice(0, -1));
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawing]);

  // Hiiren/kosketuksen sijainti metreinä
  const toMeters = (e) => {
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svgRef.current.getScreenCTM().inverse());
    return [p.x, p.y];
  };

  const closeRoom = () => {
    setDrawing(false);
    setHover(null);
    // Laitteet sijoitetaan oletuspaikoille uuden huoneen sisälle
    setDevices(withDefaults({ walls }, txIds).devices);
  };

  const restart = () => {
    setWalls([]);
    setDevices({});
    setDrawing(true);
  };

  const onDrawClick = (e) => {
    if (!drawing) return;
    const p = snapPoint(toMeters(e));
    if (walls.length >= 3 && samePoint(p, walls[0])) closeRoom();
    else if (!walls.some((q) => samePoint(p, q))) setWalls([...walls, p]);
  };

  const startDrag = (target) => (e) => {
    e.stopPropagation();
    svgRef.current.setPointerCapture(e.pointerId);
    drag.current = { ...target, start: toMeters(e), walls, devices };
  };

  const onPointerMove = (e) => {
    if (drawing) {
      setHover(snapPoint(toMeters(e)));
      return;
    }
    const d = drag.current;
    if (!d) return;
    const [x, y] = toMeters(e);

    if (d.type === 'vertex') {
      setWalls(d.walls.map((q, i) => (i === d.index ? snapPoint([x, y]) : q)));
    } else if (d.type === 'wall') {
      // Seinä liikkuu kohtisuoraan itseään vastaan (vino seinä liikkuu vapaasti)
      const j = (d.index + 1) % d.walls.length;
      const [a, b] = [d.walls[d.index], d.walls[j]];
      const dx = a[0] === b[0] || a[1] !== b[1] ? snap(x - d.start[0], WALL_SNAP) : 0;
      const dy = a[1] === b[1] || a[0] !== b[0] ? snap(y - d.start[1], WALL_SNAP) : 0;
      setWalls(d.walls.map((q, i) => (i === d.index || i === j ? [clamp(q[0] + dx, GRID_W), clamp(q[1] + dy, GRID_H)] : q)));
    } else if (d.type === 'device') {
      setDevices({ ...d.devices, [d.key]: [clamp(snap(x, DEVICE_SNAP), GRID_W), clamp(snap(y, DEVICE_SNAP), GRID_H)] });
    }
  };

  const endDrag = () => {
    drag.current = null;
  };

  const addCorner = (index) => {
    const [a, b] = [walls[index], walls[(index + 1) % walls.length]];
    const mid = [snap((a[0] + b[0]) / 2, WALL_SNAP), snap((a[1] + b[1]) / 2, WALL_SNAP)];
    setWalls([...walls.slice(0, index + 1), mid, ...walls.slice(index + 1)]);
  };

  const removeCorner = (index) => {
    if (walls.length > 3) setWalls(walls.filter((_, i) => i !== index));
  };

  const segments = walls.map((a, i) => [a, walls[(i + 1) % walls.length]]);
  const deviceKeys = ['rx', ...txIds.map(String)];
  const last = walls[walls.length - 1];
  const hoverCloses = walls.length >= 3 && samePoint(hover, walls[0]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-label="Muokkaa huonetta">
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
        <div className="mb-2 flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-xl font-semibold text-white">Muokkaa huonetta</h2>
          <button onClick={requestClose} aria-label="Sulje" className="text-slate-400 hover:text-white">
            <Icon name="close" size={22} />
          </button>
        </div>
        <p className="mb-4 text-xs text-slate-400">
          {drawing
            ? 'Klikkaa huoneen kulmat yksi kerrallaan ja sulje huone klikkaamalla ensimmäistä kulmaa. Backspace poistaa viimeisen kulman.'
            : 'Raahaa kulmia tai seiniä · + lisää kulman · tuplaklikkaus poistaa kulman · raahaa RX ja TX-laitteet oikeille paikoilleen.'}{' '}
          Yksi ruutu = 1 m × 1 m.
        </p>

        <svg
          ref={svgRef}
          viewBox={`-0.5 -0.5 ${GRID_W + 1} ${GRID_H + 1}`}
          className={`w-full touch-none select-none rounded-xl bg-[#0a1a3d] ${drawing ? 'cursor-crosshair' : ''}`}
          onClick={onDrawClick}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onPointerLeave={() => setHover(null)}
        >
          {/* Ruudukko, joka 5. viiva vahvempana */}
          {Array.from({ length: GRID_W + 1 }, (_, x) => (
            <line key={`x${x}`} x1={x} y1={0} x2={x} y2={GRID_H} stroke="#1e3a8a" strokeOpacity={x % 5 ? 0.35 : 0.8} strokeWidth="0.02" />
          ))}
          {Array.from({ length: GRID_H + 1 }, (_, y) => (
            <line key={`y${y}`} x1={0} y1={y} x2={GRID_W} y2={y} stroke="#1e3a8a" strokeOpacity={y % 5 ? 0.35 : 0.8} strokeWidth="0.02" />
          ))}

          {drawing ? (
            <g className="pointer-events-none">
              {segments.slice(0, -1).map(([a, b], i) => (
                <g key={i}>
                  <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#2563eb" strokeWidth="0.12" strokeLinecap="round" />
                  <WallLength a={a} b={b} />
                </g>
              ))}
              {last && hover && (
                <g>
                  <line x1={last[0]} y1={last[1]} x2={hover[0]} y2={hover[1]} stroke="#60a5fa" strokeWidth="0.06" strokeDasharray="0.2 0.15" />
                  <WallLength a={last} b={hover} />
                </g>
              )}
              {walls.map(([x, y], i) => (
                <circle
                  key={i}
                  cx={x} cy={y}
                  r={i === 0 && hoverCloses ? 0.3 : 0.18}
                  fill={i === 0 && walls.length >= 3 ? '#34d399' : '#2563eb'}
                  stroke="white" strokeWidth="0.04"
                />
              ))}
              {hover && !hoverCloses && <circle cx={hover[0]} cy={hover[1]} r="0.12" fill="#93c5fd" />}
            </g>
          ) : (
            <>
              <polygon points={toPoints(walls)} fill="#1d4ed8" fillOpacity=".12" />

              {segments.map(([a, b], i) => {
                const mx = (a[0] + b[0]) / 2;
                const my = (a[1] + b[1]) / 2;
                return (
                  <g key={i}>
                    <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#2563eb" strokeWidth="0.12" strokeLinecap="round" />
                    {/* Leveämpi näkymätön viiva helpottaa seinään tarttumista */}
                    <line
                      x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]}
                      stroke="transparent" strokeWidth="0.5"
                      className="cursor-move"
                      onPointerDown={startDrag({ type: 'wall', index: i })}
                    />
                    <WallLength a={a} b={b} />
                    <g className="cursor-pointer" onPointerDown={(e) => e.stopPropagation()} onClick={() => addCorner(i)}>
                      <circle cx={mx} cy={my} r="0.2" fill="#0a1a3d" stroke="#64748b" strokeWidth="0.03" />
                      <text x={mx} y={my} fill="#94a3b8" fontSize="0.3" textAnchor="middle" dominantBaseline="central">+</text>
                    </g>
                  </g>
                );
              })}

              {walls.map(([x, y], i) => (
                <circle
                  key={i}
                  cx={x} cy={y} r="0.18"
                  fill="#2563eb" stroke="white" strokeWidth="0.04"
                  className="cursor-grab"
                  onPointerDown={startDrag({ type: 'vertex', index: i })}
                  onDoubleClick={() => removeCorner(i)}
                />
              ))}

              {deviceKeys.map((key) => {
                const p = devices[key];
                return p ? (
                  <DeviceMarker
                    key={key}
                    x={p[0]} y={p[1]} u={U}
                    label={key === 'rx' ? 'RX' : key}
                    isRx={key === 'rx'}
                    className="cursor-grab"
                    onPointerDown={startDrag({ type: 'device', key })}
                  />
                ) : null;
              })}
            </>
          )}
        </svg>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {drawing ? (
            <>
              <p className="text-sm text-slate-300">
                Kulmia <span className="font-semibold text-white">{walls.length}</span>
              </p>
              <button
                type="button"
                disabled={walls.length === 0}
                onClick={() => setWalls(walls.slice(0, -1))}
                className="text-xs text-slate-400 hover:text-white disabled:opacity-40"
              >
                Kumoa kulma
              </button>
              <button
                type="button"
                disabled={walls.length < 3}
                onClick={closeRoom}
                className="text-xs text-emerald-300 hover:text-emerald-200 disabled:opacity-40"
              >
                Sulje huone
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-300">
                Pinta-ala <span className="font-semibold text-white">{area(walls).toFixed(1)} m²</span>
              </p>
              <button type="button" onClick={restart} className="text-xs text-slate-400 hover:text-white">
                Aloita alusta
              </button>
            </>
          )}
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={requestClose}
              className="rounded-lg border border-blue-400/25 px-4 py-1.5 text-sm text-slate-300 hover:text-white"
            >
              Peruuta
            </button>
            <button
              type="button"
              disabled={drawing}
              onClick={() => {
                onSave({ walls, devices });
                requestClose();
              }}
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Tallenna
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
