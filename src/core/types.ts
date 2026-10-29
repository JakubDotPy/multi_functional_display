/**
 * Core MFD engine types.
 *
 * The engine knows nothing about specific pages. A page is a plain object
 * (see `definePage`) that declares its own state, its soft keys and its view.
 * Key presses return *effects* — small data objects the engine applies — so
 * page logic stays pure and is trivially unit-testable.
 */
import type { ComponentType } from 'react';

/** Option Select Buttons, numbered like a real bezel:
 *  top 1–5 (L→R), right 6–10 (T→B), bottom 11–15 (R→L), left 16–20 (B→T). */
export type OsbId =
  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10
  | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20;
export const OSB_IDS: OsbId[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

/** Corner rocker switches. */
export type RockerId = 'GAIN' | 'SYM' | 'BRT' | 'CON';
export const ROCKER_IDS: RockerId[] = ['GAIN', 'SYM', 'BRT', 'CON'];

export type SpeedUnit = 'KT' | 'KMH';
export type AltUnit = 'FT' | 'M';

export interface Settings {
  /** 10–100 overall display luminance (BRT rocker) */
  brightness: number;
  /** 10–100 display contrast (CON rocker) */
  contrast: number;
  /** 10–100 symbology intensity relative to text (SYM rocker) */
  symbology: number;
  /** 10–100 background / map layer gain (GAIN rocker) */
  gain: number;
  glow: boolean;
  speedUnit: SpeedUnit;
  altUnit: AltUnit;
}
export type LevelSetting = 'brightness' | 'contrast' | 'symbology' | 'gain';

export type TransitionKind = 'cut' | 'blank' | 'wipe';

export interface Message {
  id: number;
  t: number;
  text: string;
}

/** Everything the engine owns. Page states live in `pages[pageId]`. */
export interface MfdState {
  page: string;
  /** previous pages, for `back()` */
  history: string[];
  pages: Record<string, unknown>;
  settings: Settings;
  sim: { running: boolean; time: number };
  /** external data pushed in by input adapters (`DATA <id> <json>`) */
  sources: Record<string, unknown>;
  messages: Message[];
  seq: number;
  /** last physical control used, for visual press feedback */
  lastPress: { key: string; seq: number } | null;
  /** the most recent page change, drives the display transition */
  transition: { from: string; to: string; kind: TransitionKind; seq: number } | null;
}

/** Read-only view of the app handed to page functions. */
export interface AppContext {
  page: string;
  settings: Settings;
  sim: { running: boolean; time: number };
  sources: Record<string, unknown>;
  /** id of every registered page, in registration order */
  pageIds: string[];
  /** title lookup for menus */
  pageTitle: (id: string) => string;
  /** short legend lookup for menus / nav bars */
  pageLabel: (id: string) => string;
}

export interface PageContext<S> {
  state: S;
  app: AppContext;
}

// ---------------------------------------------------------------- effects

export type Effect =
  | { type: 'set'; patch: Record<string, unknown>; page?: string }
  | { type: 'goto'; page: string; transition?: TransitionKind }
  | { type: 'back'; transition?: TransitionKind }
  | { type: 'settings'; patch: Partial<Settings> }
  | { type: 'step'; setting: LevelSetting; dir: 1 | -1 }
  | { type: 'sim'; op: 'run' | 'hold' | 'toggle' | 'reset' }
  | { type: 'log'; text: string }
  | { type: 'resetDefaults' };

export type EffectResult = Effect | Effect[] | void | null | undefined | false;

// ---------------------------------------------------------------- keys

export interface KeyDef {
  /** legend shown on the display next to the button; '\n' for two lines */
  label: string;
  /** description for the side panel, tooltips and screen readers */
  hint?: string;
  /** inverse-video legend (selected mode / current page) */
  active?: boolean;
  /** legend dimmed, press ignored */
  disabled?: boolean;
  /** what happens on press — return one or more effects */
  press?: () => EffectResult;
}

export type KeyMap = Partial<Record<OsbId, KeyDef>>;

export interface RockerDef {
  up: () => EffectResult;
  down: () => EffectResult;
  hint?: string;
}

// ---------------------------------------------------------------- pages

export interface PageViewProps<S> {
  state: S;
  app: AppContext;
}

export interface PageDef<S = any> {
  /** unique id, also used in `goto('ID')` and the hardware protocol `PAGE ID` */
  id: string;
  /** short legend used on menu / nav-bar keys (≤ 5 chars reads best) */
  label: string;
  /** long title for the status strip and side panel */
  title: string;
  /** one or two sentences for the side panel */
  description?: string;
  initialState: S;
  /** soft keys for this page; merged over the app's global keys */
  keys: (ctx: PageContext<S>) => KeyMap;
  /** SVG content drawn in the 440 × 440 display area */
  View: ComponentType<PageViewProps<S>>;
  /** bottom prompt line */
  prompt?: (ctx: PageContext<S>) => string;
  onEnter?: (ctx: PageContext<S>) => EffectResult;
  onExit?: (ctx: PageContext<S>) => EffectResult;
  /** Escape / `CANCEL` from hardware */
  onCancel?: (ctx: PageContext<S>) => EffectResult;
  /** hide from the MENU page */
  hidden?: boolean;
}

export interface MfdConfig {
  /** aircraft / unit identifier shown in the status strip */
  ident: string;
  pages: PageDef[];
  home: string;
  /** keys present on every page (pages may override a slot) */
  globalKeys?: (ctx: AppContext) => KeyMap;
  /** behaviour of the four corner rockers */
  rockers?: Partial<Record<RockerId, RockerDef>>;
  defaultTransition?: TransitionKind;
  defaultSettings?: Partial<Settings>;
}

// ---------------------------------------------------------------- input

/** A hardware-neutral input event. Every adapter (bezel UI, keyboard,
 *  serial, websocket, tests) produces these. */
export type InputEvent =
  | { type: 'osb'; id: OsbId }
  | { type: 'rocker'; id: RockerId; dir: 1 | -1 }
  | { type: 'page'; page: string }
  | { type: 'sim'; op: 'run' | 'hold' | 'toggle' | 'reset' }
  | { type: 'data'; source: string; value: unknown }
  | { type: 'cancel' };

export type EngineAction =
  | { type: 'input'; event: InputEvent; origin?: string }
  | { type: 'tick'; dt: number }
  | { type: 'transitionDone' };
