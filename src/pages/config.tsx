import { definePage, resetDefaults, set, settings, sim, step } from '../core/dsl';
import type { AppContext, EffectResult, LevelSetting, PageViewProps } from '../core/types';
import { AREA } from '../mfd/geometry';

export interface ConfigState {
  selected: number;
  confirmReset: boolean;
}

type RowKind = { kind: 'level'; key: LevelSetting } | { kind: 'toggle' } | { kind: 'action' };

interface Row {
  label: string;
  type: RowKind;
  value: (app: AppContext) => string;
  /** effect for INC (+1) / DEC (−1) / TGL (+1) */
  adjust?: (app: AppContext, dir: 1 | -1) => EffectResult;
}

const level = (key: LevelSetting, label: string): Row => ({
  label,
  type: { kind: 'level', key },
  value: (app) => String(app.settings[key]),
  adjust: (_app, dir) => step(key, dir),
});

export const CONFIG_ROWS: Row[] = [
  level('brightness', 'BRIGHTNESS'),
  level('contrast', 'CONTRAST'),
  level('symbology', 'SYMBOLOGY'),
  level('gain', 'MAP GAIN'),
  {
    label: 'PHOSPHOR GLOW',
    type: { kind: 'toggle' },
    value: (a) => (a.settings.glow ? 'ON' : 'OFF'),
    adjust: (a) => settings({ glow: !a.settings.glow }),
  },
  {
    label: 'SPEED UNIT',
    type: { kind: 'toggle' },
    value: (a) => (a.settings.speedUnit === 'KT' ? 'KT' : 'KM/H'),
    adjust: (a) => settings({ speedUnit: a.settings.speedUnit === 'KT' ? 'KMH' : 'KT' }),
  },
  {
    label: 'ALT UNIT',
    type: { kind: 'toggle' },
    value: (a) => a.settings.altUnit,
    adjust: (a) => settings({ altUnit: a.settings.altUnit === 'FT' ? 'M' : 'FT' }),
  },
  {
    label: 'SIMULATION',
    type: { kind: 'toggle' },
    value: (a) => (a.sim.running ? 'RUN' : 'HOLD'),
    adjust: () => sim('toggle'),
  },
  { label: 'RESTORE DEFAULTS', type: { kind: 'action' }, value: () => '' },
];

const ROW_Y = AREA.y + 18;
const ROW_H = 22;

function Bar({ x, y, v }: { x: number; y: number; v: number }) {
  return (
    <g>
      {Array.from({ length: 10 }, (_, i) => (
        <rect key={i} x={x + i * 9} y={y - 8} width={7} height={8} className={i < v / 10 ? 'f-pri' : 'seg-off'} />
      ))}
    </g>
  );
}

function ConfigView({ state: s, app }: PageViewProps<ConfigState>) {
  const steps = [0.12, 0.2, 0.3, 0.42, 0.55, 0.68, 0.8, 0.9, 1];
  return (
    <g className="cfg" fontSize={10.5}>
      {CONFIG_ROWS.map((r, i) => {
        const y = ROW_Y + i * ROW_H;
        const sel = i === s.selected;
        const isReset = r.type.kind === 'action';
        return (
          <g key={r.label}>
            {sel && <rect x={AREA.x - 2} y={y - 13} width={AREA.w + 4} height={ROW_H - 3} className="frame-hi" />}
            <text x={AREA.x + 6} y={y} className={isReset && s.confirmReset ? 't-pri blink' : sel ? 't-hi' : 't-pri'}>
              {sel ? '▸ ' : '  '}
              {isReset && s.confirmReset ? 'CONFIRM RESET?' : r.label}
            </text>
            {r.type.kind === 'level' && <Bar x={AREA.x + 196} y={y} v={app.settings[r.type.key]} />}
            <text x={AREA.x + AREA.w - 6} y={y} textAnchor="end" className={sel ? 't-hi' : 't-sec'}>
              {r.value(app)}
            </text>
          </g>
        );
      })}

      {/* test pattern: phosphor ramp + resolution wedge, handy when bench-testing real panels */}
      <g>
        <text x={AREA.x} y={290} fontSize={9} className="t-dim">TEST PATTERN</text>
        {steps.map((o, i) => (
          <rect key={i} x={AREA.x + i * 24} y={296} width={22} height={22} className="f-pri" opacity={o} />
        ))}
        <g transform={`translate(${AREA.x + 236} 296)`}>
          {[1, 2, 3, 4].map((w, i) => (
            <g key={w}>
              {Array.from({ length: 4 }, (_, j) => (
                <rect key={j} x={i * 21 + j * w * 2} y={0} width={w} height={22} className="f-pri" />
              ))}
            </g>
          ))}
        </g>
        <rect x={AREA.x} y={326} width={AREA.w} height={46} className="frame" />
        <line x1={AREA.x} y1={326} x2={AREA.x + AREA.w} y2={372} className="s-dim" />
        <line x1={AREA.x} y1={372} x2={AREA.x + AREA.w} y2={326} className="s-dim" />
        <circle cx={AREA.x + AREA.w / 2} cy={349} r={18} className="s-sec" fill="none" />
      </g>
    </g>
  );
}

export const configPage = definePage<ConfigState>({
  id: 'CNFG',
  label: 'CNFG',
  title: 'DISPLAY CONFIGURATION',
  description: 'Brightness, contrast, symbology, map gain, glow, units and simulation control. Changes apply immediately.',
  initialState: { selected: 0, confirmReset: false },
  View: ConfigView,
  keys: ({ state: s, app }) => {
    const row = CONFIG_ROWS[s.selected];
    const n = CONFIG_ROWS.length;
    const lvl = row.type.kind === 'level' ? app.settings[row.type.key] : null;
    const adjust = (dir: 1 | -1) => () => row.adjust?.(app, dir);
    return {
      1: {
        label: app.sim.running ? 'RUN' : 'HOLD',
        active: app.sim.running,
        hint: 'Start / pause simulation',
        press: () => sim('toggle'),
      },
      20: { label: 'SEL\n▲', hint: 'Previous setting', press: () => set<ConfigState>({ selected: (s.selected - 1 + n) % n, confirmReset: false }) },
      19: { label: 'SEL\n▼', hint: 'Next setting', press: () => set<ConfigState>({ selected: (s.selected + 1) % n, confirmReset: false }) },
      6:
        lvl !== null
          ? { label: 'INC', hint: `Increase ${row.label.toLowerCase()}`, disabled: lvl >= 100, press: adjust(1) }
          : { label: 'TGL', hint: `Toggle ${row.label.toLowerCase()}`, disabled: row.type.kind === 'action', press: adjust(1) },
      7: { label: 'DEC', hint: `Decrease ${row.label.toLowerCase()}`, disabled: lvl === null || lvl <= 10, press: adjust(-1) },
      10: {
        label: s.confirmReset ? 'CONF' : 'DFLT',
        active: s.confirmReset,
        hint: s.confirmReset ? 'Press again to restore defaults' : 'Restore defaults (press twice)',
        press: () => (s.confirmReset ? resetDefaults() : set<ConfigState>({ confirmReset: true, selected: n - 1 })),
      },
    };
  },
  onExit: () => set<ConfigState>({ confirmReset: false }),
  onCancel: ({ state }) => (state.confirmReset ? set<ConfigState>({ confirmReset: false }) : null),
  prompt: ({ state: s }) =>
    s.confirmReset ? 'PRESS CONF TO RESTORE · ESC CANCELS' : `${CONFIG_ROWS[s.selected].label} SELECTED`,
});
