/**
 * Hardware links. Both speak the line protocol in ./protocol.ts.
 *
 *  - WebSerial: plug a microcontroller in over USB (Chrome / Edge, https or localhost).
 *  - WebSocket: a small bridge process (Python, Node, ESP32…) on the network.
 */
import type { InputEvent } from '../types';
import { parseLine } from './protocol';

export type LinkStatus = 'idle' | 'connecting' | 'open' | 'closed' | 'error';

export interface LinkHandlers {
  onEvent: (e: InputEvent) => void;
  onStatus: (s: LinkStatus, detail?: string) => void;
  /** raw inbound line, for the testbench console */
  onLine?: (line: string) => void;
}

export interface Link {
  kind: 'serial' | 'ws';
  send: (lines: string[]) => void;
  close: () => void;
}

/** Splits an arbitrary chunk stream into lines. */
export function lineSplitter(onLine: (l: string) => void) {
  let buf = '';
  return (chunk: string) => {
    buf += chunk;
    let i: number;
    while ((i = buf.search(/\r?\n/)) >= 0) {
      onLine(buf.slice(0, i));
      buf = buf.slice(buf[i] === '\r' ? i + 2 : i + 1);
    }
    if (buf.length > 4096) buf = '';
  };
}

function handleLine(h: LinkHandlers) {
  return (line: string) => {
    if (!line.trim()) return;
    h.onLine?.(line);
    const ev = parseLine(line);
    if (ev) h.onEvent(ev);
  };
}

export const serialSupported = () => typeof navigator !== 'undefined' && 'serial' in navigator;

export async function connectSerial(h: LinkHandlers, baudRate = 115200): Promise<Link | null> {
  if (!serialSupported()) {
    h.onStatus('error', 'WebSerial not supported in this browser');
    return null;
  }
  h.onStatus('connecting');
  let port: any;
  try {
    port = await (navigator as any).serial.requestPort();
    await port.open({ baudRate });
  } catch (err) {
    h.onStatus('error', (err as Error).message);
    return null;
  }
  h.onStatus('open', `${baudRate} baud`);
  const decoder = new TextDecoderStream();
  const readableClosed = port.readable.pipeTo(decoder.writable).catch(() => undefined);
  const reader = decoder.readable.getReader();
  const encoder = new TextEncoder();
  const split = lineSplitter(handleLine(h));
  let open = true;

  (async () => {
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) split(value);
      }
    } catch (err) {
      if (open) h.onStatus('error', (err as Error).message);
    }
  })();

  return {
    kind: 'serial',
    send: (lines) => {
      if (!open || !port.writable) return;
      const w = port.writable.getWriter();
      w.write(encoder.encode(lines.join('\n') + '\n')).finally(() => w.releaseLock());
    },
    close: async () => {
      open = false;
      try {
        await reader.cancel();
        await readableClosed;
        await port.close();
      } catch {
        /* ignore */
      }
      h.onStatus('closed');
    },
  } as Link;
}

export function connectWebSocket(url: string, h: LinkHandlers): Link {
  h.onStatus('connecting', url);
  const ws = new WebSocket(url);
  const split = lineSplitter(handleLine(h));
  ws.onopen = () => h.onStatus('open', url);
  ws.onmessage = (m) => split(String(m.data).endsWith('\n') ? String(m.data) : `${m.data}\n`);
  ws.onerror = () => h.onStatus('error', `cannot reach ${url}`);
  ws.onclose = () => h.onStatus('closed');
  return {
    kind: 'ws',
    send: (lines) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(lines.join('\n') + '\n');
    },
    close: () => ws.close(),
  };
}
