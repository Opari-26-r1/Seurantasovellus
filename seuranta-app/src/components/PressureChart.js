import ChartCard from './ChartCard';

const series = [{ key: 'pressure', label: 'Ilmanpaine (hPa)', unit: 'hPa', color: '#3b82f6', axis: 'left' }];

export default function PressureChart({ data }) {
  return (
    <ChartCard
      title="Ilmanpaine"
      data={data}
      series={series}
      leftAxis={{ domain: [1000, 1020], ticks: [1000, 1005, 1010, 1015, 1020], unit: 'hPa' }}
    />
  );
}
