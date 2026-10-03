import Icon from './Icon';
import Sparkline from './charts/Sparkline';

/** Yläreunan mittauskortti: ikoni, nykyinen arvo, 24 h muutos ja minikäyrä. */
export default function StatCard({ icon, label, value, unit, delta, history, color }) {
  const up = delta && !delta.startsWith('-');

  return (
    <article className="flex items-center gap-4 rounded-2xl border border-blue-400/15 bg-[#0a1a3d]/80 p-5 shadow-[0_0_40px_rgba(37,99,235,.08)]">
      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-[0_0_20px_rgba(59,130,246,.45)]">
        <Icon name={icon} size={26} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-300">{label}</p>
        <p className="text-2xl font-bold text-white">
          {value} <span className="text-xl">{unit}</span>
        </p>
        {delta && (
          <p className={`mt-1 flex items-center gap-1 text-xs ${up ? 'text-emerald-400' : 'text-red-400'}`}>
            <Icon name={up ? 'arrowUp' : 'arrowDown'} size={12} />
            {delta} (24 h)
          </p>
        )}
      </div>
      {history?.length >= 2 && <Sparkline values={history} color={color} />}
    </article>
  );
}
