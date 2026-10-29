import { goto } from './dsl';
import type { AppContext, KeyMap, OsbId } from './types';

/** Bottom-row OSBs, left → right as they sit on the bezel. */
export const BOTTOM_ROW: OsbId[] = [15, 14, 13, 12, 11];

/**
 * Global key helper: a row of page selectors along the bottom edge.
 * Pressing the key of the page already shown opens `menu` (if given) —
 * the classic "press twice for the format menu" behaviour.
 *
 *   globalKeys: navBar(['NAV', 'FLT', 'SYS', 'DATA', 'CNFG'], { menu: 'MENU' })
 */
export function navBar(slots: Array<string | null>, opts: { menu?: string; row?: OsbId[] } = {}) {
  const row = opts.row ?? BOTTOM_ROW;
  return (app: AppContext): KeyMap => {
    const keys: KeyMap = {};
    slots.forEach((id, i) => {
      const osb = row[i];
      if (!id || !osb) return;
      const current = app.page === id;
      keys[osb] = {
        label: app.pageLabel(id),
        active: current,
        hint: current && opts.menu ? 'Press again for format menu' : app.pageTitle(id),
        press: () => (current ? (opts.menu ? goto(opts.menu) : null) : goto(id)),
      };
    });
    return keys;
  };
}
