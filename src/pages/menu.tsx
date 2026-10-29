import { back, definePage, goto } from '../core/dsl';
import type { KeyMap, OsbId, PageViewProps } from '../core/types';
import { AREA, AREA_CX } from '../mfd/geometry';

/**
 * Master format menu (reached by pressing the current page's bottom key again,
 * like a real format-selection page). Lists every non-hidden page on the side
 * and top keys, so pages that have no permanent bottom-row slot are still reachable.
 */
const SLOTS: OsbId[] = [20, 19, 18, 17, 16, 6, 7, 8, 9, 10, 2, 3, 4];

export function menuPage(pageIds: () => string[]) {
  const listed = () => pageIds().filter((id) => id !== 'MENU');
  return definePage<Record<string, never>>({
    id: 'MENU',
    label: 'MENU',
    title: 'FORMAT SELECTION',
    description: 'Master menu. Press a legend to open that format; RTN returns to the previous page.',
    initialState: {},
    hidden: true,
    View: ({ app }: PageViewProps<Record<string, never>>) => (
      <g>
        <rect x={AREA_CX - 90} y={AREA.y + 120} width={180} height={64} className="frame" />
        <text x={AREA_CX} y={AREA.y + 146} textAnchor="middle" fontSize={14} className="t-pri">
          FORMAT SELECT
        </text>
        <text x={AREA_CX} y={AREA.y + 166} textAnchor="middle" fontSize={9.5} className="t-dim">
          {listed().length} FORMATS · {app.pageIds.length} REGISTERED
        </text>
      </g>
    ),
    keys: ({ app }) => {
      const keys: KeyMap = {
        1: { label: 'RTN', hint: 'Return to previous page', press: () => back() },
      };
      listed().forEach((id, i) => {
        const slot = SLOTS[i];
        if (!slot) return;
        keys[slot] = { label: id, hint: app.pageTitle(id), press: () => goto(id) };
      });
      return keys;
    },
    prompt: () => 'SELECT FORMAT',
  });
}
