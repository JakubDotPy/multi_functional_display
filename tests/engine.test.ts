import { describe, expect, it } from 'vitest';
import { engine } from '../src/app.config';
import { createEngine } from '../src/core/engine';
import { definePage, goto, log, set } from '../src/core/dsl';
import type { InputEvent, MfdState, OsbId } from '../src/core/types';

const input = (s: MfdState, event: InputEvent) => engine.reducer(s, { type: 'input', event });
const press = (s: MfdState, ...ids: OsbId[]) => ids.reduce((acc, id) => input(acc, { type: 'osb', id }), s);
const label = (s: MfdState, id: OsbId) => engine.resolveKeys(s)[id]?.label;

describe('page navigation', () => {
  it('starts on the home page with the nav bar on the bottom row', () => {
    const s = engine.initialState();
    expect(s.page).toBe('NAV');
    expect([15, 14, 13, 12, 11].map((id) => label(s, id as OsbId))).toEqual(['NAV', 'FLT', 'SYS', 'DATA', 'CNFG']);
    expect(engine.resolveKeys(s)[15]?.active).toBe(true);
  });

  it('bottom keys switch pages and the legends follow', () => {
    let s = press(engine.initialState(), 14);
    expect(s.page).toBe('FLT');
    expect(label(s, 1)).toBe('RUN');
    s = press(s, 13);
    expect(s.page).toBe('SYS');
    expect(label(s, 1)).toBe('ELEC');
    s = press(s, 12);
    expect(s.page).toBe('DATA');
    expect(label(s, 1)).toBe('TLM');
    s = press(s, 11);
    expect(s.page).toBe('CNFG');
    expect(label(s, 10)).toBe('DFLT');
  });

  it('pressing the current page key opens MENU, RTN goes back', () => {
    let s = press(engine.initialState(), 15);
    expect(s.page).toBe('MENU');
    expect(s.history).toEqual(['NAV']);
    s = press(s, 1);
    expect(s.page).toBe('NAV');
    expect(s.history).toEqual([]);
  });

  it('MENU reaches pages that have no bottom-row slot', () => {
    let s = press(engine.initialState(), 15);
    const keys = engine.resolveKeys(s);
    const feedKey = (Object.entries(keys).find(([, k]) => k?.label === 'FEED')?.[0]);
    expect(feedKey).toBeDefined();
    s = press(s, Number(feedKey) as OsbId);
    expect(s.page).toBe('FEED');
  });

  it('records a transition for the display', () => {
    const s = press(engine.initialState(), 14);
    expect(s.transition).toMatchObject({ from: 'NAV', to: 'FLT', kind: 'blank' });
    expect(engine.reducer(s, { type: 'transitionDone' }).transition).toBeNull();
  });

  it('PAGE input from hardware navigates directly', () => {
    expect(input(engine.initialState(), { type: 'page', page: 'DATA' }).page).toBe('DATA');
  });
});

describe('soft keys', () => {
  it('NAV range keys change the range and disable at the limits', () => {
    let s = engine.initialState();
    expect(label(s, 7)).toBe('40');
    s = press(s, 6);
    expect(label(s, 7)).toBe('80');
    s = press(s, 6, 6, 6);
    expect(label(s, 7)).toBe('160');
    expect(engine.resolveKeys(s)[6]?.disabled).toBe(true);
    const again = press(s, 6);
    expect(label(again, 7)).toBe('160');
    s = press(s, 7);
    expect(label(s, 7)).toBe('40');
  });

  it('toggle keys flip their legend / active state', () => {
    let s = engine.initialState();
    expect(label(s, 1)).toBe('HDG UP');
    s = press(s, 1);
    expect(label(s, 1)).toBe('NTH UP');
    expect(engine.resolveKeys(s)[3]?.active).toBeFalsy();
    s = press(s, 3);
    expect(engine.resolveKeys(s)[3]?.active).toBe(true);
  });

  it('blank OSBs do nothing but still register the press', () => {
    const s0 = engine.initialState();
    const s = press(s0, 10);
    expect(s.pages).toEqual(s0.pages);
    expect(s.lastPress?.key).toBe('OSB10');
  });

  it('SYS MODE cycles the selected subsystem state', () => {
    let s = press(engine.initialState(), 13);
    const st = () => (s.pages.SYS as { states: Record<string, string> }).states.GEN1;
    expect(st()).toBe('NORMAL');
    s = press(s, 7);
    expect(st()).toBe('STANDBY');
    s = press(s, 7, 7);
    expect(st()).toBe('NORMAL');
  });

  it('DATA MARK fills the log and CLR empties it', () => {
    let s = press(engine.initialState(), 12, 3);
    expect(engine.resolveKeys(s)[10]?.disabled).toBe(true);
    s = press(s, 9, 9);
    expect((s.pages.DATA as { log: unknown[] }).log).toHaveLength(2);
    s = press(s, 10);
    expect((s.pages.DATA as { log: unknown[] }).log).toHaveLength(0);
  });
});

describe('settings', () => {
  it('rockers step levels and clamp to 10–100', () => {
    let s = engine.initialState();
    const b0 = s.settings.brightness;
    s = input(s, { type: 'rocker', id: 'BRT', dir: 1 });
    expect(s.settings.brightness).toBe(Math.min(100, b0 + 10));
    for (let i = 0; i < 20; i++) s = input(s, { type: 'rocker', id: 'BRT', dir: -1 });
    expect(s.settings.brightness).toBe(10);
  });

  it('CNFG adjusts the selected row and toggles units', () => {
    let s = press(engine.initialState(), 11);
    s = press(s, 7); // DEC brightness
    expect(s.settings.brightness).toBe(70);
    s = press(s, 19, 19, 19, 19, 19); // → SPEED UNIT
    expect(label(s, 6)).toBe('TGL');
    expect(engine.resolveKeys(s)[7]?.disabled).toBe(true);
    s = press(s, 6);
    expect(s.settings.speedUnit).toBe('KMH');
  });

  it('restore defaults needs two presses and ESC cancels', () => {
    let s = press(engine.initialState(), 11);
    s = press(s, 7, 7); // brightness 60
    s = press(s, 10);
    expect(label(s, 10)).toBe('CONF');
    s = input(s, { type: 'cancel' });
    expect(label(s, 10)).toBe('DFLT');
    expect(s.settings.brightness).toBe(60);
    s = press(s, 10, 10);
    expect(s.settings.brightness).toBe(engine.defaults.brightness);
  });

  it('leaving CNFG disarms a pending reset (onExit)', () => {
    let s = press(engine.initialState(), 11, 10);
    s = press(s, 15, 11);
    expect(label(s, 10)).toBe('DFLT');
  });
});

describe('simulation', () => {
  it('ticks only while running', () => {
    let s = engine.reducer(engine.initialState(), { type: 'tick', dt: 0.1 });
    expect(s.sim.time).toBeCloseTo(0.1);
    s = input(s, { type: 'sim', op: 'hold' });
    s = engine.reducer(s, { type: 'tick', dt: 0.1 });
    expect(s.sim.time).toBeCloseTo(0.1);
    s = press(s, 14, 1); // FLT → RUN
    expect(s.sim.running).toBe(true);
  });

  it('DATA input stores external sources', () => {
    const s = input(engine.initialState(), { type: 'data', source: 'farm', value: { ok: 3 } });
    expect(s.sources.farm).toEqual({ ok: 3 });
  });
});

describe('custom pages via definePage', () => {
  const a = definePage({
    id: 'A', label: 'A', title: 'A', initialState: { n: 0 }, View: () => null,
    keys: ({ state }) => ({
      1: { label: 'INC', press: () => set({ n: state.n + 1 }) },
      2: { label: 'GO B', press: () => [log('leaving'), goto('B', 'wipe')] },
    }),
    onExit: () => set({ n: 99 }),
  });
  const b = definePage({
    id: 'B', label: 'B', title: 'B', initialState: {}, View: () => null,
    keys: () => ({}),
    onEnter: () => log('entered B'),
  });
  const e = createEngine({ ident: 'T', home: 'A', pages: [a, b] });
  const p = (s: MfdState, id: OsbId) => e.reducer(s, { type: 'input', event: { type: 'osb', id } });

  it('applies set / goto / lifecycle effects in order', () => {
    let s = p(e.initialState(), 1);
    expect(s.pages.A).toEqual({ n: 1 });
    s = p(s, 2);
    expect(s.page).toBe('B');
    expect(s.pages.A).toEqual({ n: 99 });
    expect(s.transition?.kind).toBe('wipe');
    expect(s.messages.map((m) => m.text)).toEqual(expect.arrayContaining(['leaving', 'entered B']));
  });

  it('rejects duplicate ids and unknown home pages', () => {
    expect(() => createEngine({ ident: 'T', home: 'A', pages: [a, a] })).toThrow(/Duplicate/);
    expect(() => createEngine({ ident: 'T', home: 'Z', pages: [a] })).toThrow(/Home/);
  });
});
