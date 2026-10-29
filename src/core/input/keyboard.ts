import type { InputEvent, OsbId } from '../types';

/**
 * Keyboard adapter. Bindings use `KeyboardEvent.code` (physical key position),
 * so they work the same on QWERTY, QWERTZ, Czech, etc. — and a microcontroller
 * acting as a USB HID keyboard can drive the app with zero extra software.
 */
export type KeyBindings = Record<string, InputEvent>;

const osb = (id: OsbId): InputEvent => ({ type: 'osb', id });

export const DEFAULT_BINDINGS: KeyBindings = {
  // top row OSB 1–5
  Digit1: osb(1), Digit2: osb(2), Digit3: osb(3), Digit4: osb(4), Digit5: osb(5),
  // right column OSB 6–10 (top → bottom)
  Digit6: osb(6), Digit7: osb(7), Digit8: osb(8), Digit9: osb(9), Digit0: osb(10),
  // bottom row, left → right = OSB 15 … 11
  KeyQ: osb(15), KeyW: osb(14), KeyE: osb(13), KeyR: osb(12), KeyT: osb(11),
  // left column, top → bottom = OSB 20 … 16
  KeyA: osb(20), KeyS: osb(19), KeyD: osb(18), KeyF: osb(17), KeyG: osb(16),
  // rockers
  BracketLeft: { type: 'rocker', id: 'BRT', dir: -1 },
  BracketRight: { type: 'rocker', id: 'BRT', dir: 1 },
  Semicolon: { type: 'rocker', id: 'CON', dir: -1 },
  Quote: { type: 'rocker', id: 'CON', dir: 1 },
  Comma: { type: 'rocker', id: 'SYM', dir: -1 },
  Period: { type: 'rocker', id: 'SYM', dir: 1 },
  Minus: { type: 'rocker', id: 'GAIN', dir: -1 },
  Equal: { type: 'rocker', id: 'GAIN', dir: 1 },
  // misc
  Space: { type: 'sim', op: 'toggle' },
  Escape: { type: 'cancel' },
};

/** human-readable key name for a binding, e.g. 'Digit1' → '1' */
export function keyName(code: string): string {
  const named: Record<string, string> = {
    BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.',
    Minus: '-', Equal: '=', Space: 'Space', Escape: 'Esc',
  };
  if (named[code]) return named[code];
  return code.replace(/^Digit/, '').replace(/^Key/, '');
}

export function bindingFor(bindings: KeyBindings, match: (e: InputEvent) => boolean): string | undefined {
  const code = Object.keys(bindings).find((c) => match(bindings[c]));
  return code ? keyName(code) : undefined;
}

/** Attach to a target; returns a detach function. */
export function attachKeyboard(
  target: Pick<Window, 'addEventListener' | 'removeEventListener'>,
  emit: (e: InputEvent) => void,
  bindings: KeyBindings = DEFAULT_BINDINGS,
): () => void {
  const onKey = (ev: KeyboardEvent) => {
    if (ev.ctrlKey || ev.metaKey || ev.altKey || ev.repeat) return;
    const el = ev.target as HTMLElement | null;
    const tag = el?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable) return;
    // let Space / Enter activate a focused button natively
    if (tag === 'BUTTON' && (ev.code === 'Space' || ev.code === 'Enter')) return;
    const mapped = bindings[ev.code];
    if (!mapped) return;
    ev.preventDefault();
    emit(mapped);
  };
  target.addEventListener('keydown', onKey as EventListener);
  return () => target.removeEventListener('keydown', onKey as EventListener);
}
