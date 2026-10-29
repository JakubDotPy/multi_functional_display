import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Engine } from './engine';
import { attachKeyboard, DEFAULT_BINDINGS } from './input/keyboard';
import type { KeyBindings } from './input/keyboard';
import { connectSerial, connectWebSocket } from './input/links';
import type { Link, LinkStatus } from './input/links';
import { describeDisplay, parseLine } from './input/protocol';
import type { InputEvent, MfdState, OsbId, RockerId } from './types';

export interface LinkInfo {
  kind: 'serial' | 'ws' | null;
  status: LinkStatus;
  detail?: string;
  lastLine?: string;
}

interface MfdContextValue {
  engine: Engine;
  state: MfdState;
  send: (e: InputEvent, origin?: string) => void;
  bindings: KeyBindings;
  link: LinkInfo;
  connectSerial: () => void;
  connectWs: (url: string) => void;
  disconnect: () => void;
}

const Ctx = createContext<MfdContextValue | null>(null);

export const TICK_MS = 100;

export interface MfdProviderProps {
  engine: Engine;
  children: ReactNode;
  /** attach the keyboard adapter to window (default true) */
  keyboard?: boolean;
  bindings?: KeyBindings;
  /** run the simulation clock (default true; tests may disable) */
  clock?: boolean;
  initialState?: MfdState;
}

export function MfdProvider({
  engine, children, keyboard = true, bindings = DEFAULT_BINDINGS, clock = true, initialState,
}: MfdProviderProps) {
  const [state, dispatch] = useReducer(engine.reducer, undefined, () => initialState ?? engine.initialState());
  const send = useCallback((event: InputEvent, origin?: string) => dispatch({ type: 'input', event, origin }), []);

  // simulation clock
  useEffect(() => {
    if (!clock || !state.sim.running) return;
    const h = setInterval(() => dispatch({ type: 'tick', dt: TICK_MS / 1000 }), TICK_MS);
    return () => clearInterval(h);
  }, [clock, state.sim.running]);

  // page transitions finish on their own
  useEffect(() => {
    if (!state.transition) return;
    const ms = state.transition.kind === 'cut' ? 0 : state.transition.kind === 'blank' ? 140 : 260;
    const h = setTimeout(() => dispatch({ type: 'transitionDone' }), ms);
    return () => clearTimeout(h);
  }, [state.transition]);

  // keyboard adapter
  useEffect(() => {
    if (!keyboard) return;
    return attachKeyboard(window, (e) => send(e, 'kbd'), bindings);
  }, [keyboard, bindings, send]);

  // hardware link
  const linkRef = useRef<Link | null>(null);
  const [link, setLink] = useState<LinkInfo>({ kind: null, status: 'idle' });
  const handlers = useMemo(
    () => ({
      onEvent: (e: InputEvent) => send(e, linkRef.current?.kind ?? 'link'),
      onStatus: (status: LinkStatus, detail?: string) => setLink((l) => ({ ...l, status, detail })),
      onLine: (line: string) => setLink((l) => ({ ...l, lastLine: line })),
    }),
    [send],
  );
  const disconnect = useCallback(() => {
    linkRef.current?.close();
    linkRef.current = null;
    setLink({ kind: null, status: 'idle' });
  }, []);
  const doSerial = useCallback(async () => {
    disconnect();
    setLink({ kind: 'serial', status: 'connecting' });
    linkRef.current = await connectSerial(handlers);
  }, [disconnect, handlers]);
  const doWs = useCallback(
    (url: string) => {
      disconnect();
      setLink({ kind: 'ws', status: 'connecting' });
      linkRef.current = connectWebSocket(url, handlers);
    },
    [disconnect, handlers],
  );

  // outbound: tell hardware what is on screen (only changed lines)
  const keys = engine.resolveKeys(state);
  const outLines = describeDisplay(state.page, keys);
  const outSig = outLines.join('\n');
  const sentRef = useRef<string[]>([]);
  useEffect(() => {
    if (link.status !== 'open' || !linkRef.current) return;
    const prev = sentRef.current;
    const changed = outLines.filter((l, i) => prev[i] !== l);
    if (changed.length) linkRef.current.send(changed);
    sentRef.current = outLines;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outSig, link.status]);
  useEffect(() => {
    if (link.status !== 'open') sentRef.current = [];
  }, [link.status]);

  // scripting / testbench API on window.mfd
  const stateRef = useRef(state);
  stateRef.current = state;
  useEffect(() => {
    const api = {
      press: (id: OsbId) => send({ type: 'osb', id }, 'api'),
      rocker: (id: RockerId, dir: 1 | -1) => send({ type: 'rocker', id, dir }, 'api'),
      goto: (page: string) => send({ type: 'page', page }, 'api'),
      line: (l: string) => {
        const e = parseLine(l);
        if (e) send(e, 'api');
        return e;
      },
      data: (source: string, value: unknown) => send({ type: 'data', source, value }, 'api'),
      state: () => stateRef.current,
      keys: () => engine.resolveKeys(stateRef.current),
      pages: () => engine.config.pages.map((p) => p.id),
    };
    (window as any).mfd = api;
    return () => {
      if ((window as any).mfd === api) delete (window as any).mfd;
    };
  }, [engine, send]);

  const value = useMemo(
    () => ({ engine, state, send, bindings, link, connectSerial: doSerial, connectWs: doWs, disconnect }),
    [engine, state, send, bindings, link, doSerial, doWs, disconnect],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMfd(): MfdContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useMfd must be used inside <MfdProvider>');
  return v;
}
