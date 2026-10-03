import Card, { CardHeader, StatusDot } from './Card';
import Icon from './Icon';
import { formatDateTime, formatUptime, rssiToBars } from '../utils/format';

function SignalBars({ bars }) {
  return (
    <span className="flex h-5 items-end gap-[3px]">
      {[1, 2, 3, 4].map((b) => (
        <span
          key={b}
          className={`w-1 rounded-sm ${b <= bars ? 'bg-sky-400' : 'bg-slate-600'}`}
          style={{ height: `${b * 25}%` }}
        />
      ))}
    </span>
  );
}

function Row({ icon, label, children }) {
  return (
    <div className="flex items-center gap-3 border-t border-blue-400/10 py-3 text-sm">
      <span className="text-sky-400"><Icon name={icon} size={20} /></span>
      <span className="flex-1 text-xs text-slate-300">{label}</span>
      <span className="flex items-center gap-2 font-medium text-white">{children}</span>
    </div>
  );
}

/** latest: /readings/latest -vastaus tai null */
export default function EspStatusCard({ latest }) {
  const connected = latest?.online ?? false;

  return (
    <Card>
      <CardHeader
        icon="chip"
        title="ESP32 status"
        subtitle={
          <span className={`flex items-center gap-1.5 ${connected ? 'text-emerald-400' : 'text-red-400'}`}>
            <StatusDot ok={connected} /> {connected ? 'Yhdistetty' : 'Ei yhteyttä'}
          </span>
        }
      />
      <Row icon="wifi" label="Wi-Fi-signaali">
        {latest?.rssi != null ? <><SignalBars bars={rssiToBars(latest.rssi)} /> {latest.rssi} dBm</> : '–'}
      </Row>
      <Row icon="clock" label="Viimeisin päivitys">{latest ? formatDateTime(latest.time) : '–'}</Row>
      <Row icon="timer" label="Käyttöaika">{latest?.uptime_s != null ? formatUptime(latest.uptime_s) : '–'}</Row>
    </Card>
  );
}
