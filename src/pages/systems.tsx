import { definePage, log, set } from '../core/dsl';
import type { KeyMap, PageViewProps } from '../core/types';
import { AREA } from '../mfd/geometry';
import { LINKS, SUBSYSTEMS, SYS_GROUPS, defaultSubStates, nextSubState, subsystemsIn } from '../sim/systems';
import type { SubState, SysGroup } from '../sim/systems';

export interface SysState {
  group: SysGroup;
  selected: number;
  detail: boolean;
  states: Record<string, SubState>;
}

const SCH = { x: AREA.x, y: AREA.y + 8 };
const NODE_W = 66;
const NODE_H = 20;
const LIST_Y = 176;
const ROW_H = 16;

const stateClass = (s: SubState) => (s === 'NORMAL' ? 'st-norm' : s === 'STANDBY' ? 'st-stby' : 'st-inac');

function SysView({ state: s, app }: PageViewProps<SysState>) {
  const list = subsystemsIn(s.group);
  const sel = list[s.selected];
  const byId = Object.fromEntries(list.map((d) => [d.id, d]));
  const counts = { NORMAL: 0, STANDBY: 0, INACTIVE: 0 } as Record<SubState, number>;
  for (const d of SUBSYSTEMS) counts[s.states[d.id]]++;

  return (
    <g className="sys">
      {/* schematic */}
      <g>
        {LINKS[s.group].map(([a, b]) => {
          const A = byId[a].node;
          const B = byId[b].node;
          const live = s.states[a] === 'NORMAL' && s.states[b] === 'NORMAL';
          return (
            <line
              key={`${a}-${b}`}
              x1={SCH.x + A.x + (A.x < B.x ? NODE_W / 2 - 2 : 0)} y1={SCH.y + A.y}
              x2={SCH.x + B.x - (A.x < B.x ? NODE_W / 2 - 2 : 0)} y2={SCH.y + B.y}
              className={live ? 's-pri' : 's-dim dash'}
            />
          );
        })}
        {list.map((d, i) => {
          const st = s.states[d.id];
          const isSel = i === s.selected;
          return (
            <g key={d.id} className={stateClass(st)}>
              <rect
                x={SCH.x + d.node.x - NODE_W / 2} y={SCH.y + d.node.y - NODE_H / 2}
                width={NODE_W} height={NODE_H}
                className={isSel ? 'node node-sel' : 'node'}
              />
              <text
                x={SCH.x + d.node.x} y={SCH.y + d.node.y + 3.5}
                textAnchor="middle" fontSize={9}
                className={isSel ? 't-inv' : st === 'INACTIVE' ? 't-dim' : 't-pri'}
              >
                {d.name}
              </text>
            </g>
          );
        })}
      </g>

      {/* list */}
      <line x1={AREA.x} x2={AREA.x + AREA.w} y1={LIST_Y - 12} y2={LIST_Y - 12} className="s-dim" />
      {list.map((d, i) => {
        const st = s.states[d.id];
        const y = LIST_Y + i * ROW_H;
        const isSel = i === s.selected;
        return (
          <g key={d.id} fontSize={10.5}>
            {isSel && <rect x={AREA.x - 2} y={y - 11} width={AREA.w + 4} height={ROW_H - 1} className="inv-box" />}
            <text x={AREA.x + 4} y={y} className={isSel ? 't-inv' : 't-pri'}>{d.name}</text>
            <text x={AREA.x + AREA.w - 4} y={y} textAnchor="end" className={isSel ? 't-inv' : `t-state ${stateClass(st)}`}>
              {st}
            </text>
          </g>
        );
      })}

      {/* detail */}
      {s.detail ? (
        <g fontSize={10}>
          <rect x={AREA.x} y={262} width={AREA.w} height={120} className="frame" />
          <text x={AREA.x + 8} y={278} className="t-pri">{sel.name}</text>
          <text x={AREA.x + AREA.w - 8} y={278} textAnchor="end" className={`t-state ${stateClass(s.states[sel.id])}`}>
            {s.states[sel.id]}
          </text>
          {sel.metrics(app.sim.time, s.states[sel.id]).map((m, i) => (
            <g key={m.k}>
              <text x={AREA.x + 8} y={298 + i * 16} className="t-dim">{m.k}</text>
              <text x={AREA.x + 150} y={298 + i * 16} textAnchor="end" className="t-pri">{m.v}</text>
              <text x={AREA.x + 156} y={298 + i * 16} className="t-dim" fontSize={9}>{m.u}</text>
            </g>
          ))}
          <text x={AREA.x + AREA.w - 8} y={372} textAnchor="end" fontSize={9} className="t-dim">
            ALL SYS {counts.NORMAL} NORM · {counts.STANDBY} STBY · {counts.INACTIVE} INAC
          </text>
        </g>
      ) : (
        <text x={AREA.x + AREA.w / 2} y={320} textAnchor="middle" fontSize={9.5} className="t-dim">
          DETAIL OFF · OSB 6 DTL
        </text>
      )}
    </g>
  );
}

export const systemsPage = definePage<SysState>({
  id: 'SYS',
  label: 'SYS',
  title: 'SUBSYSTEM STATUS',
  description: 'Fictional electrical, environmental and general subsystems. Select a row for detail; MODE cycles NORMAL → STANDBY → INACTIVE.',
  initialState: { group: 'ELEC', selected: 0, detail: true, states: defaultSubStates() },
  View: SysView,
  keys: ({ state: s }) => {
    const list = subsystemsIn(s.group);
    const sel = list[s.selected];
    const n = list.length;
    const keys: KeyMap = {
      6: { label: 'DTL', active: s.detail, hint: 'Show / hide subsystem detail', press: () => set<SysState>({ detail: !s.detail }) },
      7: {
        label: 'MODE',
        hint: `Cycle ${sel.name} state`,
        press: () => {
          const nxt = nextSubState(s.states[sel.id]);
          return [set<SysState>({ states: { ...s.states, [sel.id]: nxt } }), log(`${sel.name} → ${nxt}`)];
        },
      },
      20: { label: 'SEL\n▲', hint: 'Previous subsystem', press: () => set<SysState>({ selected: (s.selected - 1 + n) % n }) },
      19: { label: 'SEL\n▼', hint: 'Next subsystem', press: () => set<SysState>({ selected: (s.selected + 1) % n }) },
    };
    SYS_GROUPS.forEach((g, i) => {
      keys[(i + 1) as 1 | 2 | 3] = {
        label: g,
        active: s.group === g,
        hint: `${g} subsystem group`,
        press: () => set<SysState>({ group: g, selected: 0 }),
      };
    });
    return keys;
  },
  prompt: ({ state: s }) => `${subsystemsIn(s.group)[s.selected].name} · MODE CYCLES STATE`,
});
