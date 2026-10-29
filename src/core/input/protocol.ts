/**
 * Line protocol shared by the serial and websocket adapters (and handy for
 * scripting). One command per line, ASCII, case-insensitive keywords.
 *
 *   → app (inputs)                  ← app (outputs, optional)
 *   OSB <1-20>                      PAGE <id>
 *   RKR <GAIN|SYM|BRT|CON> <+|->    LED <1-20> <0|1>     (1 = legend active)
 *   PAGE <id>                       LBL <1-20> <text>    (legend, '|' = newline)
 *   SIM <RUN|HOLD|TOGGLE|RESET>
 *   DATA <source-id> <json>
 *   CANCEL
 *
 * Unknown lines are ignored (parseLine returns null).
 */
import type { InputEvent, KeyMap, OsbId, RockerId } from '../types';
import { OSB_IDS, ROCKER_IDS } from '../types';

export function parseLine(raw: string): InputEvent | null {
  const line = raw.trim();
  if (!line || line.startsWith('#')) return null;
  const [cmdRaw, ...rest] = line.split(/\s+/);
  const cmd = cmdRaw.toUpperCase();
  switch (cmd) {
    case 'OSB': {
      const id = Number(rest[0]);
      return OSB_IDS.includes(id as OsbId) ? { type: 'osb', id: id as OsbId } : null;
    }
    case 'RKR': {
      const id = rest[0]?.toUpperCase() as RockerId;
      const dir = rest[1] === '+' ? 1 : rest[1] === '-' ? -1 : 0;
      return ROCKER_IDS.includes(id) && dir ? { type: 'rocker', id, dir } : null;
    }
    case 'PAGE':
      return rest[0] ? { type: 'page', page: rest[0].toUpperCase() } : null;
    case 'SIM': {
      const op = rest[0]?.toLowerCase();
      return op === 'run' || op === 'hold' || op === 'toggle' || op === 'reset' ? { type: 'sim', op } : null;
    }
    case 'DATA': {
      const source = rest[0];
      if (!source) return null;
      const payload = line.slice(line.indexOf(source) + source.length).trim();
      try {
        return { type: 'data', source, value: payload ? JSON.parse(payload) : null };
      } catch {
        return { type: 'data', source, value: payload };
      }
    }
    case 'CANCEL':
      return { type: 'cancel' };
    default:
      return null;
  }
}

/** Outbound lines describing the current display, for button LEDs / secondary displays. */
export function describeDisplay(page: string, keys: KeyMap): string[] {
  const out = [`PAGE ${page}`];
  for (const id of OSB_IDS) {
    const k = keys[id];
    out.push(`LBL ${id} ${k ? k.label.replace(/\n/g, '|') : ''}`.trimEnd());
    out.push(`LED ${id} ${k?.active ? 1 : 0}`);
  }
  return out;
}
