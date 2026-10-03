import Icon from './Icon';

const statusText = {
  loading: { label: 'Tarkistetaan yhteyttä...', dot: 'bg-amber-400' },
  ok: { label: 'Järjestelmä aktiivinen', dot: 'bg-emerald-400 shadow-[0_0_8px_#34d399]' },
  error: { label: 'Backend ei vastaa', dot: 'bg-red-500 shadow-[0_0_8px_#ef4444]' },
};

export default function Header({ backendState, onOpenMenu }) {
  const s = statusText[backendState];

  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <button
          onClick={onOpenMenu}
          aria-label="Avaa valikko"
          className="mt-1 grid h-9 w-9 place-items-center rounded-lg border border-blue-400/20 text-slate-300 lg:hidden"
        >
          <Icon name="menu" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white md:text-3xl">Ympäristön seuranta</h1>
          <p className="mt-1 text-sm text-slate-300">Reaaliaikaiset mittaukset ja presenssitiedot</p>
        </div>
      </div>

      <div className="flex items-center gap-4 text-sm text-slate-200">
        <span className="flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/5 px-4 py-2 text-xs">
          <span className={`h-2.5 w-2.5 rounded-full ${s.dot}`} />
          {s.label}
        </span>
      </div>
    </header>
  );
}
