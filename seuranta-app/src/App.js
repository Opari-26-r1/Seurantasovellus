import { useEffect, useState, useMemo } from 'react';
import './App.css';

const API_URL = process.env.REACT_APP_API_URL || '';

const toneClasses = {
  blue: 'bg-blue-50 text-blue-600',
  violet: 'bg-violet-50 text-violet-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  red: 'bg-red-50 text-red-600',
};

function Icon({ name, size = 18 }) {
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>,
    sensor: <><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /><circle cx="12" cy="12" r="3" /></>,
    wave: <path d="M3 12h2.5l2-6 3 12 3-10 2.5 7 2-3H21" />,
    alert: <><path d="M10.3 3.4 2.6 17a2 2 0 0 0 1.73 3h15.34a2 2 0 0 0 1.73-3L13.7 3.4a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 8.94 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15 1.7 1.7 0 0 0 3 14H3v-4h.08A1.7 1.7 0 0 0 4.6 8.94a1.7 1.7 0 0 0-.34-1.88L4.2 7l2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3V3h4v.08A1.7 1.7 0 0 0 15.06 4.6a1.7 1.7 0 0 0 1.88-.34L17 4.2 19.83 7l-.06.06A1.7 1.7 0 0 0 19.4 9c.22.62.8 1.03 1.46 1.03H21v4h-.08A1.7 1.7 0 0 0 19.4 15Z" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
    chevron: <path d="m9 18 6-6-6-6" />,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    wifi: <><path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0" /><circle cx="12" cy="19" r="1" fill="currentColor" stroke="none" /></>,
    activity: <path d="M3 12h4l2-7 4 14 2-7h6" />,
    check: <path d="m5 12 4 4L19 6" />,
  };

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

const sensors = [
  { name: "Entrance Radar", id: "RD-1001", type: "mmWave", value: "24.6", unit: "°C", trend: "+0.8%", state: "Online", color: "#2f6fed" },
  { name: "Zone A Sensor", id: "SN-2048", type: "Presence", value: "42.1", unit: "%", trend: "-1.2%", state: "Online", color: "#7c3aed" },
  { name: "Server Room", id: "SN-4096", type: "Humidity", value: "56.8", unit: "%", trend: "+2.1%", state: "Warning", color: "#f59e0b" },
  { name: "West Corridor", id: "CSI-3087", type: "CSI Node", value: "-48", unit: "dBm", trend: "+0.4%", state: "Online", color: "#16a34a" },
];
const nav = [
  { label: "Overview", icon: "grid" },
  { label: "Sensors", icon: "sensor" },
  { label: "CSI Streams", icon: "wave" },
  { label: "Alerts", icon: "alert", badge: "3" },
];

function LineChart({ range }) {
  const paths = {
    "1H": "M0 126 C30 121,45 126,72 105 S122 116,150 88 S203 100,231 74 S285 82,314 50 S370 69,400 42 S454 52,480 28",
    "6H": "M0 114 C25 105,43 119,68 101 S112 94,138 106 S184 75,211 83 S260 65,289 79 S340 48,365 59 S430 24,480 38",
    "24H": "M0 122 C31 114,45 89,76 96 S126 119,153 92 S207 84,237 61 S288 76,315 55 S367 64,397 35 S449 47,480 29",
    "7D": "M0 132 C35 126,50 91,86 103 S139 76,171 87 S227 45,258 61 S312 77,345 43 S427 23,480 37",
  };
  return (
    <div className="relative h-[210px] w-full overflow-hidden">
      <svg className="h-full w-full" viewBox="0 0 480 170" preserveAspectRatio="none" role="img" aria-label={`Signal strength over ${range}`}>
        <defs>
          <linearGradient id="signalFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2f6fed" stopOpacity=".2" />
            <stop offset="100%" stopColor="#2f6fed" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[26, 62, 98, 134].map((y) => <line key={y} x1="0" x2="480" y1={y} y2={y} stroke="#e7e9ee" strokeWidth="1" strokeDasharray="3 5" />)}
        <path d={`${paths[range]} L480 170 L0 170Z`} fill="url(#signalFill)" />
        <path d={paths[range]} fill="none" stroke="#2f6fed" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
        <circle cx="397" cy="35" r="4" fill="#fff" stroke="#2f6fed" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="absolute inset-x-0 bottom-0 flex justify-between text-[11px] text-slate-400">
        <span>12:00</span><span>14:00</span><span>16:00</span><span>18:00</span><span>20:00</span><span>Now</span>
      </div>
    </div>
  );
}

function CsiChart() {
  const bars = useMemo(() => Array.from({ length: 50 }, (_, i) => {
    const height = 18 + Math.abs(Math.sin(i * 1.8) * 24) + Math.abs(Math.cos(i * .43) * 19);
    return { height, opacity: .42 + (height / 80) };
  }), []);
  return (
    <div className="mt-5 flex h-[132px] items-end gap-[3px] border-b border-slate-200 pb-1">
      {bars.map((bar, i) => (
        <div key={i} className="min-w-0 flex-1 rounded-t-[2px] bg-violet-500 transition-all hover:bg-violet-700" style={{ height: `${bar.height}%`, opacity: bar.opacity }} />
      ))}
    </div>
  );
}

function App() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [activeNav, setActiveNav] = useState('Overview');
  const [mobileNav, setMobileNav] = useState(false);
  const [range, setRange] = useState('6H');
  const [query, setQuery] = useState('');
  const [selectedSensor, setSelectedSensor] = useState(sensors[0]?.id ?? '');

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return sensors;

    return sensors.filter((sensor) =>
      sensor.name.toLowerCase().includes(search) ||
      sensor.id.toLowerCase().includes(search) ||
      sensor.type.toLowerCase().includes(search)
    );
  }, [query]);

  useEffect(() => {
    if (!API_URL) {
      setStatus({ backend: 'offline', database: 'offline' });
      return;
    }

    fetch(`${API_URL}/status`)
      .then((res) => res.json())
      .then(setStatus)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div className="min-h-screen bg-[#f5f6f8] text-[#182230]">
      <div className="sr-only">Seurantasovellus</div>
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[232px] flex-col border-r border-slate-200 bg-white transition-transform lg:translate-x-0 ${mobileNav ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-[72px] items-center gap-3 border-b border-slate-100 px-6">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#1f57d2] text-white shadow-sm shadow-blue-200"><Icon name="wave" size={20}/></div>
        </div>
        <nav className="flex-1 px-3 py-6">
          <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[.14em] text-slate-400">Valikko</p>
          <div className="space-y-1">
            {nav.map((item) => (
              <button key={item.label} onClick={() => { setActiveNav(item.label); setMobileNav(false); }} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] font-medium transition ${activeNav === item.label ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}>
                <Icon name={item.icon} size={17}/><span className="flex-1">{item.label}</span>
                {item.badge && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600">{item.badge}</span>}
              </button>
            ))}
          </div>
          <p className="mb-3 mt-8 px-3 text-[10px] font-semibold uppercase tracking-[.14em] text-slate-400">System</p>
          <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-900"><Icon name="settings" size={17}/> Settings</button>
        </nav>
      </aside>

      {mobileNav && <button aria-label="Close navigation" onClick={() => setMobileNav(false)} className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden"/>}

      <main className="min-h-screen lg:pl-[232px]">
        <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur md:px-8">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileNav(true)} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 lg:hidden" aria-label="Open navigation"><Icon name="grid"/></button>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <label className="relative hidden md:block">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Icon name="search" size={16}/></span>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search sensors..." className="h-9 w-52 rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"/>
            </label>
            <button className="relative grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50" aria-label="Notifications"><Icon name="bell" size={17}/><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-red-500 ring-2 ring-white"/></button>
            <div className="hidden h-8 w-px bg-slate-200 sm:block"/>
            <div className="hidden items-center gap-2 text-xs font-semibold sm:flex">
              <span className={`h-2 w-2 rounded-full shadow-[0_0_0_3px_#dcfce7] ${error ? "bg-red-500" : status ? "bg-emerald-500" : "bg-amber-500"}`} />
              {error ? "Backend offline" : status ? "All systems operational" : "Checking backend..."}
              {!status && !error && <p>Ladataan...</p>}
              {status && (
                <>
                  <p>Backend: {status.backend}</p>
                  <p>Tietokanta: {status.database}</p>
                </>
              )}
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[1440px] p-4 md:p-8">

          <section className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
            {[
              { label: "Active sensors", value: "128", detail: "of 132 total", icon: "sensor", tone: "blue" },
              { label: "CSI data rate", value: "8.42", suffix: "GB/s", detail: "+12.4% today", icon: "wave", tone: "violet" },
              { label: "System health", value: "99.8", suffix: "%", detail: "All nodes stable", icon: "activity", tone: "emerald" },
              { label: "Active alerts", value: "3", detail: "1 requires review", icon: "alert", tone: "amber" },
            ].map((stat) => (
              <article key={stat.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,.03)] md:p-5">
                <div className="mb-4 flex items-start justify-between">
                  <p className="text-xs font-medium text-slate-500">{stat.label}</p>
                  <span className={`grid h-8 w-8 place-items-center rounded-lg ${toneClasses[stat.tone]}`}><Icon name={stat.icon} size={16}/></span>
                </div>
                <div className="flex items-baseline gap-1"><strong className="text-2xl font-bold tracking-tight md:text-[28px]">{stat.value}</strong>{stat.suffix && <span className="text-xs font-semibold text-slate-500">{stat.suffix}</span>}</div>
                <p className={`mt-1 text-[11px] ${stat.tone === "amber" ? "text-amber-600" : "text-slate-400"}`}>{stat.detail}</p>
              </article>
            ))}
          </section>

          <section className="mb-5 grid gap-5 xl:grid-cols-[1.65fr_1fr]">
            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,.03)] md:p-5">
              <div className="flex items-start justify-between"><div><h3 className="text-sm font-bold">CSI amplitude</h3><p className="mt-1 text-[11px] text-slate-400">Subcarrier activity · Stream 04</p></div><button className="text-slate-400 hover:text-slate-800"><Icon name="chevron" size={17}/></button></div>
              <div className="mt-5 flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-lg bg-violet-50 text-violet-600"><Icon name="wifi" size={19}/></div><div><div className="flex items-baseline gap-1"><span className="text-2xl font-bold">0.847</span><span className="text-[10px] text-slate-400">normalized</span></div><p className="text-[10px] text-emerald-600">Stable signal quality</p></div></div>
              <CsiChart/>
              <div className="mt-3 flex justify-between text-[10px] text-slate-400"><span>Subcarrier 1</span><span>32</span><span>64</span><span>96</span><span>128</span></div>
            </article>

            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,.03)] md:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><h3 className="text-sm font-bold">Network signal strength</h3></div>
              </div>
              <div className="mt-5 flex items-end gap-2"><span className="text-2xl font-bold">-47.2</span></div>
            </article>
          </section>

          <section className="grid gap-5 xl:grid-cols-[1.65fr_1fr]">
            <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,.03)]">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4 md:px-5"><div><h3 className="text-sm font-bold">Sensor overview</h3><p className="mt-1 text-[11px] text-slate-400">{filtered.length} monitored devices</p></div><button className="flex items-center gap-2 text-[11px] font-semibold text-blue-600 hover:text-blue-800">View all <Icon name="arrow" size={14}/></button></div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[650px] text-left">
                  <thead><tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] uppercase tracking-[.08em] text-slate-400"><th className="px-5 py-3 font-semibold">Device</th><th className="px-4 py-3 font-semibold">Type</th><th className="px-4 py-3 font-semibold">Reading</th><th className="px-4 py-3 font-semibold">Change</th><th className="px-4 py-3 font-semibold">Status</th><th className="w-10"/></tr></thead>
                  <tbody>
                    {filtered.map((sensor) => (
                      <tr key={sensor.id} onClick={() => setSelectedSensor(sensor.id)} className={`cursor-pointer border-b border-slate-100 text-xs transition last:border-0 hover:bg-slate-50 ${selectedSensor === sensor.id ? "bg-blue-50/40" : ""}`}>
                        <td className="px-5 py-3.5"><div className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-lg text-white" style={{backgroundColor: sensor.color}}><Icon name={sensor.type === "CSI Node" ? "wave" : "sensor"} size={15}/></span><div><p className="font-semibold">{sensor.name}</p><p className="mt-0.5 text-[10px] text-slate-400">{sensor.id}</p></div></div></td>
                        <td className="px-4 text-slate-500">{sensor.type}</td><td className="px-4 font-bold">{sensor.value} <span className="font-normal text-slate-400">{sensor.unit}</span></td>
                        <td className={`px-4 font-semibold ${sensor.trend.startsWith("+") ? "text-emerald-600" : "text-red-500"}`}>{sensor.trend}</td>
                        <td className="px-4"><span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-semibold ${sensor.state === "Warning" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}><span className={`h-1.5 w-1.5 rounded-full ${sensor.state === "Warning" ? "bg-amber-500" : "bg-emerald-500"}`}/>{sensor.state}</span></td>
                        <td className="pr-4 text-slate-300"><Icon name="chevron" size={14}/></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,.03)]">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h3 className="text-sm font-bold">Recent alerts</h3><p className="mt-1 text-[11px] text-slate-400">Last 24 hours</p></div><button className="text-[11px] font-semibold text-blue-600">View all</button></div>
              <div className="divide-y divide-slate-100 px-5">
                {[
                  { title: "Humidity threshold exceeded", meta: "Server Room · 6 min ago", tone: "red", icon: "alert" },
                  { title: "CSI signal variance detected", meta: "West Corridor · 42 min ago", tone: "amber", icon: "wave" },
                  { title: "Sensor reconnected", meta: "Zone B · 2 hours ago", tone: "emerald", icon: "check" },
                ].map((alert) => <div key={alert.title} className="flex gap-3 py-4"><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${toneClasses[alert.tone]}`}><Icon name={alert.icon} size={15}/></span><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{alert.title}</p><p className="mt-1 flex items-center gap-1 text-[10px] text-slate-400"><Icon name="clock" size={11}/>{alert.meta}</p></div><Icon name="chevron" size={14}/></div>)}
              </div>
              <div className="mx-5 mb-5 flex items-center gap-3 rounded-lg bg-blue-50 p-3"><div className="grid h-7 w-7 place-items-center rounded-md bg-blue-600 text-white"><Icon name="activity" size={14}/></div><div className="flex-1"><p className="text-[11px] font-semibold text-blue-950">Automated monitoring active</p><p className="text-[9px] text-blue-600">Anomaly detection is running</p></div><span className="h-2 w-2 rounded-full bg-emerald-500"/></div>
            </article>
          </section>
        </div>
      </main>
    </div>
  );
}

export default App;
