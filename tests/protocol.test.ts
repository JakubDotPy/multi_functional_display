import { describe, expect, it } from 'vitest';
import { lineSplitter } from '../src/core/input/links';
import { describeDisplay, parseLine } from '../src/core/input/protocol';
import { DEFAULT_BINDINGS } from '../src/core/input/keyboard';

describe('line protocol', () => {
  it('parses inputs', () => {
    expect(parseLine('OSB 6')).toEqual({ type: 'osb', id: 6 });
    expect(parseLine('osb 21')).toBeNull();
    expect(parseLine('RKR brt +')).toEqual({ type: 'rocker', id: 'BRT', dir: 1 });
    expect(parseLine('RKR CON -')).toEqual({ type: 'rocker', id: 'CON', dir: -1 });
    expect(parseLine('PAGE nav')).toEqual({ type: 'page', page: 'NAV' });
    expect(parseLine('SIM HOLD')).toEqual({ type: 'sim', op: 'hold' });
    expect(parseLine('DATA farm {"printers": 12, "ok": true}')).toEqual({
      type: 'data', source: 'farm', value: { printers: 12, ok: true },
    });
    expect(parseLine('DATA temp 21.5')).toEqual({ type: 'data', source: 'temp', value: 21.5 });
    expect(parseLine('CANCEL')).toEqual({ type: 'cancel' });
    expect(parseLine('# comment')).toBeNull();
    expect(parseLine('FOO')).toBeNull();
  });

  it('splits chunked serial input into lines', () => {
    const got: string[] = [];
    const feed = lineSplitter((l) => got.push(l));
    feed('OSB ');
    feed('6\r\nOSB 7\nRKR');
    feed(' BRT +\n');
    expect(got).toEqual(['OSB 6', 'OSB 7', 'RKR BRT +']);
  });

  it('describes the display for hardware LEDs / labels', () => {
    const lines = describeDisplay('NAV', { 6: { label: 'BUG\n▲', active: true } });
    expect(lines[0]).toBe('PAGE NAV');
    expect(lines).toContain('LBL 6 BUG|▲');
    expect(lines).toContain('LED 6 1');
    expect(lines).toContain('LED 7 0');
  });

  it('keyboard bindings cover all 20 OSBs and 8 rocker directions', () => {
    const vals = Object.values(DEFAULT_BINDINGS);
    const osbs = new Set(vals.filter((v) => v.type === 'osb').map((v) => (v as { id: number }).id));
    expect(osbs.size).toBe(20);
    expect(vals.filter((v) => v.type === 'rocker')).toHaveLength(8);
  });
});
