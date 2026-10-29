import type { OsbId, RockerId } from '../core/types';

/** Logical sizes (CSS px before uniform scaling). */
export const STAGE = { full: { w: 800, h: 600 }, bezel: { w: 600, h: 600 }, display: { w: 440, h: 440 } } as const;
export type StageMode = keyof typeof STAGE;

export const BEZEL_SIZE = 568;
/** width of the bezel ring around the glass */
export const RING = 64;
export const DISPLAY = 440;
export const OSB_SIZE = 38;
const PITCH = 76;
const FIRST = RING + DISPLAY / 2 - 2 * PITCH; // 132

export type Side = 'top' | 'right' | 'bottom' | 'left';

export function osbSide(id: OsbId): Side {
  return id <= 5 ? 'top' : id <= 10 ? 'right' : id <= 15 ? 'bottom' : 'left';
}

/** Button centre in bezel coordinates. */
export function osbCenter(id: OsbId): { x: number; y: number } {
  const edge = RING / 2;
  const far = BEZEL_SIZE - RING / 2;
  const last = FIRST + 4 * PITCH;
  switch (osbSide(id)) {
    case 'top': return { x: FIRST + (id - 1) * PITCH, y: edge };
    case 'right': return { x: far, y: FIRST + (id - 6) * PITCH };
    case 'bottom': return { x: last - (id - 11) * PITCH, y: far };
    case 'left': return { x: edge, y: last - (id - 16) * PITCH };
  }
}

/** Legend anchor in display (glass) coordinates. */
export function legendAnchor(id: OsbId): { x: number; y: number; side: Side } {
  const c = osbCenter(id);
  const side = osbSide(id);
  switch (side) {
    case 'top': return { x: c.x - RING, y: 18, side };
    case 'bottom': return { x: c.x - RING, y: DISPLAY - 12, side };
    case 'left': return { x: 7, y: c.y - RING, side };
    case 'right': return { x: DISPLAY - 7, y: c.y - RING, side };
  }
}

export const ROCKER_POS: Record<RockerId, { x: number; y: number }> = {
  GAIN: { x: 34, y: 34 },
  SYM: { x: BEZEL_SIZE - 34, y: 34 },
  BRT: { x: 34, y: BEZEL_SIZE - 34 },
  CON: { x: BEZEL_SIZE - 34, y: BEZEL_SIZE - 34 },
};

/** Central drawing area free of legends, in glass coordinates. */
export const AREA = { x: 60, y: 54, w: 320, h: 332 } as const;
export const AREA_CX = AREA.x + AREA.w / 2;
export const AREA_CY = AREA.y + AREA.h / 2;

/** approximate advance width of the mono font, for legend boxes */
export const charW = (fontSize: number) => fontSize * 0.6;
