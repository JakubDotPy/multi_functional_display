import type { AltUnit, SpeedUnit } from './core/types';

export const KT_TO_KMH = 1.852;
export const FT_TO_M = 0.3048;

export function speed(kt: number, unit: SpeedUnit): number {
  return unit === 'KT' ? kt : kt * KT_TO_KMH;
}

export function altitude(ft: number, unit: AltUnit): number {
  return unit === 'FT' ? ft : ft * FT_TO_M;
}

/** vertical speed: ft/min or m/s */
export function vspeed(fpm: number, unit: AltUnit): number {
  return unit === 'FT' ? fpm : (fpm * FT_TO_M) / 60;
}

export const speedLabel = (u: SpeedUnit) => (u === 'KT' ? 'KT' : 'KM/H');
export const altLabel = (u: AltUnit) => (u === 'FT' ? 'FT' : 'M');
export const vsLabel = (u: AltUnit) => (u === 'FT' ? 'FPM' : 'M/S');

export function pad(n: number, width: number, ch = ' '): string {
  return String(n).padStart(width, ch);
}

export function hdg3(deg: number): string {
  const d = Math.round(deg) % 360;
  return String(d === 0 ? 360 : d).padStart(3, '0');
}

/** hh:mm:ss from a base clock of 10:00:00 plus simulated seconds */
export function clock(simTime: number, base = 10 * 3600): string {
  const s = Math.floor(base + simTime) % 86400;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${pad(h, 2, '0')}:${pad(m, 2, '0')}:${pad(sec, 2, '0')}`;
}

export function mmss(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  return `${pad(m, 2, '0')}:${pad(s % 60, 2, '0')}`;
}

export function signed(n: number, digits = 0): string {
  const r = n.toFixed(digits);
  return n > 0 && Number(r) !== 0 ? `+${r}` : r === '-0' ? '0' : r;
}
