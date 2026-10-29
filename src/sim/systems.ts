export type SubState = 'NORMAL' | 'STANDBY' | 'INACTIVE';
export type SysGroup = 'ELEC' | 'ENV' | 'GEN';

/** Fictional subsystem catalogue. Names, values and relationships are invented. */
export interface SubsystemDef {
  id: string;
  group: SysGroup;
  name: string;
  defaultState: SubState;
  /** schematic node position inside a 320 × 92 box */
  node: { x: number; y: number };
  metrics: (t: number, s: SubState) => Array<{ k: string; v: string; u: string }>;
}

const f = (n: number, d = 1) => n.toFixed(d);
const live = (s: SubState, active: number, standby: number) =>
  s === 'NORMAL' ? active : s === 'STANDBY' ? standby : 0;

export const SUBSYSTEMS: SubsystemDef[] = [
  // ELEC
  {
    id: 'GEN1', group: 'ELEC', name: 'GEN 1', defaultState: 'NORMAL', node: { x: 30, y: 16 },
    metrics: (t, s) => [
      { k: 'VOLT', v: f(live(s, 115 + 0.4 * Math.sin(t / 5), 0)), u: 'V' },
      { k: 'FREQ', v: f(live(s, 400 + 0.6 * Math.sin(t / 3), 0), 0), u: 'HZ' },
      { k: 'LOAD', v: f(live(s, 46 + 6 * Math.sin(t / 13), 0), 0), u: '%' },
    ],
  },
  {
    id: 'GEN2', group: 'ELEC', name: 'GEN 2', defaultState: 'NORMAL', node: { x: 30, y: 72 },
    metrics: (t, s) => [
      { k: 'VOLT', v: f(live(s, 114.8 + 0.4 * Math.sin(t / 4.4), 0)), u: 'V' },
      { k: 'FREQ', v: f(live(s, 400 + 0.5 * Math.sin(t / 3.7), 0), 0), u: 'HZ' },
      { k: 'LOAD', v: f(live(s, 41 + 5 * Math.sin(t / 11), 0), 0), u: '%' },
    ],
  },
  {
    id: 'BATT', group: 'ELEC', name: 'BATTERY', defaultState: 'STANDBY', node: { x: 160, y: 44 },
    metrics: (t, s) => [
      { k: 'VOLT', v: f(live(s, 27.6, 28.1 - 0.05 * Math.sin(t / 40))), u: 'V' },
      { k: 'CHRG', v: f(live(s, 92, 100), 0), u: '%' },
      { k: 'TEMP', v: f(s === 'INACTIVE' ? 0 : 21 + Math.sin(t / 60)), u: 'C' },
    ],
  },
  {
    id: 'BUSA', group: 'ELEC', name: 'BUS A', defaultState: 'NORMAL', node: { x: 290, y: 16 },
    metrics: (t, s) => [
      { k: 'VOLT', v: f(live(s, 28 + 0.1 * Math.sin(t / 6), 0)), u: 'V' },
      { k: 'AMPS', v: f(live(s, 88 + 9 * Math.sin(t / 8), 0), 0), u: 'A' },
    ],
  },
  {
    id: 'BUSB', group: 'ELEC', name: 'BUS B', defaultState: 'NORMAL', node: { x: 290, y: 72 },
    metrics: (t, s) => [
      { k: 'VOLT', v: f(live(s, 27.9 + 0.1 * Math.sin(t / 7), 0)), u: 'V' },
      { k: 'AMPS', v: f(live(s, 74 + 7 * Math.sin(t / 9), 0), 0), u: 'A' },
    ],
  },
  // ENV
  {
    id: 'ECS', group: 'ENV', name: 'ECS PACK', defaultState: 'NORMAL', node: { x: 40, y: 44 },
    metrics: (t, s) => [
      { k: 'FLOW', v: f(live(s, 62 + 3 * Math.sin(t / 10), 20), 0), u: 'PPM' },
      { k: 'TEMP', v: f(live(s, 12 + Math.sin(t / 15), 18)), u: 'C' },
    ],
  },
  {
    id: 'CABIN', group: 'ENV', name: 'CABIN PRES', defaultState: 'NORMAL', node: { x: 180, y: 16 },
    metrics: (t, s) => [
      { k: 'ALT', v: f(live(s, 8000 + 40 * Math.sin(t / 30), 12000), 0), u: 'FT' },
      { k: 'DIFF', v: f(live(s, 5.0 + 0.05 * Math.sin(t / 9), 2.1)), u: 'PSI' },
    ],
  },
  {
    id: 'COOL', group: 'ENV', name: 'AVNX COOL', defaultState: 'NORMAL', node: { x: 180, y: 72 },
    metrics: (t, s) => [
      { k: 'TEMP', v: f(live(s, 24 + 2 * Math.sin(t / 20), 31)), u: 'C' },
      { k: 'FAN', v: f(live(s, 78, 40), 0), u: '%' },
    ],
  },
  {
    id: 'O2', group: 'ENV', name: 'O2 SUPPLY', defaultState: 'STANDBY', node: { x: 290, y: 16 },
    metrics: (t, s) => [
      { k: 'PRES', v: f(live(s, 72, 80 - 0.01 * t), 0), u: 'PSI' },
      { k: 'CONC', v: f(live(s, 94, 0), 0), u: '%' },
    ],
  },
  // GEN
  {
    id: 'HYDA', group: 'GEN', name: 'HYD A', defaultState: 'NORMAL', node: { x: 30, y: 16 },
    metrics: (t, s) => [
      { k: 'PRES', v: f(live(s, 3000 + 25 * Math.sin(t / 4), 0), 0), u: 'PSI' },
      { k: 'QTY', v: f(live(s, 88, 0), 0), u: '%' },
    ],
  },
  {
    id: 'HYDB', group: 'GEN', name: 'HYD B', defaultState: 'NORMAL', node: { x: 30, y: 72 },
    metrics: (t, s) => [
      { k: 'PRES', v: f(live(s, 2990 + 25 * Math.sin(t / 4.6), 0), 0), u: 'PSI' },
      { k: 'QTY', v: f(live(s, 86, 0), 0), u: '%' },
    ],
  },
  {
    id: 'FUEL', group: 'GEN', name: 'FUEL XFER', defaultState: 'NORMAL', node: { x: 160, y: 44 },
    metrics: (t, s) => [
      { k: 'FLOW', v: f(live(s, 5400 + 120 * Math.sin(t / 12), 0), 0), u: 'PPH' },
      { k: 'BAL', v: f(live(s, 2 * Math.sin(t / 25), 0)), u: '%' },
    ],
  },
  {
    id: 'NAVC', group: 'GEN', name: 'NAV CMPTR', defaultState: 'NORMAL', node: { x: 290, y: 16 },
    metrics: (t, s) => [
      { k: 'CPU', v: f(live(s, 34 + 8 * Math.sin(t / 6), 5), 0), u: '%' },
      { k: 'ALIGN', v: s === 'INACTIVE' ? '---' : s === 'STANDBY' ? 'HOLD' : 'FULL', u: '' },
    ],
  },
  {
    id: 'LINK', group: 'GEN', name: 'DATA LINK', defaultState: 'INACTIVE', node: { x: 290, y: 72 },
    metrics: (t, s) => [
      { k: 'SNR', v: f(live(s, 18 + 2 * Math.sin(t / 5), 0)), u: 'DB' },
      { k: 'MSGS', v: f(live(s, Math.floor(t / 4) % 1000, 0), 0), u: '' },
    ],
  },
];

/** schematic connections, by subsystem id */
export const LINKS: Record<SysGroup, Array<[string, string]>> = {
  ELEC: [['GEN1', 'BUSA'], ['GEN2', 'BUSB'], ['BATT', 'BUSA'], ['BATT', 'BUSB']],
  ENV: [['ECS', 'CABIN'], ['ECS', 'COOL'], ['O2', 'CABIN']],
  GEN: [['HYDA', 'FUEL'], ['HYDB', 'FUEL'], ['NAVC', 'LINK'], ['FUEL', 'NAVC']],
};

export const SYS_GROUPS: SysGroup[] = ['ELEC', 'ENV', 'GEN'];

export function subsystemsIn(group: SysGroup): SubsystemDef[] {
  return SUBSYSTEMS.filter((s) => s.group === group);
}

export function defaultSubStates(): Record<string, SubState> {
  return Object.fromEntries(SUBSYSTEMS.map((s) => [s.id, s.defaultState]));
}

const CYCLE: SubState[] = ['NORMAL', 'STANDBY', 'INACTIVE'];
export function nextSubState(s: SubState): SubState {
  return CYCLE[(CYCLE.indexOf(s) + 1) % CYCLE.length];
}
