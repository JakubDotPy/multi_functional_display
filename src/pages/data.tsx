import { definePage, set } from '../core/dsl';
import type { AppContext, KeyMap, PageViewProps } from '../core/types';
import { altitude, hdg3, mmss, signed, speed, vspeed } from '../format';
import { AREA } from '../mfd/geometry';
import { ROUTE } from '../sim/route';
import { steerInfo, telemetry, telemetryHistory } from '../sim/telemetry';

export type DataTab = 'TLM' | 'NAV' | 'LOG';

export interface LogEntry {
  n: number;
  t: number;
  ias: number;
  alt: number;
  hdg: number;
  vs: number;
}

export interface DataState {
  tab: DataTab;
  selected: number;
  log: LogEntry[];
}

export const VISIBLE_ROWS = 15;
const MAX_LOG = 50;
const ROW_H = 17;
const HEAD_Y = AREA.y + 14;
const FIRST_Y = HEAD_Y + 20;

interface Column {
  head: string;
  x: number;
  anchor: 'start' | 'end';
}

interface Table {
  cols: Column[];
  rows: string[][];
  empty: { title: string; hint: string };
}

function buildTable(s: DataState, app: AppContext): Table {
  const { speedUnit: su, altUnit: au } = app.settings;
  const x = AREA.x;
  if (s.tab === 'TLM') {
    return {
      cols: [
        { head: 'T+', x: x + 2, anchor: 'start' },
        { head: su === 'KT' ? 'IAS KT' : 'IAS KMH', x: x + 112, anchor: 'end' },
        { head: `ALT ${au}`, x: x + 186, anchor: 'end' },
        { head: 'HDG', x: x + 230, anchor: 'end' },
        { head: au === 'FT' ? 'VS FPM' : 'VS M/S', x: x + 316, anchor: 'end' },
      ],
      rows: telemetryHistory(app.sim.time).map((r) => [
        mmss(r.t),
        String(Math.round(speed(r.ias, su))),
        String(Math.round(altitude(r.alt, au))),
        hdg3(r.hdg),
        signed(vspeed(r.vs, au), au === 'FT' ? 0 : 1),
      ]),
      empty: { title: 'NO SAMPLES', hint: 'SIM MUST RUN · 1 SAMPLE / 5 S' },
    };
  }
  if (s.tab === 'NAV') {
    const tel = telemetry(app.sim.time);
    return {
      cols: [
        { head: 'ID', x: x + 2, anchor: 'start' },
        { head: 'NAME', x: x + 34, anchor: 'start' },
        { head: 'BRG', x: x + 160, anchor: 'end' },
        { head: 'RNG NM', x: x + 240, anchor: 'end' },
        { head: 'ETE', x: x + 316, anchor: 'end' },
      ],
      rows: ROUTE.map((w, i) => {
        const si = steerInfo(tel, i);
        return [w.id, w.name, hdg3(si.bearing), si.range.toFixed(1), mmss(si.ete)];
      }),
      empty: { title: 'NO ROUTE', hint: 'LOAD A ROUTE' },
    };
  }
  return {
    cols: [
      { head: '#', x: x + 2, anchor: 'start' },
      { head: 'T+', x: x + 30, anchor: 'start' },
      { head: su === 'KT' ? 'IAS' : 'IAS', x: x + 150, anchor: 'end' },
      { head: `ALT ${au}`, x: x + 236, anchor: 'end' },
      { head: 'HDG', x: x + 316, anchor: 'end' },
    ],
    rows: s.log.map((e) => [
      String(e.n).padStart(2, '0'),
      mmss(e.t),
      String(Math.round(speed(e.ias, su))),
      String(Math.round(altitude(e.alt, au))),
      hdg3(e.hdg),
    ]),
    empty: { title: 'NO ENTRIES', hint: 'OSB 9 MARK CAPTURES A SNAPSHOT' },
  };
}

export function rowCount(s: DataState, app: AppContext): number {
  if (s.tab === 'TLM') return telemetryHistory(app.sim.time).length;
  if (s.tab === 'NAV') return ROUTE.length;
  return s.log.length;
}

export function firstVisible(selected: number, rows: number): number {
  return Math.max(0, Math.min(selected - Math.floor(VISIBLE_ROWS / 2), rows - VISIBLE_ROWS));
}

function DataView({ state: s, app }: PageViewProps<DataState>) {
  const table = buildTable(s, app);
  const n = table.rows.length;
  const sel = Math.min(s.selected, Math.max(0, n - 1));
  const start = firstVisible(sel, n);
  const shown = table.rows.slice(start, start + VISIBLE_ROWS);

  return (
    <g className="data" fontSize={10.5}>
      {table.cols.map((c) => (
        <text key={c.head} x={c.x} y={HEAD_Y} textAnchor={c.anchor} fontSize={9} className="t-dim">
          {c.head}
        </text>
      ))}
      <line x1={AREA.x} x2={AREA.x + AREA.w - 6} y1={HEAD_Y + 5} y2={HEAD_Y + 5} className="s-dim" />

      {n === 0 ? (
        <g>
          <rect x={AREA.x + 50} y={170} width={AREA.w - 100} height={52} className="frame" />
          <text x={AREA.x + AREA.w / 2} y={192} textAnchor="middle" fontSize={12} className="t-pri">
            {table.empty.title}
          </text>
          <text x={AREA.x + AREA.w / 2} y={210} textAnchor="middle" fontSize={9} className="t-dim">
            {table.empty.hint}
          </text>
        </g>
      ) : (
        shown.map((row, i) => {
          const idx = start + i;
          const y = FIRST_Y + i * ROW_H;
          const isSel = idx === sel;
          return (
            <g key={idx}>
              {isSel && <rect x={AREA.x - 2} y={y - 12} width={AREA.w - 2} height={ROW_H - 1} className="inv-box" />}
              {row.map((cell, c) => (
                <text key={c} x={table.cols[c].x} y={y} textAnchor={table.cols[c].anchor} className={isSel ? 't-inv' : c === 0 ? 't-sec' : 't-pri'}>
                  {cell}
                </text>
              ))}
            </g>
          );
        })
      )}

      {/* scroll bar */}
      {n > VISIBLE_ROWS && (
        <g>
          <line x1={AREA.x + AREA.w + 2} x2={AREA.x + AREA.w + 2} y1={FIRST_Y - 12} y2={FIRST_Y - 12 + VISIBLE_ROWS * ROW_H} className="s-dim" />
          <rect
            x={AREA.x + AREA.w}
            y={FIRST_Y - 12 + (start / n) * VISIBLE_ROWS * ROW_H}
            width={4}
            height={Math.max(8, (VISIBLE_ROWS / n) * VISIBLE_ROWS * ROW_H)}
            className="f-sec"
          />
        </g>
      )}
      <text x={AREA.x + AREA.w} y={AREA.y + AREA.h - 2} textAnchor="end" fontSize={9} className="t-dim">
        {n === 0 ? '0 ROWS' : `ROW ${sel + 1}/${n}`}
      </text>
    </g>
  );
}

export const dataPage = definePage<DataState>({
  id: 'DATA',
  label: 'DATA',
  title: 'DATA TABLES',
  description: 'Telemetry samples, route table and marked snapshots in aligned columns. Rows are selectable; MARK writes to LOG.',
  initialState: { tab: 'TLM', selected: 0, log: [] },
  View: DataView,
  keys: ({ state: s, app }) => {
    const n = rowCount(s, app);
    const sel = Math.min(s.selected, Math.max(0, n - 1));
    const go = (d: number) => () => set<DataState>({ selected: Math.max(0, Math.min(n - 1, sel + d)) });
    const keys: KeyMap = {
      20: { label: 'ROW\n▲', hint: 'Previous row', disabled: n === 0 || sel <= 0, press: go(-1) },
      19: { label: 'ROW\n▼', hint: 'Next row', disabled: n === 0 || sel >= n - 1, press: go(1) },
      6: { label: 'PG\n▲', hint: 'Page up', disabled: n === 0 || sel <= 0, press: go(-VISIBLE_ROWS) },
      7: { label: 'PG\n▼', hint: 'Page down', disabled: n === 0 || sel >= n - 1, press: go(VISIBLE_ROWS) },
      9: {
        label: 'MARK',
        hint: 'Snapshot telemetry to LOG',
        press: () => {
          const tel = telemetry(app.sim.time);
          const nextN = (s.log[0]?.n ?? 0) + 1;
          const entry: LogEntry = { n: nextN, t: app.sim.time, ias: tel.ias, alt: tel.alt, hdg: tel.hdg, vs: tel.vs };
          return set<DataState>({ log: [entry, ...s.log].slice(0, MAX_LOG) });
        },
      },
      10: {
        label: 'CLR',
        hint: 'Clear LOG',
        disabled: s.log.length === 0,
        press: () => set<DataState>({ log: [], selected: s.tab === 'LOG' ? 0 : s.selected }),
      },
    };
    (['TLM', 'NAV', 'LOG'] as const).forEach((t, i) => {
      keys[(i + 1) as 1 | 2 | 3] = {
        label: t,
        active: s.tab === t,
        hint: { TLM: 'Telemetry samples', NAV: 'Route table', LOG: 'Marked snapshots' }[t],
        press: () => set<DataState>({ tab: t, selected: 0 }),
      };
    });
    return keys;
  },
  prompt: ({ state: s, app }) =>
    rowCount(s, app) === 0 ? (s.tab === 'LOG' ? 'LOG EMPTY · MARK TO CAPTURE' : 'AWAITING DATA') : `${s.tab} · ${s.log.length} MARKED`,
});
