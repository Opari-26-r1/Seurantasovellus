import Card, { CardHeader, StatusDot } from './Card';
import Icon from './Icon';

const fmt = (v, decimals, unit) => (v == null ? '–' : `${v.toFixed(decimals)} ${unit}`);

/** Sensori on OK, kun laite on yhteydessä ja sensori on lähettänyt arvon uusimmassa mittauksessa. */
export default function SensorStatusCard({ latest }) {
  const online = latest?.online ?? false;
  const sensors = [
    { icon: 'thermometer', label: 'Lämpötila', value: fmt(latest?.temperature, 1, '°C'), ok: online && latest.temperature != null },
    { icon: 'droplet', label: 'Ilmankosteus', value: fmt(latest?.humidity, 0, '%'), ok: online && latest.humidity != null },
    { icon: 'gauge', label: 'Ilmanpaine', value: fmt(latest?.pressure, 0, 'hPa'), ok: online && latest.pressure != null },
    {
      icon: 'wifi',
      label: 'Wi-Fi sensing',
      value: online && latest.motion != null ? 'Toiminnassa' : 'Ei dataa',
      ok: online && latest.motion != null,
    },
  ];

  return (
    <Card>
      <CardHeader icon="sensors" title="Sensorien tila" />
      <ul>
        {sensors.map((s) => (
          <li key={s.label} className="flex items-center gap-3 border-t border-blue-400/10 py-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-600/25 text-blue-300">
              <Icon name={s.icon} size={18} />
            </span>
            <div className="flex-1">
              <p className="text-[11px] text-slate-400">{s.label}</p>
              <p className="text-sm font-semibold text-white">{s.value}</p>
            </div>
            <span className={`flex items-center gap-1.5 text-xs ${s.ok ? 'text-emerald-400' : 'text-red-400'}`}>
              <StatusDot ok={s.ok} /> {s.ok ? 'OK' : 'Vika'}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
