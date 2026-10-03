import Card, { CardHeader, StatusDot } from './Card';
import Icon from './Icon';
import { formatHour } from './charts/AreaChart';

const clock = (iso) => new Date(iso).toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' });

function Legend() {
  return (
    <div className="flex gap-4 text-xs text-slate-300">
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-blue-600" />Ei liikettä</span>
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />Liike havaittu</span>
    </div>
  );
}

function Timeline({ slots }) {
  if (slots.length === 0) {
    return <div className="grid h-14 place-items-center rounded-lg bg-blue-900/30 text-xs text-slate-400">Ei dataa viimeiseltä 24 tunnilta</div>;
  }
  return (
    <div>
      <div className="flex h-14 gap-[2px] overflow-hidden rounded-lg">
        {slots.map((s) => (
          <div
            key={s.time}
            title={`${clock(s.time)} – ${s.motion ? 'liikettä' : 'ei liikettä'}`}
            className={`flex-1 ${s.motion ? 'bg-emerald-400/90 shadow-[0_0_12px_#34d399]' : 'bg-blue-700/60'}`}
          />
        ))}
      </div>
      <div className="relative mt-2 h-4 text-[11px] text-slate-400">
        {slots.map((s, i) =>
          i % 4 === 0 ? (
            <span key={s.time} className="absolute" style={{ left: `${(i / slots.length) * 100}%` }}>
              {formatHour(s.time)}
            </span>
          ) : null
        )}
      </div>
    </div>
  );
}

function RecentDetections({ items }) {
  return (
    <div className="rounded-xl border border-blue-400/15 p-4">
      <h3 className="mb-2 text-sm font-semibold text-white">Viimeisimmät havainnot</h3>
      {items.length === 0 && <p className="py-2 text-xs text-slate-400">Ei liikehavaintoja viimeisen 24 h aikana</p>}
      <ul className="divide-y divide-blue-400/10">
        {items.map((d) => (
          <li key={d.start} className="flex items-center gap-3 py-2 text-sm">
            <StatusDot ok />
            <span className="w-12 font-semibold text-white">{clock(d.start)}</span>
            <span className="w-14 text-slate-300">{Math.max(1, Math.round(d.duration_s / 60))} min</span>
            <span className="text-xs text-slate-400">{d.ongoing ? 'Liike jatkuu' : 'Liikettä havaittu'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RoomStatus({ occupied }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-blue-400/15 p-4">
      <div className="relative">
        <svg viewBox="0 0 120 100" className="h-28 w-32" aria-hidden="true">
          <path d="M10 10h45M70 10h40v35M110 60v30H65M50 90H10V10" fill="none" stroke="#2563eb" strokeWidth="4" />
          <circle cx="60" cy="50" r="24" fill="#0f766e" fillOpacity=".25" stroke={occupied ? '#34d399' : '#14b8a6'} strokeOpacity=".6" />
        </svg>
        <span className="absolute inset-0 grid place-items-center text-teal-300"><Icon name="user" size={22} /></span>
      </div>
      <p className="flex items-center gap-2 text-sm font-semibold text-white">
        {occupied != null && <StatusDot ok />}
        {occupied == null ? 'Ei tietoa' : occupied ? 'Huoneessa liikettä' : 'Huone tyhjä'}
      </p>
    </div>
  );
}

export default function PresenceCard({ timeline, detections, occupied }) {
  return (
    <Card>
      <CardHeader
        icon="user"
        title="Presenssin tunnistus"
        subtitle="Liikehavaintoja viimeisen 24 tunnin aikana"
        right={<Legend />}
      />
      <Timeline slots={timeline} />
      <div className="mt-4 grid gap-4 sm:grid-cols-[1.6fr_1fr]">
        <RecentDetections items={detections} />
        <RoomStatus occupied={occupied} />
      </div>
    </Card>
  );
}
