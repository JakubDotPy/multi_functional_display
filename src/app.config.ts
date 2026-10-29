/**
 * ───────────────────────────────────────────────────────────────
 *  MFD APPLICATION CONFIG — the one file you edit to add pages.
 * ───────────────────────────────────────────────────────────────
 *  1. Write a page with `definePage` (copy src/pages/_template.tsx).
 *  2. Import it here and add it to `pages`.
 *  3. Optionally give it a bottom-row slot in `navBar([...])`.
 *     Pages without a slot are still reachable from MENU
 *     (press the current page's bottom key twice).
 */
import { createEngine } from './core/engine';
import { navBar } from './core/navbar';
import type { MfdConfig, PageDef } from './core/types';
import { examplePage } from './pages/_template';
import { configPage } from './pages/config';
import { dataPage } from './pages/data';
import { feedPage } from './pages/feed';
import { flightPage } from './pages/flight';
import { menuPage } from './pages/menu';
import { navPage } from './pages/nav';
import { systemsPage } from './pages/systems';

const pages: PageDef[] = [navPage, flightPage, systemsPage, dataPage, configPage, feedPage, examplePage];

export const appConfig: MfdConfig = {
  ident: 'VX-07',
  home: 'NAV',
  pages: [...pages, menuPage(() => pages.map((p) => p.id))],
  // bottom row, left → right (OSB 15 … 11)
  globalKeys: navBar(['NAV', 'FLT', 'SYS', 'DATA', 'CNFG'], { menu: 'MENU' }),
  // 'cut' | 'blank' (brief redraw blank, like real hardware) | 'wipe'
  defaultTransition: 'blank',
  // rockers default to BRT / CON / SYM / GAIN levels; override here, e.g.
  // rockers: { GAIN: { up: () => goto('FEED'), down: () => back(), hint: 'Feed' } },
};

export const engine = createEngine(appConfig);
