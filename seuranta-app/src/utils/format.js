export function formatDelta(value, unit, decimals = 1) {
  const rounded = Number(value.toFixed(decimals));
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${rounded} ${unit}`;
}

export function formatDateTime(isoString) {
  const d = new Date(isoString);
  return d.toLocaleString('fi-FI', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatUptime(totalSeconds) {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${days} pv ${hours} h ${minutes} min`;
}

/** Muuntaa Wi-Fi RSSI:n (dBm) 1–4 palkiksi. */
export function rssiToBars(rssi) {
  if (rssi >= -55) return 4;
  if (rssi >= -65) return 3;
  if (rssi >= -75) return 2;
  return 1;
}
