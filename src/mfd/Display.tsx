import { useMfd } from '../core/store';
import { OSB_IDS } from '../core/types';
import type { KeyDef, OsbId } from '../core/types';
import { clock } from '../format';
import { DISPLAY, charW, legendAnchor } from './geometry';

const FS = 11; // legend font size
const LINE = 12;

function Legend({ id, k, flashSeq }: { id: OsbId; k: KeyDef; flashSeq: number | null }) {
  const a = legendAnchor(id);
  const lines = k.label.split('\n');
  const wide = Math.max(...lines.map((l) => l.length)) * charW(FS);
  const h = lines.length * LINE;
  const anchor = a.side === 'left' ? 'start' : a.side === 'right' ? 'end' : 'middle';
  // first baseline
  let y0: number;
  if (a.side === 'top') y0 = a.y;
  else if (a.side === 'bottom') y0 = a.y - (lines.length - 1) * LINE;
  else y0 = a.y - h / 2 + LINE - 2.5;
  const boxX = anchor === 'start' ? a.x - 2 : anchor === 'end' ? a.x - wide - 2 : a.x - wide / 2 - 2;
  const boxY = y0 - LINE + 2.5;
  const cls = k.disabled ? 't-dim' : k.active ? 't-inv' : 't-pri';
  return (
    <g className="legend" data-osb={id}>
      {k.active && !k.disabled && <rect className="inv-box" x={boxX} y={boxY} width={wide + 4} height={h + 1} />}
      {flashSeq !== null && (
        <rect key={flashSeq} className="press-flash" x={boxX - 2} y={boxY - 2} width={wide + 8} height={h + 5} />
      )}
      <text className={`legend-text ${cls}`} x={a.x} y={y0} textAnchor={anchor} fontSize={FS}>
        {lines.map((l, i) => (
          <tspan key={i} x={a.x} dy={i === 0 ? 0 : LINE}>
            {l}
          </tspan>
        ))}
      </text>
    </g>
  );
}

export function Display({ title }: { title?: string }) {
  const { engine, state } = useMfd();
  const keys = engine.resolveKeys(state);
  const page = engine.page(state.page);
  const app = engine.context(state);
  const s = state.settings;
  const View = page.View;
  const prompt = engine.prompt(state);
  const flashId = state.lastPress?.key.startsWith('OSB') ? Number(state.lastPress.key.slice(3)) : null;
  const t = state.transition;

  const filter = [
    `brightness(${(0.25 + (0.75 * s.brightness) / 100).toFixed(3)})`,
    `contrast(${(0.55 + (0.9 * s.contrast) / 100).toFixed(3)})`,
    s.glow ? 'drop-shadow(0 0 1.6px rgba(85,255,119,0.55))' : '',
  ].join(' ');

  return (
    <svg
      className="display-svg"
      viewBox={`0 0 ${DISPLAY} ${DISPLAY}`}
      style={{ filter, ['--gain' as string]: (0.15 + (0.85 * s.gain) / 100).toFixed(3) }}
      role="img"
      aria-label={title ?? `${page.title} page`}
      data-page={state.page}
    >
      <defs>
        <pattern id="scan" width="3" height="3" patternUnits="userSpaceOnUse">
          <rect width="3" height="1" fill="#000" opacity="0.18" />
        </pattern>
      </defs>
      <rect className="glass" x={0} y={0} width={DISPLAY} height={DISPLAY} rx={14} />

      <g key={state.page} className={t && t.kind === 'wipe' ? 'page-wipe' : undefined}>
        {/* page symbology */}
        <g className="symb" opacity={(0.3 + (0.7 * s.symbology) / 100).toFixed(3)}>
          <View state={state.pages[state.page] as never} app={app} />
        </g>

        {/* status strip */}
        <g className="strip" fontSize={9.5}>
          <text x={62} y={40} className="t-sec">{engine.config.ident}</text>
          <text x={128} y={40} className="t-pri">{page.label}</text>
          <text x={DISPLAY / 2 + 14} y={40} className="t-sec" textAnchor="middle">
            {clock(state.sim.time)}L
          </text>
          <text x={DISPLAY - 62} y={40} textAnchor="end" className={state.sim.running ? 't-sec' : 't-pri blink'}>
            {state.sim.running ? 'SIM RUN' : 'SIM HOLD'}
          </text>
        </g>

        {/* contextual prompt */}
        {prompt && (
          <text x={DISPLAY / 2} y={402} textAnchor="middle" fontSize={9.5} className="t-sec prompt">
            {prompt}
          </text>
        )}
      </g>

      {/* soft-key legends */}
      {OSB_IDS.map((id) => {
        const k = keys[id];
        return k ? <Legend key={id} id={id} k={k} flashSeq={flashId === id ? state.lastPress!.seq : null} /> : null;
      })}

      <rect className="scanlines" x={0} y={0} width={DISPLAY} height={DISPLAY} rx={14} fill="url(#scan)" pointerEvents="none" />
      {t && t.kind === 'blank' && <rect key={t.seq} className="blank-frame" width={DISPLAY} height={DISPLAY} rx={14} />}
    </svg>
  );
}
