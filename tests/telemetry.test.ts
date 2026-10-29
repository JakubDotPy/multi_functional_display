import { describe, expect, it } from 'vitest';
import { fitScale } from '../src/mfd/Stage';
import { STAGE } from '../src/mfd/geometry';
import { osbCenter, osbSide } from '../src/mfd/geometry';
import { telemetry, telemetryHistory } from '../src/sim/telemetry';
import type { OsbId } from '../src/core/types';

describe('deterministic telemetry', () => {
  it('is a pure function of time', () => {
    expect(telemetry(123.4)).toEqual(telemetry(123.4));
    expect(telemetry(10).alt).not.toBe(telemetry(20).alt);
  });

  it('stays in plausible fictional ranges', () => {
    for (let t = 0; t < 3600; t += 37) {
      const v = telemetry(t);
      expect(v.ias).toBeGreaterThan(300);
      expect(v.ias).toBeLessThan(380);
      expect(v.alt).toBeGreaterThan(16000);
      expect(v.alt).toBeLessThan(20000);
      expect(v.hdg).toBeGreaterThanOrEqual(0);
      expect(v.hdg).toBeLessThan(360);
    }
  });

  it('history samples every 5 s, newest first, empty before the first sample', () => {
    expect(telemetryHistory(4.9)).toHaveLength(0);
    const h = telemetryHistory(27);
    expect(h.map((x) => x.t)).toEqual([25, 20, 15, 10, 5]);
  });
});

describe('layout geometry', () => {
  it('full layout is 4:3 and scales uniformly', () => {
    expect(STAGE.full.w / STAGE.full.h).toBeCloseTo(4 / 3);
    expect(fitScale(1600, 1200, 800, 600)).toBe(2);
    expect(fitScale(1600, 600, 800, 600)).toBe(1); // height-limited
    expect(fitScale(400, 900, 800, 600)).toBe(0.5); // width-limited
  });

  it('places five OSBs per edge, numbered clockwise', () => {
    const sides = { top: 0, right: 0, bottom: 0, left: 0 };
    for (let i = 1; i <= 20; i++) sides[osbSide(i as OsbId)]++;
    expect(sides).toEqual({ top: 5, right: 5, bottom: 5, left: 5 });
    expect(osbCenter(1).x).toBeLessThan(osbCenter(5).x);
    expect(osbCenter(6).y).toBeLessThan(osbCenter(10).y);
    expect(osbCenter(11).x).toBeGreaterThan(osbCenter(15).x);
    expect(osbCenter(16).y).toBeGreaterThan(osbCenter(20).y);
  });
});
