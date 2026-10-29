/**
 * The page-definition DSL. Import these helpers in a page file:
 *
 *   export default definePage({
 *     id: 'PWR', label: 'PWR', title: 'POWER', initialState: { on: false },
 *     keys: ({ state }) => ({
 *       1: { label: state.on ? 'ON' : 'OFF', active: state.on, press: () => set({ on: !state.on }) },
 *       10: { label: 'RTN', press: () => back() },
 *     }),
 *     View: ({ state }) => <text x={220} y={220} className="t-pri">{state.on ? 'ON' : 'OFF'}</text>,
 *   });
 */
import type { Effect, LevelSetting, PageDef, Settings, TransitionKind } from './types';

export function definePage<S>(def: PageDef<S>): PageDef<S> {
  return def;
}

/** Merge a patch into the pressing page's state (or another page's, by id). */
export const set = <S>(patch: Partial<S>, page?: string): Effect => ({
  type: 'set',
  patch: patch as Record<string, unknown>,
  page,
});
/** Navigate to another page. */
export const goto = (page: string, transition?: TransitionKind): Effect => ({ type: 'goto', page, transition });
/** Return to the previous page. */
export const back = (transition?: TransitionKind): Effect => ({ type: 'back', transition });
/** Change global display settings. */
export const settings = (patch: Partial<Settings>): Effect => ({ type: 'settings', patch });
/** Step a 10–100 level setting by ±10. */
export const step = (setting: LevelSetting, dir: 1 | -1): Effect => ({ type: 'step', setting, dir });
/** Control the simulation clock. */
export const sim = (op: 'run' | 'hold' | 'toggle' | 'reset'): Effect => ({ type: 'sim', op });
/** Add a line to the side-panel event log. */
export const log = (text: string): Effect => ({ type: 'log', text });
/** Restore default settings and every page's initial state. */
export const resetDefaults = (): Effect => ({ type: 'resetDefaults' });
