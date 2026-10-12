import Card, { CardHeader } from './Card';
import { formatHour } from './charts/AreaChart';

const clock = (iso) => new Date(iso).toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' });
const txLabel = (ids) => `TX ${ids.join(', ')}`;

function Legend() {
  return (
    <div className="flex gap-4 text-xs text-slate-300">
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-blue-600" />Ei liikettä</span>
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />Liike havaittu</span>
    </div>
  );
}

function MotionDot({ active }) {
  return (
    <span
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${
        active ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-slate-500'
      }`}
    />
  );
}

/** Yksi aikajanan rivi: label + jaksot. motionAt(time) palauttaa true/false/undefined (ei dataa). */
function Lane({ label, slots, motionAt, tall }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`w-12 shrink-0 text-[11px] ${tall ? 'font-semibold text-white' : 'text-slate-400'}`}>{label}</span>
      <div className={`flex flex-1 gap-[2px] overflow-hidden rounded ${tall ? 'h-7' : 'h-4'}`}>
        {slots.map((s) => {
          const motion = motionAt(s.time);
          return (
            <div
              key={s.time}
              title={`${label} ${clock(s.time)} – ${motion == null ? 'ei dataa' : motion ? 'liikettä' : 'ei liikettä'}`}
              className={`flex-1 ${
                motion == null ? 'bg-blue-950/60' : motion ? 'bg-emerald-400/90 shadow-[0_0_10px_#34d399]' : 'bg-blue-700/60'
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}

function Timeline({ slots, txIds, linkMotion }) {
  if (slots.length === 0) {
    return <div className="grid h-14 place-items-center rounded-lg bg-blue-900/30 text-xs text-slate-400">Ei dataa viimeiseltä 24 tunnilta</div>;
  }
  const roomMotion = Object.fromEntries(slots.map((s) => [s.time, s.motion]));

  return (
    <div className="space-y-1.5">
      <Lane label="Huone" slots={slots} motionAt={(t) => roomMotion[t]} tall />
      {txIds.map((tx) => (
        <Lane key={tx} label={`TX ${tx}`} slots={slots} motionAt={(t) => linkMotion[`${t}|${tx}`]} />
      ))}
      <div className="relative ml-14 h-4 text-[11px] text-slate-400">
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
            <MotionDot active />
            <span className="w-12 font-semibold text-white">{clock(d.start)}</span>
            <span className="w-14 text-slate-300">{Math.max(1, Math.round(d.duration_s / 60))} min</span>
            <span className="text-xs text-slate-400">
              {d.ongoing ? 'Jatkuu' : 'Havaittu'}
              {d.tx_ids?.length > 0 && <span className="ml-1 font-medium text-emerald-300">· {txLabel(d.tx_ids)}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Linjojen nykytila uusimmasta mittauksesta. */
function LinkStatus({ links, occupied }) {
  return (
    <div className="rounded-xl border border-blue-400/15 p-4">
      <h3 className="mb-1 text-sm font-semibold text-white">Linjat nyt</h3>
      <p className="mb-2 flex items-center gap-2 text-xs text-slate-300">
        <MotionDot active={!!occupied} />
        {occupied == null ? 'Ei tietoa' : occupied ? 'Huoneessa liikettä' : 'Huone tyhjä'}
      </p>
      {links.length === 0 ? (
        <p className="py-2 text-xs text-slate-400">Ei linjakohtaista dataa</p>
      ) : (
        <ul className="divide-y divide-blue-400/10">
          {links.map((l) => (
            <li key={l.tx_id} className="flex items-center gap-2 py-1.5 text-sm" title="Varianssi = CSI-signaalin vaihtelu">
              <MotionDot active={l.presence} />
              <span className="w-10 font-semibold text-white">TX {l.tx_id}</span>
              <span className={`flex-1 text-xs ${l.presence ? 'text-emerald-300' : 'text-slate-400'}`}>
                {l.presence ? 'Liikettä' : 'Ei liikettä'}
              </span>
              <span className="text-[11px] text-slate-500">{l.variance != null ? l.variance.toFixed(1) : '–'}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * timeline:     [{ time, motion }]                 huoneen yhteinen tila (/readings?range=24h)
 * linkTimeline: [{ time, tx_id, presence }]        linjakohtainen tila (/presence/timeline)
 * links:        [{ tx_id, variance, presence }]    linjojen nykytila (/readings/latest)
 */
export default function PresenceCard({ timeline, linkTimeline, links, detections, occupied }) {
  const txIds = [...new Set([...linkTimeline.map((r) => r.tx_id), ...links.map((l) => l.tx_id)])].sort((a, b) => a - b);
  const linkMotion = Object.fromEntries(linkTimeline.map((r) => [`${r.time}|${r.tx_id}`, r.presence]));

  return (
    <Card>
      <CardHeader
        icon="user"
        title="Presenssin tunnistus"
        subtitle="Liikehavainnot linjoittain viimeisen 24 tunnin aikana"
        right={<Legend />}
      />
      <Timeline slots={timeline} txIds={txIds} linkMotion={linkMotion} />
      <div className="mt-4 grid gap-4 sm:grid-cols-[1.4fr_1fr]">
        <RecentDetections items={detections} />
        <LinkStatus links={links} occupied={occupied} />
      </div>
    </Card>
  );
}
