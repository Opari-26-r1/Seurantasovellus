import { useCallback, useState } from 'react';
import Card, { CardHeader } from './Card';
import Icon from './Icon';
import AreaChart from './charts/AreaChart';
import ChartModal from './ChartModal';

/** Dashboardin kaaviokortti: 24 h näkymä + laajennusnappi, joka avaa aikavälivalinnan modalissa. */
export default function ChartCard({ title, data, series, leftAxis, rightAxis }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const showLegend = series.length > 1;

  return (
    <Card>
      <CardHeader
        title={title}
        subtitle={<><Icon name="clock" size={14} /> Viimeiset 24 tuntia</>}
        right={
          <div className="flex items-center gap-4 text-xs text-slate-300">
            {showLegend &&
              series.map((s) => (
                <span key={s.key} className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                  {s.label}
                </span>
              ))}
            <button
              onClick={() => setOpen(true)}
              aria-label={`Avaa ${title} isompana`}
              title="Avaa isompana"
              className="grid h-8 w-8 place-items-center rounded-lg border border-blue-400/20 text-slate-300 transition hover:border-blue-400/50 hover:text-white"
            >
              <Icon name="expand" size={16} />
            </button>
          </div>
        }
      />
      <AreaChart data={data} series={series} leftAxis={leftAxis} rightAxis={rightAxis} />

      {open && (
        <ChartModal title={title} series={series} leftAxis={leftAxis} rightAxis={rightAxis} onClose={close} />
      )}
    </Card>
  );
}
