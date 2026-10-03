import Icon from './Icon';

export const navItems = [
  { label: 'Yleiskatsaus', icon: 'home' },
  { label: 'Sensorit', icon: 'thermometer' },
  { label: 'Historia', icon: 'history' },
];

export default function Sidebar({ active, onSelect, open, onClose }) {
  return (
    <>
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[240px] flex-col border-r border-blue-400/10 bg-[#061233] px-4 py-6 transition-transform lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <nav className="flex-1 space-y-1">
          {navItems.map((item) => {
            const isActive = active === item.label;
            return (
              <button
                key={item.label}
                onClick={() => onSelect(item.label)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700/70 text-white shadow-[0_0_20px_rgba(37,99,235,.35)]'
                    : 'text-slate-300 hover:bg-blue-500/10 hover:text-white'
                }`}
              >
                <span className={`grid h-8 w-8 place-items-center rounded-full ${isActive ? 'bg-blue-500' : 'bg-blue-500/15'}`}>
                  <Icon name={item.icon} size={16} />
                </span>
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      {open && (
        <button aria-label="Sulje valikko" onClick={onClose} className="fixed inset-0 z-30 bg-slate-950/60 lg:hidden" />
      )}
    </>
  );
}
