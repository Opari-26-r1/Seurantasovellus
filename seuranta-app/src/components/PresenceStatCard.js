import Icon from './Icon';
import { StatusDot } from './Card';

/** occupied: true | false | null (ei tietoa) */
export default function PresenceStatCard({ occupied }) {
  const title = occupied == null ? 'Ei tietoa' : occupied ? 'Huoneessa liikettä' : 'Huone tyhjä';
  const detail = occupied == null ? 'Odotetaan mittauksia' : occupied ? 'Liikettä havaittu' : 'Ei liikettä havaittu';

  return (
    <article className="flex items-center gap-4 rounded-2xl border border-blue-400/15 bg-[#0a1a3d]/80 p-5 shadow-[0_0_40px_rgba(37,99,235,.08)]">
      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-gradient-to-br from-teal-500 to-teal-700 text-white shadow-[0_0_20px_rgba(20,184,166,.4)]">
        <Icon name="user" size={26} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-300">Presenssi</p>
        <p className="text-2xl font-bold text-white">{title}</p>
        <p className="mt-1 text-xs text-slate-400">{detail}</p>
      </div>
      {occupied != null && <StatusDot ok />}
    </article>
  );
}
