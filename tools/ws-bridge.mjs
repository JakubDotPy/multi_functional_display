#!/usr/bin/env node
/**
 * Minimal WebSocket bridge for the MFD testbench (Node ≥ 18, no dependencies
 * beyond `ws`:  npm i -D ws).
 *
 *   node tools/ws-bridge.mjs            → ws://localhost:8765
 *
 * - Every line you type on stdin is broadcast to connected MFDs
 *   (try:  OSB 14   ·   RKR BRT -   ·   DATA farm {"online":12}).
 * - Every line the MFD sends (PAGE / LBL / LED) is printed.
 * - Other programs can connect as clients too: anything one client sends is
 *   relayed to all the others, so a project script can push DATA lines and a
 *   hardware board can listen for LED lines.
 */
import { createInterface } from 'node:readline';
import { WebSocketServer } from 'ws';

const port = Number(process.env.PORT ?? 8765);
const wss = new WebSocketServer({ port });
const broadcast = (msg, except) => {
  for (const c of wss.clients) if (c !== except && c.readyState === 1) c.send(msg);
};

wss.on('connection', (ws, req) => {
  console.log(`+ client ${req.socket.remoteAddress}`);
  ws.on('message', (data) => {
    const text = data.toString();
    for (const line of text.split('\n')) if (line.trim() && !line.startsWith('LBL') && !line.startsWith('LED')) console.log(`< ${line}`);
    broadcast(text, ws);
  });
  ws.on('close', () => console.log('- client'));
});

createInterface({ input: process.stdin }).on('line', (line) => {
  if (line.trim()) broadcast(`${line.trim()}\n`);
});

console.log(`MFD bridge on ws://localhost:${port} — type protocol lines, e.g. "OSB 6"`);
