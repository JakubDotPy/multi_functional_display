# Tactical Avionics MFD — testbench

A browser-based, fighter-style multifunction display: square glass, 20 option-select
buttons (OSBs), four corner rockers (GAIN, SYM, BRT, CON) and a side panel for the testbench.
Pages, button functions and page transitions are declared in plain TypeScript, and the app
takes input from a mouse, the keyboard, USB serial (WebSerial) or a WebSocket. That makes it
usable as the software side of a physical MFD box.

All aircraft data is fictional and deterministic. There are no weapons, targeting or real
aircraft systems, and nothing calls an external service.

## Run

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # vitest: engine, protocol, telemetry, UI
npm run build        # type-check + production build in dist/
npm run preview      # serve the build
npm run bridge       # optional WebSocket bridge on ws://localhost:8765
```

Node 18+ is required. WebSerial needs Chrome or Edge on `localhost` or https.

### Layout modes (`?mode=`)

| URL | Shows | Use |
|---|---|---|
| `/` | bezel + side panel, 4:3 | desk testbench |
| `/?mode=bezel` | bezel only, square | demo / screenshot |
| `/?mode=display` | glass only, square, fills the screen | real LCD behind a physical bezel (Pi + Chromium kiosk) |

All three scale uniformly from a fixed logical canvas (800×600, 600×600 or 440×440), so geometry
and text stay proportional at any size.

## Controls

| Control | Mouse | Keyboard (physical key positions, so it works on any layout) |
|---|---|---|
| OSB 1–5 (top) | click | `1 2 3 4 5` |
| OSB 6–10 (right) | click | `6 7 8 9 0` |
| OSB 15…11 (bottom, left→right) | click | `Q W E R T` |
| OSB 20…16 (left, top→bottom) | click | `A S D F G` |
| BRT ▼/▲ · CON · SYM · GAIN | rocker halves | `[ ]` · `; '` · `, .` · `- =` |
| Simulation run/hold | FLT / CNFG OSB 1 | `Space` |
| Cancel a pending confirm | — | `Esc` |

`Tab` moves through the buttons clockwise and `Enter`/`Space` presses the focused one. Focus is
visible and every button has a descriptive `aria-label`.

Pressing the bottom key of the page you're already on opens the **MENU** (format selection),
which lists every registered page, including ones with no bottom-row slot (FEED, EXMPL).

## Defining pages (the important part)

Everything is set in **`src/app.config.ts`**. A page is one object:

```tsx
import { back, definePage, goto, log, set } from '../core/dsl';

export const pumpPage = definePage({
  id: 'PUMP', label: 'PUMP', title: 'COOLANT PUMP',
  initialState: { on: false, rpm: 1200 },

  // soft keys: called on every render, so legends can depend on state
  keys: ({ state, app }) => ({
    1:  { label: state.on ? 'ON' : 'OFF', active: state.on, hint: 'Toggle pump',
          press: () => set({ on: !state.on }) },
    6:  { label: 'RPM\n▲', press: () => set({ rpm: state.rpm + 100 }) },
    7:  { label: 'RPM\n▼', disabled: state.rpm <= 0, press: () => set({ rpm: state.rpm - 100 }) },
    10: { label: 'NAV', press: () => [log('to NAV'), goto('NAV', 'wipe')] },
    20: { label: 'RTN', press: () => back() },
  }),

  // SVG drawn into the 440×440 glass; keep content inside AREA (x 60–380, y 54–386)
  View: ({ state, app }) => (
    <text x={220} y={220} textAnchor="middle" className="t-hi" fontSize={24}>
      {state.on ? state.rpm : '---'}
    </text>
  ),

  prompt:   ({ state }) => (state.on ? 'PUMP RUNNING' : 'PUMP STOPPED'),
  onEnter:  () => log('pump page'),
  onExit:   () => set({ /* e.g. disarm confirms */ }),
  onCancel: () => null,          // Esc / CANCEL
});
```

Then register it:

```ts
const pages = [navPage, flightPage, /* … */ pumpPage];
globalKeys: navBar(['NAV', 'FLT', 'SYS', 'PUMP', 'CNFG'], { menu: 'MENU' }),
```

`src/pages/_template.tsx` is a copy-ready example with a counter, a two-press confirm, a
transition and a data feed.

### Effects

A `press` handler, like `onEnter`, `onExit` and `onCancel`, never changes state directly. It
returns an effect or an array of effects, and the engine applies them in order. That keeps page
logic pure and easy to test.

| Effect | Does |
|---|---|
| `set(patch, pageId?)` | merge into this page's state (or another page's) |
| `goto(id, transition?)` | open a page; runs `onExit` of the old page and `onEnter` of the new one |
| `back(transition?)` | previous page (history of 20) |
| `settings({...})` / `step('brightness', ±1)` | global display settings |
| `sim('run' \| 'hold' \| 'toggle' \| 'reset')` | simulation clock |
| `log(text)` | side-panel event log |
| `resetDefaults()` | default settings plus every page's initial state |

### Transitions

`'cut'` (instant), `'blank'` (a 140 ms blank frame, like a real display redraw; this is the
default) and `'wipe'` (top-down reveal). Set the default with `defaultTransition` in the config,
or pass one per `goto`.

### Key legend rules

* `label`: `'\n'` makes a two-line legend (the left and right columns have room for two lines).
* `active`: inverse video, for the selected mode or the current page.
* `disabled`: dimmed legend; the press is ignored and the button reports `aria-disabled`.
* An OSB with no entry is blank and does nothing.
* Page keys override `globalKeys` in the same slot.

## Hardware link

A plain-text line protocol, the same over USB serial (115200 baud) and WebSocket:

```
→ to the app                      ← from the app (on every change)
OSB <1-20>                        PAGE <id>
RKR <GAIN|SYM|BRT|CON> <+|->      LBL <1-20> <legend>    ('|' = newline)
PAGE <id>                         LED <1-20> <0|1>        (1 = legend active)
SIM <RUN|HOLD|TOGGLE|RESET>
DATA <source> <json>
CANCEL
```

* **USB serial:** click *USB SERIAL* in the side panel and pick the board.
  `hardware/arduino-mfd-buttons/` has a debounced 7×4 matrix sketch for 20 OSBs and 4 rockers
  that also receives `LED` lines for button backlights.
* **WebSocket:** `npm run bridge`, then click *WS*. Type protocol lines into the bridge terminal,
  or connect your own scripts to it. The bridge relays between all clients.
* **USB HID keyboard:** the default key bindings use physical key codes, so a board that
  emulates a keyboard (QMK, RP2040 TinyUSB…) drives the app with no extra software.
* **Scripting:** the browser console has `window.mfd`:
  `mfd.press(6)`, `mfd.rocker('BRT', -1)`, `mfd.goto('SYS')`, `mfd.line('DATA farm {"ok":3}')`,
  `mfd.state()`, `mfd.keys()`.

### Project data → dashboard pages

`DATA <source> <json>` stores the value in `app.sources[source]`, which every page can read. The
**FEED** page shows any source as a key/value table. Copy it for project-specific dashboards
(printer farm, home lab, CI, …) and have each project push its status line over the bridge.

## Project structure

```
src/
  app.config.ts        ← pages, nav bar, rockers, transitions (edit this)
  core/
    types.ts           PageDef, KeyDef, Effect, InputEvent, MfdState
    dsl.ts             definePage + effect helpers
    engine.ts          pure reducer: inputs → effects → state
    navbar.ts          bottom-row page selector helper
    store.tsx          React provider: clock, transitions, adapters, window.mfd
    input/             keyboard.ts · protocol.ts · links.ts (WebSerial + WebSocket)
  mfd/                 Bezel (OSBs, rockers), Display (glass, legends), Stage (4:3 scaling), geometry
  pages/               nav · flight · systems · data · config · feed · menu · _template
  panel/SidePanel.tsx  testbench panel: page info, key map, link, event log
  sim/                 deterministic telemetry, fictional route and subsystems
tests/                 engine, protocol, telemetry/geometry, UI
hardware/              Arduino button-matrix sketch
tools/ws-bridge.mjs    WebSocket bridge
```

## Visual system

Green monochrome on near-black: `#030704` background, `#55FF77` primary, `#27B84A` secondary,
`#17652B` dim, `#B2FFC0` highlight. The font is IBM Plex Mono, bundled through `@fontsource`,
so it works offline. Text classes are `t-hi t-pri t-sec t-dim t-inv`, strokes `s-pri s-sec s-dim`
and fills `f-pri f-sec`.

The rockers act on the whole display:

* **BRT** sets overall luminance.
* **CON** sets contrast.
* **SYM** sets the intensity of the page graphics relative to the legends.
* **GAIN** sets the map background layer.

The CNFG page also has a phosphor glow toggle and a test pattern (brightness ramp and line-pair
wedge) for checking a real panel. Blinking is limited to HOLD and pending confirmations, and it
stops when the OS asks for reduced motion.
