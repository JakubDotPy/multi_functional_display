import { definePage, set } from '../core/dsl';
import type { PageViewProps } from '../core/types';
import { AREA, AREA_CX } from '../mfd/geometry';

/**
 * Generic external-data page — the template for project dashboards.
 *
 * Anything pushed in with the line protocol `DATA <source> <json>` (serial,
 * websocket, or `window.mfd.data(...)`) lands in `app.sources[source]`.
 * This page shows the selected source as a key/value table.
 */
export interface FeedState {
  index: number;
}

const ROWS = 15;

function flatten(v: unknown, prefix = '', out: Array<[string, string]> = []): Array<[string, string]> {
  if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) flatten(x, prefix ? `${prefix}.${k}` : k, out);
  } else {
    out.push([prefix || 'VALUE', Array.isArray(v) ? v.join(',') : String(v)]);
  }
  return out;
}

function FeedView({ state: s, app }: PageViewProps<FeedState>) {
  const ids = Object.keys(app.sources);
  if (ids.length === 0) {
    return (
      <g>
        <rect x={AREA.x + 30} y={170} width={AREA.w - 60} height={64} className="frame" />
        <text x={AREA_CX} y={194} textAnchor="middle" fontSize={12} className="t-pri">NO FEED</text>
        <text x={AREA_CX} y={212} textAnchor="middle" fontSize={9} className="t-dim">SEND: DATA demo {'{"temp":21.5}'}</text>
        <text x={AREA_CX} y={225} textAnchor="middle" fontSize={9} className="t-dim">VIA SERIAL · WS · window.mfd</text>
      </g>
    );
  }
  const id = ids[Math.min(s.index, ids.length - 1)];
  const rows = flatten(app.sources[id]).slice(0, ROWS);
  return (
    <g fontSize={10.5}>
      <text x={AREA.x} y={AREA.y + 14} className="t-dim" fontSize={9}>SOURCE</text>
      <text x={AREA.x + 50} y={AREA.y + 14} className="t-hi">{id.toUpperCase()}</text>
      <text x={AREA.x + AREA.w} y={AREA.y + 14} className="t-dim" fontSize={9} textAnchor="end">
        {Math.min(s.index, ids.length - 1) + 1}/{ids.length}
      </text>
      <line x1={AREA.x} x2={AREA.x + AREA.w} y1={AREA.y + 20} y2={AREA.y + 20} className="s-dim" />
      {rows.map(([k, v], i) => (
        <g key={k}>
          <text x={AREA.x + 2} y={AREA.y + 40 + i * 18} className="t-sec">{k.toUpperCase().slice(0, 22)}</text>
          <text x={AREA.x + AREA.w - 2} y={AREA.y + 40 + i * 18} textAnchor="end" className="t-pri">{v.slice(0, 18)}</text>
        </g>
      ))}
    </g>
  );
}

export const feedPage = definePage<FeedState>({
  id: 'FEED',
  label: 'FEED',
  title: 'EXTERNAL FEED',
  description: 'Shows JSON pushed in over the hardware link (DATA <source> <json>). Template for project dashboards.',
  initialState: { index: 0 },
  View: FeedView,
  keys: ({ state: s, app }) => {
    const n = Object.keys(app.sources).length;
    return {
      20: { label: 'SRC\n▲', hint: 'Previous source', disabled: n < 2, press: () => set<FeedState>({ index: (s.index - 1 + n) % n }) },
      19: { label: 'SRC\n▼', hint: 'Next source', disabled: n < 2, press: () => set<FeedState>({ index: (s.index + 1) % n }) },
    };
  },
  prompt: ({ app }) => (Object.keys(app.sources).length ? 'LIVE · LAST VALUE HELD' : 'WAITING FOR DATA'),
});
