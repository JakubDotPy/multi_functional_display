import { MfdProvider } from './core/store';
import type { Engine } from './core/engine';
import { Bezel } from './mfd/Bezel';
import { Display } from './mfd/Display';
import { STAGE, BEZEL_SIZE } from './mfd/geometry';
import type { StageMode } from './mfd/geometry';
import { Stage } from './mfd/Stage';
import { SidePanel } from './panel/SidePanel';

/**
 * Layout modes (pick with ?mode=…):
 *  full    — bezel + testbench side panel (default, 4:3)
 *  bezel   — bezel only (square)
 *  display — glass only, for a real square LCD behind a physical bezel
 */
export function readMode(search: string): StageMode {
  const m = new URLSearchParams(search).get('mode');
  return m === 'bezel' || m === 'display' ? m : 'full';
}

export function MfdLayout({ mode }: { mode: StageMode }) {
  const { w, h } = STAGE[mode];
  if (mode === 'display') {
    return (
      <Stage w={w} h={h} margin={0}>
        <div className="glass-only">
          <Display />
        </div>
      </Stage>
    );
  }
  return (
    <Stage w={w} h={h}>
      <div className={`layout layout-${mode}`}>
        <div className="layout-bezel" style={{ left: 16, top: 16, width: BEZEL_SIZE, height: BEZEL_SIZE }}>
          <Bezel>
            <Display />
          </Bezel>
        </div>
        {mode === 'full' && (
          <div className="layout-panel" style={{ left: 16 + BEZEL_SIZE + 16, top: 16, width: w - BEZEL_SIZE - 48, height: BEZEL_SIZE }}>
            <SidePanel />
          </div>
        )}
      </div>
    </Stage>
  );
}

export function App({ engine, mode }: { engine: Engine; mode: StageMode }) {
  return (
    <MfdProvider engine={engine}>
      <main className={`app app-${mode}`}>
        <h1 className="sr-only">Multifunction display simulator</h1>
        <MfdLayout mode={mode} />
      </main>
    </MfdProvider>
  );
}
