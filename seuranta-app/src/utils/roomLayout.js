// Huoneen pohja ja laitteiden sijainnit metreinä: { walls: [[x, y], ...], devices: { rx: [x, y], '1': [x, y], ... } }
const STORAGE_KEY = 'seuranta.roomLayout.v2';
export const DEFAULT_WALLS = [[2, 2], [7, 2], [7, 6], [2, 6]];

export function loadLayout() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

export function saveLayout(layout) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // tallennus ei ole saatavilla (esim. yksityinen ikkuna) -> asettelu pysyy vain tämän session ajan
  }
}

export function bounds(points) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

export const toPoints = (walls) => walls.map((p) => p.join(',')).join(' ');

/** Pinta-ala m² (shoelace-kaava). */
export function area(walls) {
  const sum = walls.reduce((acc, [x1, y1], i) => {
    const [x2, y2] = walls[(i + 1) % walls.length];
    return acc + x1 * y2 - x2 * y1;
  }, 0);
  return Math.abs(sum) / 2;
}

/** Täydentää puuttuvat tiedot: oletushuone, RX keskelle ja TX:t nurkkiin 0,5 m seinistä. */
export function withDefaults(layout, txIds) {
  const walls = layout?.walls?.length >= 3 ? layout.walls : DEFAULT_WALLS;
  const devices = { ...layout?.devices };
  const { minX, minY, maxX, maxY } = bounds(walls);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const spots = [
    [minX + 0.5, minY + 0.5], [maxX - 0.5, minY + 0.5], [maxX - 0.5, maxY - 0.5], [minX + 0.5, maxY - 0.5],
    [cx, minY + 0.5], [maxX - 0.5, cy], [cx, maxY - 0.5], [minX + 0.5, cy],
  ];
  if (!devices.rx) devices.rx = [cx, cy];
  txIds.forEach((id, i) => {
    if (!devices[id]) devices[id] = spots[i % spots.length];
  });
  return { walls, devices };
}
