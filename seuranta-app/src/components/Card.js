import Icon from './Icon';

export default function Card({ className = '', children }) {
  return (
    <section
      className={`rounded-2xl border border-blue-400/15 bg-[#0a1a3d]/80 p-5 shadow-[0_0_40px_rgba(37,99,235,.08)] ${className}`}
    >
      {children}
    </section>
  );
}

export function CardHeader({ icon, title, subtitle, right }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-center gap-3">
        {icon && (
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-blue-600/25 text-blue-300">
            <Icon name={icon} size={20} />
          </span>
        )}
        <div>
          <h2 className="text-base font-semibold text-white">{title}</h2>
          {subtitle && (
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">{subtitle}</p>
          )}
        </div>
      </div>
      {right}
    </div>
  );
}

export function StatusDot({ ok = true, className = '' }) {
  return (
    <span
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${
        ok ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-red-500 shadow-[0_0_8px_#ef4444]'
      } ${className}`}
    />
  );
}
