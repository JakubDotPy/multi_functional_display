/**
 * Fictional training route. Coordinates are nautical miles on a flat local grid
 * (x = east, y = north). Names and positions are invented and do not
 * correspond to any real place or navigation fix.
 */
export interface Waypoint {
  id: string;
  name: string;
  x: number;
  y: number;
}

export const ROUTE: Waypoint[] = [
  { id: '01', name: 'KESTL', x: 0, y: 0 },
  { id: '02', name: 'MARLO', x: 26, y: 36 },
  { id: '03', name: 'ODRIN', x: 70, y: 42 },
  { id: '04', name: 'TALVN', x: 94, y: 8 },
  { id: '05', name: 'BRISK', x: 66, y: -28 },
  { id: '06', name: 'SOLLA', x: 20, y: -24 },
];

/** Decorative-but-meaningful map background: fictional coastline and lake outlines (NM). */
export const TERRAIN: Array<Array<[number, number]>> = [
  [
    [-40, 70], [-18, 58], [-6, 62], [10, 52], [22, 60], [40, 66], [58, 62], [78, 70], [104, 64], [130, 72],
  ],
  [
    [44, 4], [52, 12], [60, 10], [62, 0], [56, -8], [46, -6], [44, 4],
  ],
  [
    [-30, -40], [-12, -52], [8, -50], [30, -62], [52, -56], [80, -66], [110, -58],
  ],
  [
    [112, 40], [118, 20], [114, 0], [122, -18], [118, -40],
  ],
];

export interface Leg {
  from: Waypoint;
  to: Waypoint;
  length: number;
  /** true course in degrees, 0 = north */
  course: number;
  /** cumulative distance at leg start */
  start: number;
}

export function bearingDeg(dx: number, dy: number): number {
  const b = (Math.atan2(dx, dy) * 180) / Math.PI;
  return (b + 360) % 360;
}

export const LEGS: Leg[] = (() => {
  const legs: Leg[] = [];
  let acc = 0;
  for (let i = 0; i < ROUTE.length; i++) {
    const from = ROUTE[i];
    const to = ROUTE[(i + 1) % ROUTE.length];
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy);
    legs.push({ from, to, length, course: bearingDeg(dx, dy), start: acc });
    acc += length;
  }
  return legs;
})();

export const ROUTE_LENGTH = LEGS.reduce((s, l) => s + l.length, 0);

/** Shortest signed angular difference b - a in degrees (-180..180]. */
export function angleDiff(a: number, b: number): number {
  let d = ((b - a) % 360 + 540) % 360 - 180;
  if (d === -180) d = 180;
  return d;
}
