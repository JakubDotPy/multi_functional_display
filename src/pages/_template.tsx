/**
 * PAGE TEMPLATE — copy this file, rename, and register it in src/app.config.ts.
 *
 * A page is: an id, some state, a key map, and an SVG view.
 *  - `keys` is called on every render with the current state; return the legends
 *    you want. Unlisted OSBs are blank (and inert).
 *  - `press` returns effects:  set({...})  goto('ID')  back()  settings({...})
 *    step('brightness', 1)  sim('toggle')  log('text')  resetDefaults()
 *    — or an array of them. Never mutate state directly.
 *  - The View draws into the 440×440 glass. Keep main content inside AREA
 *    (x 60–380, y 54–386) so it never collides with legends.
 *  - Text classes: t-hi t-pri t-sec t-dim t-inv · strokes: s-pri s-sec s-dim · fills: f-pri f-sec
 *  - External data: app.sources[<id>] (fed by `DATA <id> <json>` over serial / websocket).
 */
import { back, definePage, goto, log, set } from '../core/dsl';
import type { PageViewProps } from '../core/types';
import { AREA, AREA_CX } from '../mfd/geometry';

interface ExampleState {
  count: number;
  armed: boolean;
}

function ExampleView({ state, app }: PageViewProps<ExampleState>) {
  const feed = app.sources.example as { status?: string } | undefined;
  return (
    <g>
      <text x={AREA_CX} y={AREA.y + 120} textAnchor="middle" fontSize={28} className="t-hi">
        {String(state.count).padStart(3, '0')}
      </text>
      <text x={AREA_CX} y={AREA.y + 144} textAnchor="middle" fontSize={10} className={state.armed ? 't-pri blink' : 't-dim'}>
        {state.armed ? 'ARMED' : 'SAFE'}
      </text>
      <text x={AREA_CX} y={AREA.y + 180} textAnchor="middle" fontSize={10} className="t-sec">
        FEED {feed?.status ?? '---'}
      </text>
    </g>
  );
}

export const examplePage = definePage<ExampleState>({
  id: 'EXMPL',
  label: 'EXMPL',
  title: 'EXAMPLE PAGE',
  description: 'Counter with a two-step confirm, a transition and a data feed.',
  initialState: { count: 0, armed: false },
  View: ExampleView,
  keys: ({ state }) => ({
    6: { label: 'INC', hint: 'Add one', press: () => set<ExampleState>({ count: state.count + 1 }) },
    7: { label: 'DEC', hint: 'Subtract one', disabled: state.count === 0, press: () => set<ExampleState>({ count: state.count - 1 }) },
    10: {
      label: state.armed ? 'CONF' : 'ZERO',
      active: state.armed,
      hint: 'Reset counter (press twice)',
      press: () =>
        state.armed
          ? [set<ExampleState>({ count: 0, armed: false }), log('COUNTER ZEROED')]
          : set<ExampleState>({ armed: true }),
    },
    16: { label: 'NAV', hint: 'Jump to NAV with a wipe', press: () => goto('NAV', 'wipe') },
    1: { label: 'RTN', hint: 'Back', press: () => back() },
  }),
  onExit: () => set<ExampleState>({ armed: false }),
  onCancel: () => set<ExampleState>({ armed: false }),
  prompt: ({ state }) => (state.armed ? 'PRESS CONF TO ZERO' : `COUNT ${state.count}`),
});
