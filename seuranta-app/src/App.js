import { useState } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import StatCard from './components/StatCard';
import PresenceStatCard from './components/PresenceStatCard';
import TempHumidityChart from './components/TempHumidityChart';
import PressureChart from './components/PressureChart';
import PresenceCard from './components/PresenceCard';
import EspStatusCard from './components/EspStatusCard';
import SensorStatusCard from './components/SensorStatusCard';
import useBackendStatus from './hooks/useBackendStatus';
import usePolling from './hooks/usePolling';
import { formatDelta } from './utils/format';

function App() {
  const [activeNav, setActiveNav] = useState('Yleiskatsaus');
  const [menuOpen, setMenuOpen] = useState(false);
  const backendState = useBackendStatus();

  // ESP lähettää 30 s välein -> uusin arvo haetaan 10 s välein, kaaviot harvemmin
  const { data: latest, error: latestError } = usePolling('/readings/latest', 10000);
  const { data: dayReadings } = usePolling('/readings?range=24h', 60000);
  const { data: detections } = usePolling('/presence/recent?limit=4', 30000);

  const readings = dayReadings ?? [];
  const noData = latestError?.status === 404;

  const history = (key) => readings.map((r) => r[key]).filter((v) => v != null);
  const delta = (key, unit, decimals) => {
    const values = history(key);
    if (latest?.[key] == null || values.length < 2) return null;
    return formatDelta(latest[key] - values[0], unit, decimals);
  };
  const value = (key, decimals) => (latest?.[key] == null ? '–' : latest[key].toFixed(decimals));

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,#0b2a6b_0%,#051232_45%,#030b22_100%)] text-slate-100">
      <div className="sr-only">Seurantasovellus</div>

      <Sidebar
        active={activeNav}
        onSelect={(label) => { setActiveNav(label); setMenuOpen(false); }}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
      />

      <main className="min-h-screen p-4 md:p-8 lg:pl-[272px]">
        <Header backendState={backendState} onOpenMenu={() => setMenuOpen(true)} />

        {noData && (
          <p className="mb-5 rounded-xl border border-amber-400/30 bg-amber-400/5 p-4 text-sm text-amber-200">
            Tietokannassa ei ole vielä mittauksia. Dashboard päivittyy, kun ESP32 lähettää ensimmäisen mittauksen.
          </p>
        )}

        <section className="mb-5 grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
          <StatCard
            icon="thermometer"
            label="Lämpötila"
            value={value('temperature', 1)}
            unit="°C"
            delta={delta('temperature', '°C')}
            history={history('temperature')}
            color="#22d3ee"
          />
          <StatCard
            icon="droplet"
            label="Ilmankosteus"
            value={value('humidity', 0)}
            unit="%"
            delta={delta('humidity', '%', 0)}
            history={history('humidity')}
            color="#38bdf8"
          />
          <StatCard
            icon="gauge"
            label="Ilmanpaine"
            value={value('pressure', 0)}
            unit="hPa"
            delta={delta('pressure', 'hPa', 0)}
            history={history('pressure')}
            color="#38bdf8"
          />
          <PresenceStatCard occupied={latest?.motion ?? null} />
        </section>

        <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
          <div className="space-y-5">
            <TempHumidityChart data={readings} />
            <PressureChart data={readings} />
          </div>
          <div className="space-y-5">
            <PresenceCard
              timeline={readings.map((r) => ({ time: r.time, motion: !!r.motion }))}
              detections={detections ?? []}
              occupied={latest?.motion ?? null}
            />
            <div className="grid gap-5 md:grid-cols-2">
              <EspStatusCard latest={latest} />
              <SensorStatusCard latest={latest} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
