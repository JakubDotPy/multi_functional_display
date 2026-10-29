import { definePage, set, settings, sim } from '../core/dsl';
import type { AltUnit, PageViewProps, SpeedUnit } from '../core/types';
import { altLabel, altitude, hdg3, signed, speed, speedLabel, vsLabel, vspeed } from '../format';
import { AREA } from '../mfd/geometry';
import { telemetry } from '../sim/telemetry';

export interface FlightState {
  trend: boolean;
  /** altitude reference bug, stored in feet */
  altBug: number;
  vsScale: 2000 | 6000;
}

const TAPE_TOP = 112;
const TAPE_BOT = 340;
const TAPE_MID = (TAPE_TOP + TAPE_BOT) / 2;
const TAPE_H = TAPE_BOT - TAPE_TOP;

interface TapeSpec {
  x: number;
  w: number;
  value: number;
  span: number; // units visible above/below centre
  tick: number;
  label: number;
  align: 'left' | 'right';
  fmt: (v: number) => string;
  trend?: number | null;
  bug?: number | null;
  unit: string;
  title: string;
}

function Tape(t: TapeSpec) {
  const ppu = TAPE_H / 2 / t.span;
  const y = (v: number) => TAPE_MID - (v - t.value) * ppu;
  const first = Math.ceil((t.value - t.span) / t.tick) * t.tick;
  const ticks: number[] = [];
  for (let v = first; v <= t.value + t.span; v += t.tick) ticks.push(Math.round(v * 1000) / 1000);
  const edge = t.align === 'left' ? t.x + t.w : t.x; // scale edge facing the centre
  const dir = t.align === 'left' ? -1 : 1;
  const textX = t.align === 'left' ? edge - 13 : edge + 13;
  const anchor = t.align === 'left' ? 'end' : 'start';
  const clipId = `tape-${t.title}`;
  const bugY = t.bug != null ? Math.min(TAPE_BOT, Math.max(TAPE_TOP, y(t.bug))) : null;
  return (
    <g>
      <defs>
        <clipPath id={clipId}>
          <rect x={t.x - 4} y={TAPE_TOP} width={t.w + 8} height={TAPE_H} />
        </clipPath>
      </defs>
      <line x1={edge} y1={TAPE_TOP} x2={edge} y2={TAPE_BOT} className="s-sec" />
      <g clipPath={`url(#${clipId})`}>
        {ticks.map((v) => {
          const major = Math.abs(v % t.label) < 1e-6;
          return (
            <g key={v}>
              <line x1={edge} x2={edge + dir * (major ? 9 : 5)} y1={y(v)} y2={y(v)} className={major ? 's-pri' : 's-sec'} />
              {major && Math.abs(y(v) - TAPE_MID) > 13 && (
                <text x={textX} y={y(v) + 3.5} textAnchor={anchor} fontSize={10} className="t-sec">
                  {t.fmt(v)}
                </text>
              )}
            </g>
          );
        })}
        {t.trend != null && Math.abs(t.trend) > t.tick * 0.2 && (
          <g className="trend">
            <line x1={edge - dir * 3} x2={edge - dir * 3} y1={TAPE_MID} y2={y(t.value + t.trend)} />
            <path
              d={`M${edge - dir * 3},${y(t.value + t.trend)} l-3,${t.trend > 0 ? 5 : -5} h6 z`}
              className="f-pri"
            />
          </g>
        )}
      </g>
      {bugY != null && (
        <path
          className="bug"
          d={`M${edge},${bugY} l${-dir * 7},-6 v12 z`}
        />
      )}
      {/* pointer box */}
      <g>
        <path
          className="readout-box"
          d={
            t.align === 'left'
              ? `M${t.x - 2},${TAPE_MID - 9} h${t.w - 4} l6,9 l-6,9 h${-(t.w - 4)} z`
              : `M${t.x + t.w + 2},${TAPE_MID - 9} h${-(t.w - 4)} l-6,9 l6,9 h${t.w - 4} z`
          }
        />
        <text
          x={t.align === 'left' ? t.x + t.w - 6 : t.x + 4}
          y={TAPE_MID + 4.5}
          textAnchor={t.align === 'left' ? 'end' : 'start'}
          fontSize={13}
          className="t-hi"
        >
          {t.fmt(t.value)}
        </text>
      </g>
      <text x={t.align === 'left' ? t.x : t.x + t.w} y={TAPE_TOP - 6} textAnchor={t.align === 'left' ? 'start' : 'end'} fontSize={9} className="t-dim">
        {t.title} {t.unit}
      </text>
    </g>
  );
}

const thousands = (v: number) => {
  const r = Math.round(v);
  const s = String(Math.abs(r)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return r < 0 ? `-${s}` : s;
};

function speedSpec(u: SpeedUnit) {
  return u === 'KT' ? { span: 50, tick: 5, label: 20 } : { span: 100, tick: 10, label: 40 };
}
function altSpec(u: AltUnit) {
  return u === 'FT' ? { span: 500, tick: 100, label: 200 } : { span: 150, tick: 25, label: 50 };
}

function HeadingTape({ hdg }: { hdg: number }) {
  const x0 = 120;
  const x1 = 320;
  const mid = (x0 + x1) / 2;
  const y0 = 76;
  const ppd = (x1 - x0) / 60;
  const ticks: number[] = [];
  for (let d = Math.ceil((hdg - 30) / 5) * 5; d <= hdg + 30; d += 5) ticks.push(d);
  return (
    <g>
      <defs>
        <clipPath id="hdg-clip">
          <rect x={x0} y={y0 - 20} width={x1 - x0} height={30} />
        </clipPath>
      </defs>
      <line x1={x0} x2={x1} y1={y0} y2={y0} className="s-sec" />
      <g clipPath="url(#hdg-clip)">
        {ticks.map((d) => {
          const x = mid + (d - hdg) * ppd;
          const major = d % 10 === 0;
          const n = ((d % 360) + 360) % 360;
          return (
            <g key={d}>
              <line x1={x} x2={x} y1={y0} y2={y0 - (major ? 7 : 4)} className={major ? 's-pri' : 's-sec'} />
              {major && (
                <text x={x} y={y0 - 10} textAnchor="middle" fontSize={9.5} className="t-sec">
                  {String(n === 0 ? 36 : n / 10).padStart(2, '0')}
                </text>
              )}
            </g>
          );
        })}
      </g>
      <path d={`M${mid},${y0 + 1} l-5,8 h10 z`} className="f-pri" />
      <rect x={mid - 20} y={y0 + 10} width={40} height={16} className="readout-box" />
      <text x={mid} y={y0 + 22} textAnchor="middle" fontSize={12} className="t-hi">
        {hdg3(hdg)}
      </text>
    </g>
  );
}

function VsScale({ vs, scale, unit }: { vs: number; scale: number; unit: AltUnit }) {
  const x = 262;
  const top = 134;
  const bot = 318;
  const mid = (top + bot) / 2;
  const half = (bot - top) / 2;
  const clamped = Math.max(-scale, Math.min(scale, vs));
  const py = mid - (clamped / scale) * half;
  const marks = [-1, -0.5, 0, 0.5, 1];
  return (
    <g>
      <line x1={x} x2={x} y1={top} y2={bot} className="s-sec" />
      {marks.map((m) => (
        <g key={m}>
          <line x1={x} x2={x + (m === 0 ? 10 : 6)} y1={mid - m * half} y2={mid - m * half} className="s-sec" />
          {m !== 0 && (
            <text x={x + 12} y={mid - m * half + 3.5} fontSize={9} className="t-dim">
              {Math.abs(m * scale) / 1000}K
            </text>
          )}
        </g>
      ))}
      <line x1={x - 2} x2={x - 2} y1={mid} y2={py} className="s-pri vs-bar" />
      <path d={`M${x - 3},${py} l-8,-5 v10 z`} className="f-pri" />
      <text x={x} y={top - 8} textAnchor="middle" fontSize={9} className="t-dim">
        VS
      </text>
      <text x={x} y={bot + 15} textAnchor="middle" fontSize={10} className="t-pri">
        {signed(vspeed(vs, unit), unit === 'FT' ? 0 : 1)}
      </text>
    </g>
  );
}

function AltHistory({ t, unit }: { t: number; unit: AltUnit }) {
  const x0 = 140;
  const x1 = 236;
  const y0 = 260;
  const y1 = 318;
  const n = 30;
  const samples = Array.from({ length: n + 1 }, (_, i) => {
    const ts = t - 60 + (i * 60) / n;
    return altitude(telemetry(ts).alt, unit);
  });
  const lo = Math.min(...samples);
  const hi = Math.max(...samples);
  const span = Math.max(hi - lo, unit === 'FT' ? 100 : 30);
  const pts = samples
    .map((v, i) => `${(x0 + (i / n) * (x1 - x0)).toFixed(1)},${(y1 - ((v - lo) / span) * (y1 - y0)).toFixed(1)}`)
    .join(' ');
  return (
    <g>
      <rect x={x0 - 4} y={y0 - 16} width={x1 - x0 + 8} height={y1 - y0 + 22} className="frame" />
      <text x={x0} y={y0 - 5} fontSize={9} className="t-dim">ALT 60 S</text>
      <polyline points={pts} className="spark" />
    </g>
  );
}

function FlightView({ state: s, app }: PageViewProps<FlightState>) {
  const tel = telemetry(app.sim.time);
  const { speedUnit: su, altUnit: au } = app.settings;
  const sp = speedSpec(su);
  const al = altSpec(au);
  const bugDelta = altitude(s.altBug - tel.alt, au);
  const rows: Array<[string, string, string]> = [
    ['GS', String(Math.round(speed(tel.gs, su))), speedLabel(su)],
    ['VS', signed(vspeed(tel.vs, au), au === 'FT' ? 0 : 1), vsLabel(au)],
    ['BUG', thousands(altitude(s.altBug, au)), altLabel(au)],
    ['ΔBUG', signed(bugDelta, 0), altLabel(au)],
  ];
  return (
    <g className="flt">
      <HeadingTape hdg={tel.hdg} />
      <Tape
        title="IAS" unit={speedLabel(su)} x={72} w={52} align="left"
        value={speed(tel.ias, su)} span={sp.span} tick={sp.tick} label={sp.label}
        fmt={(v) => String(Math.round(v))}
        trend={s.trend ? speed(tel.iasTrend, su) : null}
      />
      <Tape
        title="ALT" unit={altLabel(au)} x={308} w={66} align="right"
        value={altitude(tel.alt, au)} span={al.span} tick={al.tick} label={al.label}
        fmt={thousands}
        trend={s.trend ? altitude(tel.altTrend, au) : null}
        bug={altitude(s.altBug, au)}
      />
      <VsScale vs={tel.vs} scale={s.vsScale} unit={au} />
      <g fontSize={10.5}>
        {rows.map(([k, v, u], i) => (
          <g key={k}>
            <text x={142} y={146 + i * 20} className="t-dim">{k}</text>
            <text x={214} y={146 + i * 20} textAnchor="end" className="t-pri">{v}</text>
            <text x={218} y={146 + i * 20} fontSize={8.5} className="t-dim">{u}</text>
          </g>
        ))}
      </g>
      <AltHistory t={app.sim.time} unit={au} />
      {!app.sim.running && (
        <g>
          <rect x={AREA.x + AREA.w / 2 - 34} y={354} width={68} height={18} className="readout-box" />
          <text x={AREA.x + AREA.w / 2} y={367} textAnchor="middle" fontSize={11} className="t-hi blink">HOLD</text>
        </g>
      )}
    </g>
  );
}

export const flightPage = definePage<FlightState>({
  id: 'FLT',
  label: 'FLT',
  title: 'FLIGHT DATA',
  description: 'Airspeed, altitude and heading tapes with trend vectors, vertical-speed scale and a 60 s altitude trace.',
  initialState: { trend: true, altBug: 18500, vsScale: 2000 },
  View: FlightView,
  keys: ({ state: s, app }) => ({
    1: {
      label: app.sim.running ? 'RUN' : 'HOLD',
      active: app.sim.running,
      hint: app.sim.running ? 'Pause simulation' : 'Start simulation',
      press: () => sim('toggle'),
    },
    2: { label: 'TRND', active: s.trend, hint: 'Show / hide 6 s trend vectors', press: () => set<FlightState>({ trend: !s.trend }) },
    3: {
      label: s.vsScale === 2000 ? 'VS 2K' : 'VS 6K',
      hint: 'Toggle vertical-speed scale',
      press: () => set<FlightState>({ vsScale: s.vsScale === 2000 ? 6000 : 2000 }),
    },
    5: { label: 'RST', disabled: app.sim.time === 0, hint: 'Reset simulation clock to T+0', press: () => sim('reset') },
    6: {
      label: 'BUG\n▲',
      disabled: s.altBug >= 50000,
      hint: 'Raise altitude bug 500 ft',
      press: () => set<FlightState>({ altBug: Math.min(50000, s.altBug + 500) }),
    },
    7: {
      label: 'SYNC',
      hint: 'Sync altitude bug to current altitude',
      press: () => set<FlightState>({ altBug: Math.round(telemetry(app.sim.time).alt / 100) * 100 }),
    },
    8: {
      label: 'BUG\n▼',
      disabled: s.altBug <= 0,
      hint: 'Lower altitude bug 500 ft',
      press: () => set<FlightState>({ altBug: Math.max(0, s.altBug - 500) }),
    },
    20: {
      label: app.settings.speedUnit === 'KT' ? 'KT' : 'KMH',
      hint: 'Toggle speed unit',
      press: () => settings({ speedUnit: app.settings.speedUnit === 'KT' ? 'KMH' : 'KT' }),
    },
    19: {
      label: app.settings.altUnit,
      hint: 'Toggle altitude unit',
      press: () => settings({ altUnit: app.settings.altUnit === 'FT' ? 'M' : 'FT' }),
    },
  }),
  prompt: ({ app }) => (app.sim.running ? 'SIM RUNNING · OSB 1 HOLDS' : 'SIM HOLD · OSB 1 RUNS'),
});
