import type {
  AppContext, Effect, EffectResult, EngineAction, InputEvent, KeyMap, LevelSetting,
  MfdConfig, MfdState, PageDef, RockerId, Settings, TransitionKind,
} from './types';

export const LEVEL_MIN = 10;
export const LEVEL_MAX = 100;
export const LEVEL_STEP = 10;

export const BASE_SETTINGS: Settings = {
  brightness: 80,
  contrast: 60,
  symbology: 90,
  gain: 50,
  glow: true,
  speedUnit: 'KT',
  altUnit: 'FT',
};

const MAX_MESSAGES = 40;
const MAX_HISTORY = 20;
const MAX_CHAIN = 8; // guards onEnter → goto → onEnter loops

const ROCKER_SETTING: Record<RockerId, LevelSetting> = {
  BRT: 'brightness',
  CON: 'contrast',
  SYM: 'symbology',
  GAIN: 'gain',
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const toList = (r: EffectResult): Effect[] => (!r ? [] : Array.isArray(r) ? r : [r]);

export interface Engine {
  config: MfdConfig;
  defaults: Settings;
  initialState: () => MfdState;
  reducer: (state: MfdState, action: EngineAction) => MfdState;
  page: (id: string) => PageDef;
  context: (state: MfdState) => AppContext;
  resolveKeys: (state: MfdState) => KeyMap;
  /** keys defined by the current page only */
  pageKeys: (state: MfdState) => KeyMap;
  /** keys from the app-wide globalKeys only */
  globalKeys: (state: MfdState) => KeyMap;
  prompt: (state: MfdState) => string;
}

export function createEngine(config: MfdConfig): Engine {
  const byId = new Map<string, PageDef>();
  for (const p of config.pages) {
    if (byId.has(p.id)) throw new Error(`Duplicate page id "${p.id}"`);
    byId.set(p.id, p);
  }
  if (!byId.has(config.home)) throw new Error(`Home page "${config.home}" is not registered`);

  const defaults: Settings = { ...BASE_SETTINGS, ...config.defaultSettings };
  const pageIds = config.pages.map((p) => p.id);
  const page = (id: string) => {
    const p = byId.get(id);
    if (!p) throw new Error(`Unknown page "${id}"`);
    return p;
  };

  const initialPages = () =>
    Object.fromEntries(config.pages.map((p) => [p.id, structuredClone(p.initialState)]));

  function initialState(): MfdState {
    return {
      page: config.home,
      history: [],
      pages: initialPages(),
      settings: { ...defaults },
      sim: { running: true, time: 0 },
      sources: {},
      messages: [{ id: 0, t: 0, text: 'MFD POWER UP · BIT PASS' }],
      seq: 1,
      lastPress: null,
      transition: null,
    };
  }

  function context(state: MfdState): AppContext {
    return {
      page: state.page,
      settings: state.settings,
      sim: state.sim,
      sources: state.sources,
      pageIds,
      pageTitle: (id) => byId.get(id)?.title ?? id,
      pageLabel: (id) => byId.get(id)?.label ?? id,
    };
  }

  const pageCtx = (state: MfdState, id = state.page) => ({ state: state.pages[id] as any, app: context(state) });

  const globalKeys = (state: MfdState): KeyMap => config.globalKeys?.(context(state)) ?? {};
  const pageKeys = (state: MfdState): KeyMap => page(state.page).keys(pageCtx(state));

  function resolveKeys(state: MfdState): KeyMap {
    return { ...globalKeys(state), ...pageKeys(state) };
  }

  function prompt(state: MfdState): string {
    return page(state.page).prompt?.(pageCtx(state)) ?? '';
  }

  function log(state: MfdState, text: string): MfdState {
    const msg = { id: state.seq, t: state.sim.time, text };
    return { ...state, seq: state.seq + 1, messages: [msg, ...state.messages].slice(0, MAX_MESSAGES) };
  }

  function navigate(state: MfdState, to: string, kind: TransitionKind | undefined, pushHistory: boolean, depth: number): MfdState {
    if (to === state.page || !byId.has(to)) {
      return byId.has(to) ? state : log(state, `NO PAGE ${to}`);
    }
    const from = state.page;
    let s = applyAll(state, toList(page(from).onExit?.(pageCtx(state, from))), from, depth + 1);
    s = {
      ...s,
      page: to,
      history: pushHistory ? [...s.history, from].slice(-MAX_HISTORY) : s.history,
      transition: { from, to, kind: kind ?? config.defaultTransition ?? 'blank', seq: s.seq },
      seq: s.seq + 1,
    };
    return applyAll(s, toList(page(to).onEnter?.(pageCtx(s, to))), to, depth + 1);
  }

  function apply(state: MfdState, e: Effect, owner: string, depth: number): MfdState {
    if (depth > MAX_CHAIN) return log(state, 'EFFECT CHAIN LIMIT');
    switch (e.type) {
      case 'set': {
        const id = e.page ?? owner;
        if (!byId.has(id)) return state;
        return { ...state, pages: { ...state.pages, [id]: { ...(state.pages[id] as object), ...e.patch } } };
      }
      case 'goto':
        return navigate(state, e.page, e.transition, true, depth);
      case 'back': {
        const prev = state.history[state.history.length - 1];
        if (!prev) return state;
        const s = { ...state, history: state.history.slice(0, -1) };
        return navigate(s, prev, e.transition, false, depth);
      }
      case 'settings': {
        const next = { ...state.settings, ...e.patch };
        for (const k of ['brightness', 'contrast', 'symbology', 'gain'] as const) {
          next[k] = clamp(next[k], LEVEL_MIN, LEVEL_MAX);
        }
        return { ...state, settings: next };
      }
      case 'step': {
        const v = clamp(state.settings[e.setting] + e.dir * LEVEL_STEP, LEVEL_MIN, LEVEL_MAX);
        return { ...state, settings: { ...state.settings, [e.setting]: v } };
      }
      case 'sim': {
        const sim = state.sim;
        if (e.op === 'reset') return log({ ...state, sim: { ...sim, time: 0 } }, 'SIM RESET T+00:00');
        const running = e.op === 'toggle' ? !sim.running : e.op === 'run';
        if (running === sim.running) return state;
        return log({ ...state, sim: { ...sim, running } }, running ? 'SIM RUN' : 'SIM HOLD');
      }
      case 'log':
        return log(state, e.text);
      case 'resetDefaults':
        return log({ ...state, settings: { ...defaults }, pages: initialPages() }, 'DEFAULTS RESTORED');
    }
  }

  function applyAll(state: MfdState, effects: Effect[], owner: string, depth = 0): MfdState {
    return effects.reduce((s, e) => apply(s, e, owner, depth), state);
  }

  const tag = (origin?: string) => (origin && origin !== 'ui' ? `[${origin.toUpperCase()}] ` : '');

  function input(state: MfdState, ev: InputEvent, origin?: string): MfdState {
    switch (ev.type) {
      case 'osb': {
        const pressed = { ...state, lastPress: { key: `OSB${ev.id}`, seq: state.seq }, seq: state.seq + 1 };
        const key = resolveKeys(state)[ev.id];
        if (!key || key.disabled || !key.press) return pressed;
        const owner = state.page;
        const next = applyAll(pressed, toList(key.press()), owner);
        return log(next, `${tag(origin)}OSB ${String(ev.id).padStart(2, '0')} ${key.label.replace('\n', ' ')}`);
      }
      case 'rocker': {
        const pressed = {
          ...state,
          lastPress: { key: `${ev.id}${ev.dir > 0 ? '+' : '-'}`, seq: state.seq },
          seq: state.seq + 1,
        };
        const custom = config.rockers?.[ev.id];
        const effects: Effect[] = custom
          ? toList(ev.dir > 0 ? custom.up() : custom.down())
          : [{ type: 'step', setting: ROCKER_SETTING[ev.id], dir: ev.dir }];
        const next = applyAll(pressed, effects, state.page);
        const val = custom ? '' : ` ${next.settings[ROCKER_SETTING[ev.id]]}`;
        return log(next, `${tag(origin)}${ev.id} ${ev.dir > 0 ? '▲' : '▼'}${val}`);
      }
      case 'page': {
        const next = applyAll(state, [{ type: 'goto', page: ev.page }], state.page);
        return next.page !== state.page ? log(next, `${tag(origin)}PAGE ${ev.page}`) : next;
      }
      case 'sim':
        return applyAll(state, [{ type: 'sim', op: ev.op }], state.page);
      case 'data':
        return { ...state, sources: { ...state.sources, [ev.source]: ev.value } };
      case 'cancel':
        return applyAll(state, toList(page(state.page).onCancel?.(pageCtx(state))), state.page);
    }
  }

  function reducer(state: MfdState, action: EngineAction): MfdState {
    switch (action.type) {
      case 'input':
        return input(state, action.event, action.origin);
      case 'tick':
        if (!state.sim.running) return state;
        return { ...state, sim: { ...state.sim, time: +(state.sim.time + action.dt).toFixed(3) } };
      case 'transitionDone':
        return state.transition ? { ...state, transition: null } : state;
    }
  }

  return { config, defaults, initialState, reducer, page, context, resolveKeys, pageKeys, globalKeys, prompt };
}
