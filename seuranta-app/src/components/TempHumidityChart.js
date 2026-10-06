import ChartCard from './ChartCard';

const series = [
  { key: 'temperature', label: 'Lämpötila (°C)', unit: '°C', color: '#22d3ee', axis: 'left' },
  { key: 'humidity', label: 'Ilmankosteus (%)', unit: '%', color: '#3b82f6', axis: 'right' },
];

export default function TempHumidityChart({ data }) {
  return (
    <ChartCard
      title="Lämpötila ja ilmankosteus"
      data={data}
      series={series}
      leftAxis={{ domain: [12, 28], ticks: [12, 16, 20, 24, 28], unit: '°C' }}
      rightAxis={{ domain: [0, 80], ticks: [0, 20, 40, 60, 80], unit: '%' }}
    />
  );
}
