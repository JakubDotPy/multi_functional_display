import type { ReactNode } from 'react';
import { bindingFor } from '../core/input/keyboard';
import { useMfd } from '../core/store';
import { OSB_IDS, ROCKER_IDS } from '../core/types';
import type { OsbId, RockerId } from '../core/types';
import { BEZEL_SIZE, DISPLAY, OSB_SIZE, RING, ROCKER_POS, osbCenter, osbSide } from './geometry';

function Screw({ x, y }: { x: number; y: number }) {
  return (
    <span className="screw" style={{ left: x - 6, top: y - 6 }} aria-hidden="true">
      <span />
    </span>
  );
}

function Fence({ x, y, vertical }: { x: number; y: number; vertical: boolean }) {
  return (
    <span
      className="fence"
      aria-hidden="true"
      style={vertical ? { left: x - 2, top: y - 13, width: 4, height: 26 } : { left: x - 13, top: y - 2, width: 26, height: 4 }}
    />
  );
}

function Osb({ id }: { id: OsbId }) {
  const { engine, state, send, bindings } = useMfd();
  const k = engine.resolveKeys(state)[id];
  const c = osbCenter(id);
  const inert = !k || k.disabled || !k.press;
  const kb = bindingFor(bindings, (e) => e.type === 'osb' && e.id === id);
  const label = k ? k.label.replace('\n', ' ') : 'no function';
  const flash = state.lastPress?.key === `OSB${id}` ? state.lastPress.seq : null;
  return (
    <button
      type="button"
      className={`osb osb-${osbSide(id)}${inert ? ' is-inert' : ''}`}
      style={{ left: c.x - OSB_SIZE / 2, top: c.y - OSB_SIZE / 2 }}
      aria-label={`OSB ${id}: ${label}${k?.hint ? ` — ${k.hint}` : ''}${k?.disabled ? ' (unavailable)' : ''}`}
      aria-disabled={inert || undefined}
      aria-pressed={k?.active ?? undefined}
      aria-keyshortcuts={kb}
      title={`OSB ${id}${kb ? ` [${kb}]` : ''}${k?.hint ? ` · ${k.hint}` : ''}`}
      onClick={() => send({ type: 'osb', id }, 'ui')}
      data-osb={id}
    >
      {flash !== null && <span key={flash} className="osb-flash" aria-hidden="true" />}
    </button>
  );
}

function Rocker({ id }: { id: RockerId }) {
  const { state, send, bindings, engine } = useMfd();
  const p = ROCKER_POS[id];
  const custom = engine.config.rockers?.[id];
  const flash = state.lastPress?.key.startsWith(id) ? state.lastPress : null;
  const half = (dir: 1 | -1): ReactNode => {
    const kb = bindingFor(bindings, (e) => e.type === 'rocker' && e.id === id && e.dir === dir);
    const what = custom?.hint ?? id;
    return (
      <button
        type="button"
        className={`rocker-half ${dir > 0 ? 'up' : 'down'}`}
        aria-label={`${what} ${dir > 0 ? 'increase' : 'decrease'}`}
        aria-keyshortcuts={kb}
        title={`${id} ${dir > 0 ? '▲' : '▼'}${kb ? ` [${kb}]` : ''}`}
        onClick={() => send({ type: 'rocker', id, dir }, 'ui')}
      >
        <svg viewBox="0 0 12 8" aria-hidden="true">
          <path d={dir > 0 ? 'M6 0.8 L11 7 L1 7 Z' : 'M6 7.2 L11 1 L1 1 Z'} />
        </svg>
        {flash && flash.key === `${id}${dir > 0 ? '+' : '-'}` && (
          <span key={flash.seq} className="osb-flash" aria-hidden="true" />
        )}
      </button>
    );
  };
  return (
    <div className="rocker" style={{ left: p.x - 15, top: p.y - 29 }} role="group" aria-label={`${id} rocker`}>
      {half(1)}
      <span className="rocker-label" aria-hidden="true">{id}</span>
      {half(-1)}
    </div>
  );
}

export function Bezel({ children }: { children: ReactNode }) {
  // fences between neighbouring buttons on each edge
  const fences: Array<{ x: number; y: number; vertical: boolean }> = [];
  const groups: OsbId[][] = [[1, 2, 3, 4, 5], [6, 7, 8, 9, 10], [11, 12, 13, 14, 15], [16, 17, 18, 19, 20]];
  for (const g of groups) {
    for (let i = 0; i < g.length - 1; i++) {
      const a = osbCenter(g[i]);
      const b = osbCenter(g[i + 1]);
      fences.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, vertical: a.y === b.y });
    }
  }
  return (
    <div className="bezel" style={{ width: BEZEL_SIZE, height: BEZEL_SIZE }}>
      <div className="bezel-lip" aria-hidden="true" />
      {[[12, 12], [BEZEL_SIZE - 12, 12], [12, BEZEL_SIZE - 12], [BEZEL_SIZE - 12, BEZEL_SIZE - 12]].map(([x, y]) => (
        <Screw key={`${x}-${y}`} x={x} y={y} />
      ))}
      {fences.map((f, i) => (
        <Fence key={i} {...f} />
      ))}
      <div className="glass-well" style={{ left: RING - 6, top: RING - 6, width: DISPLAY + 12, height: DISPLAY + 12 }} aria-hidden="true" />
      <div className="glass-slot" style={{ left: RING, top: RING, width: DISPLAY, height: DISPLAY }}>
        {children}
      </div>
      {/* tab order runs clockwise from OSB 1, with rockers in their corners */}
      <Rocker id="GAIN" />
      {OSB_IDS.slice(0, 5).map((id) => <Osb key={id} id={id} />)}
      <Rocker id="SYM" />
      {OSB_IDS.slice(5, 10).map((id) => <Osb key={id} id={id} />)}
      <Rocker id="CON" />
      {OSB_IDS.slice(10, 15).map((id) => <Osb key={id} id={id} />)}
      <Rocker id="BRT" />
      {OSB_IDS.slice(15, 20).map((id) => <Osb key={id} id={id} />)}
    </div>
  );
}

export { ROCKER_IDS };
