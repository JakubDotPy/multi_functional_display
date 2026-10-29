import { LEGS, ROUTE, ROUTE_LENGTH, angleDiff, bearingDeg } from './route';

/**
 * Deterministic telemetry source. Every value is a pure function of simulated
 * time `t` (seconds), so the same `t` always yields the same picture — which
 * makes pause/resume trivial and tests reproducible. No randomness, no I/O.
 */
export interface Telemetry {
  t: number;
  /** indicated airspeed, knots */
  ias: number;
  /** ground speed, knots */
  gs: number;
  /** altitude, feet */
  alt: number;
  /** vertical speed, feet per minute */
  vs: number;
  /** heading, degrees true */
  hdg: number;
  /** ownship position, NM */
  x: number;
  y: number;
  /** index of the leg being flown and the next waypoint index */
  leg: number;
  nextWp: number;
  /** distance flown along the route loop, NM */
  along: number;
  /** trend values: predicted change over the next 6 s */
  iasTrend: number;
  altTrend: number;
}

const NOMINAL_GS = 480; // kt
const BLEND_NM = 3; // heading blend distance before a turn

export function iasAt(t: number): number {
  return 342 + 16 * Math.sin(t / 23) + 6 * Math.sin(t / 7.3);
}

export function altAt(t: number): number {
  return 18000 + 1500 * Math.sin(t / 61) + 300 * Math.sin(t / 17);
}

/** analytic derivative of altAt, converted to ft/min */
export function vsAt(t: number): number {
  return 60 * ((1500 / 61) * Math.cos(t / 61) + (300 / 17) * Math.cos(t / 17));
}

export function telemetry(t: number): Telemetry {
  const along = ((NOMINAL_GS / 3600) * t + 4) % ROUTE_LENGTH;
  let legIdx = LEGS.findIndex((l) => along >= l.start && along < l.start + l.length);
  if (legIdx < 0) legIdx = LEGS.length - 1;
  const leg = LEGS[legIdx];
  const into = along - leg.start;
  const f = into / leg.length;
  const x = leg.from.x + (leg.to.x - leg.from.x) * f;
  const y = leg.from.y + (leg.to.y - leg.from.y) * f;

  // heading: leg course, blended toward the next leg near the waypoint, plus a small weave
  let hdg = leg.course;
  const remain = leg.length - into;
  if (remain < BLEND_NM) {
    const next = LEGS[(legIdx + 1) % LEGS.length];
    const k = 1 - remain / BLEND_NM;
    hdg = leg.course + angleDiff(leg.course, next.course) * k * 0.5;
  } else if (into < BLEND_NM) {
    const prev = LEGS[(legIdx - 1 + LEGS.length) % LEGS.length];
    const k = 1 - into / BLEND_NM;
    hdg = leg.course + angleDiff(leg.course, prev.course) * k * 0.5;
  }
  hdg = (hdg + 1.5 * Math.sin(t / 9.1) + 360) % 360;

  const ias = iasAt(t);
  const alt = altAt(t);
  return {
    t,
    ias,
    gs: NOMINAL_GS + 8 * Math.sin(t / 29),
    alt,
    vs: vsAt(t),
    hdg,
    x,
    y,
    leg: legIdx,
    nextWp: (legIdx + 1) % ROUTE.length,
    along,
    iasTrend: iasAt(t + 6) - ias,
    altTrend: altAt(t + 6) - alt,
  };
}

export interface SteerInfo {
  bearing: number;
  range: number;
  /** estimated time enroute, seconds */
  ete: number;
}

export function steerInfo(tel: Telemetry, wpIndex: number): SteerInfo {
  const wp = ROUTE[wpIndex];
  const dx = wp.x - tel.x;
  const dy = wp.y - tel.y;
  const range = Math.hypot(dx, dy);
  return { bearing: bearingDeg(dx, dy), range, ete: (range / tel.gs) * 3600 };
}

/** Telemetry samples every `step` seconds, newest first, for the DATA page. */
export function telemetryHistory(t: number, step = 5, max = 40): Telemetry[] {
  const out: Telemetry[] = [];
  let s = Math.floor(t / step) * step;
  while (s >= step && out.length < max) {
    out.push(telemetry(s));
    s -= step;
  }
  return out;
}
