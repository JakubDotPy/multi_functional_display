import { definePage, set } from '../core/dsl';
import type { PageViewProps } from '../core/types';
import { hdg3, mmss } from '../format';
import { AREA, AREA_CX, AREA_CY } from '../mfd/geometry';
import { ROUTE, TERRAIN } from '../sim/route';
import { steerInfo, telemetry } from '../sim/telemetry';
import type { Telemetry } from '../sim/telemetry';

export const RANGES_NM = [5, 10, 20, 40, 80, 160];
const DEFAULT_RANGE = 3;

export interface NavState {
  rangeIdx: number;
  orientation: 'HDG' | 'NORTH';
  centered: boolean;
  expanded: boolean;
  showRoute: boolean;
  showRings: boolean;
  declutter: boolean;
  autoSeq: boolean;
  steerpoint: number;
}

const initialState: NavState = {
  rangeIdx: DEFAULT_RANGE,
  orientation: 'HDG',
  centered: false,
  expanded: false,
  showRoute: true,
  showRings: true,
  declutter: false,
  autoSeq: true,
  steerpoint: 1,
};

export const activeSteer = (s: NavState, tel: Telemetry) => (s.autoSeq ? tel.nextWp : s.steerpoint);
export const effectiveRange = (s: NavState) => RANGES_NM[s.rangeIdx] / (s.expanded ? 2 : 1);

/** Map geometry for a given state + telemetry, shared by the view and tests. */
export function mapFrame(s: NavState, tel: Telemetry) {
  const cx = AREA_CX;
  const cy = s.centered ? AREA_CY + 6 : AREA.y + AREA.h * 0.72;
  const rPx = s.centered ? 140 : 196;
  const k = rPx / effectiveRange(s);
  const rot = s.orientation === 'HDG' ? tel.hdg : 0;
  const rad = (rot * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const project = (wx: number, wy: number) => {
    const dx = wx - tel.x;
    const dy = wy - tel.y;
    const sx = dx * cos - dy * sin;
    const up = dx * sin + dy * cos;
    return { x: cx + sx * k, y: cy - up * k };
  };
  return { cx, cy, rPx, k, rot, project };
}

const COMPASS = ['N', '3', '6', 'E', '12', '15', 'S', '21', '24', 'W', '30', '33'];

function NavView({ state: s, app }: PageViewProps<NavState>) {
  const tel = telemetry(app.sim.time);
  const f = mapFrame(s, tel);
  const sp = activeSteer(s, tel);
  const info = steerInfo(tel, sp);
  const range = effectiveRange(s);
  const wps = ROUTE.map((w, i) => ({ ...w, i, p: f.project(w.x, w.y) }));
  const sel = wps[sp];

  return (
    <g className="nav">
      <defs>
        <clipPath id="map-clip">
          <rect x={AREA.x + 8} y={AREA.y + 10} width={AREA.w - 16} height={AREA.h - 14} />
        </clipPath>
      </defs>

      <g clipPath="url(#map-clip)">
        {/* background layer — controlled by GAIN */}
        <g className="terrain">
          {TERRAIN.map((poly, i) => (
            <polyline
              key={i}
              points={poly.map(([x, y]) => { const p = f.project(x, y); return `${p.x.toFixed(1)},${p.y.toFixed(1)}`; }).join(' ')}
            />
          ))}
        </g>

        {/* compass rose */}
        <g className="rose">
          <circle cx={f.cx} cy={f.cy} r={f.rPx} className="s-sec" fill="none" />
          {Array.from({ length: 36 }, (_, i) => {
            const b = i * 10;
            const a = ((b - f.rot) * Math.PI) / 180;
            const long = b % 30 === 0;
            const r1 = f.rPx;
            const r2 = f.rPx - (long ? 9 : 5);
            return (
              <line
                key={b}
                x1={f.cx + r1 * Math.sin(a)} y1={f.cy - r1 * Math.cos(a)}
                x2={f.cx + r2 * Math.sin(a)} y2={f.cy - r2 * Math.cos(a)}
                className="s-sec"
              />
            );
          })}
          {COMPASS.map((lbl, i) => {
            const a = ((i * 30 - f.rot) * Math.PI) / 180;
            const r = f.rPx - 19;
            return (
              <text key={lbl} x={f.cx + r * Math.sin(a)} y={f.cy - r * Math.cos(a) + 3.5} textAnchor="middle" fontSize={10} className="t-sec">
                {lbl}
              </text>
            );
          })}
          {s.showRings && (
            <>
              <circle cx={f.cx} cy={f.cy} r={f.rPx / 2} className="s-dim dash" fill="none" />
              <text x={f.cx + (f.rPx / 2) * 0.72 + 3} y={f.cy - (f.rPx / 2) * 0.72 - 3} fontSize={9} className="t-dim">
                {range / 2}
              </text>
            </>
          )}
        </g>

        {/* route */}
        {s.showRoute && (
          <polygon className="route" points={wps.map((w) => `${w.p.x.toFixed(1)},${w.p.y.toFixed(1)}`).join(' ')} />
        )}
        <line x1={f.cx} y1={f.cy} x2={sel.p.x} y2={sel.p.y} className="s-pri steer-line" />

        {/* waypoints */}
        {wps.map((w) => {
          const isSel = w.i === sp;
          return (
            <g key={w.id}>
              <circle cx={w.p.x} cy={w.p.y} r={isSel ? 5 : 3.6} className={isSel ? 'wp wp-sel' : 'wp'} />
              {(!s.declutter || isSel) && (
                <text x={w.p.x + 8} y={w.p.y - 6} fontSize={9} className={isSel ? 't-pri' : 't-sec'}>
                  {w.id} {s.declutter ? '' : w.name}
                </text>
              )}
            </g>
          );
        })}
      </g>

      {/* ownship */}
      <g transform={`translate(${f.cx} ${f.cy}) rotate(${s.orientation === 'HDG' ? 0 : tel.hdg})`}>
        <path className="ownship" d="M0,-11 L1.8,-4 L9.5,2 L9.5,4.2 L1.8,2.2 L1.2,7 L4.2,9.2 L4.2,10.6 L0,9.6 L-4.2,10.6 L-4.2,9.2 L-1.2,7 L-1.8,2.2 L-9.5,4.2 L-9.5,2 L-1.8,-4 Z" />
      </g>

      {/* heading box & lubber line */}
      <g>
        <rect x={AREA_CX - 22} y={AREA.y - 2} width={44} height={16} className="readout-box" />
        <text x={AREA_CX} y={AREA.y + 10} textAnchor="middle" fontSize={12} className="t-hi">
          {hdg3(tel.hdg)}
        </text>
        {s.orientation === 'HDG' && <path d={`M${AREA_CX},${AREA.y + 17} l-4,6 h8 z`} className="f-pri" />}
      </g>

      {/* data corners */}
      <g fontSize={9.5}>
        <text x={AREA.x} y={AREA.y + 26} className="t-dim">GS</text>
        <text x={AREA.x + 44} y={AREA.y + 26} className="t-pri" textAnchor="end">{Math.round(tel.gs)}</text>
        <text x={AREA.x} y={AREA.y + 38} className="t-dim">TRK</text>
        <text x={AREA.x + 44} y={AREA.y + 38} className="t-pri" textAnchor="end">{hdg3(tel.hdg)}</text>

        <text x={AREA.x + AREA.w} y={AREA.y + 26} className="t-pri" textAnchor="end">STPT {sel.id} {sel.name}</text>
        <text x={AREA.x + AREA.w} y={AREA.y + 38} className="t-sec" textAnchor="end">
          {hdg3(info.bearing)}°/{info.range.toFixed(1)}
        </text>
        <text x={AREA.x + AREA.w} y={AREA.y + 50} className="t-sec" textAnchor="end">ETE {mmss(info.ete)}</text>

        <text x={AREA.x} y={AREA.y + AREA.h - 4} className="t-dim">{s.orientation === 'HDG' ? 'HDG UP' : 'NORTH UP'}</text>
        <text x={AREA.x + AREA.w} y={AREA.y + AREA.h - 4} className="t-dim" textAnchor="end">
          {range} NM{s.expanded ? ' EXP' : ''}
        </text>
      </g>
    </g>
  );
}

export const navPage = definePage<NavState>({
  id: 'NAV',
  label: 'NAV',
  title: 'HORIZONTAL SITUATION',
  description: 'Top-down map of the fictional training route with ownship, steerpoints, range rings and compass rose.',
  initialState,
  View: NavView,
  keys: ({ state: s, app }) => {
    const tel = telemetry(app.sim.time);
    const sp = activeSteer(s, tel);
    const n = ROUTE.length;
    return {
      1: {
        label: s.orientation === 'HDG' ? 'HDG UP' : 'NTH UP',
        hint: 'Toggle heading-up / north-up',
        press: () => set<NavState>({ orientation: s.orientation === 'HDG' ? 'NORTH' : 'HDG' }),
      },
      2: {
        label: s.centered ? 'CEN' : 'DEP',
        hint: 'Toggle centred / depressed ownship',
        press: () => set<NavState>({ centered: !s.centered }),
      },
      3: { label: 'EXP', active: s.expanded, hint: 'Zoom ×2 inside the current range', press: () => set<NavState>({ expanded: !s.expanded }) },
      4: { label: 'RTE', active: s.showRoute, hint: 'Show / hide route', press: () => set<NavState>({ showRoute: !s.showRoute }) },
      5: { label: 'RING', active: s.showRings, hint: 'Show / hide half-range ring', press: () => set<NavState>({ showRings: !s.showRings }) },
      6: {
        label: '▲',
        hint: 'Increase map range',
        disabled: s.rangeIdx >= RANGES_NM.length - 1,
        press: () => set<NavState>({ rangeIdx: s.rangeIdx + 1 }),
      },
      7: {
        label: String(RANGES_NM[s.rangeIdx]),
        hint: `Range ${RANGES_NM[s.rangeIdx]} NM · press for default`,
        press: () => set<NavState>({ rangeIdx: DEFAULT_RANGE }),
      },
      8: {
        label: '▼',
        hint: 'Decrease map range',
        disabled: s.rangeIdx <= 0,
        press: () => set<NavState>({ rangeIdx: s.rangeIdx - 1 }),
      },
      9: { label: 'DCLT', active: s.declutter, hint: 'Declutter waypoint names', press: () => set<NavState>({ declutter: !s.declutter }) },
      20: { label: 'STPT\n▲', hint: 'Next steerpoint (manual)', press: () => set<NavState>({ autoSeq: false, steerpoint: (sp + 1) % n }) },
      19: { label: 'STPT\n▼', hint: 'Previous steerpoint (manual)', press: () => set<NavState>({ autoSeq: false, steerpoint: (sp - 1 + n) % n }) },
      18: {
        label: s.autoSeq ? 'AUTO' : 'MAN',
        active: s.autoSeq,
        hint: 'Toggle automatic steerpoint sequencing',
        press: () => set<NavState>(s.autoSeq ? { autoSeq: false, steerpoint: sp } : { autoSeq: true }),
      },
    };
  },
  prompt: ({ state: s }) => `RNG ${effectiveRange(s)} NM · ${s.autoSeq ? 'AUTO SEQ' : 'MAN SEQ'}`,
});
