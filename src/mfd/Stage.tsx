import { useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

/** Uniform scale that fits a w × h logical box into a container. */
export function fitScale(containerW: number, containerH: number, w: number, h: number, margin = 0): number {
  const s = Math.min((containerW - margin * 2) / w, (containerH - margin * 2) / h);
  return Number.isFinite(s) && s > 0 ? s : 1;
}

/**
 * Renders children in a fixed logical coordinate box and scales the whole box
 * uniformly to fit the viewport, so geometry, strokes and text stay proportional
 * at any window size and the aspect ratio never changes.
 */
export function Stage({ w, h, margin = 8, children }: { w: number; h: number; margin?: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setScale(fitScale(el.clientWidth, el.clientHeight, w, h, margin));
    update();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
    }
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [w, h, margin]);

  return (
    <div className="stage" ref={ref}>
      <div className="stage-box" style={{ width: w * scale, height: h * scale }}>
        <div className="stage-inner" style={{ width: w, height: h, transform: `scale(${scale})` }} data-scale={scale.toFixed(3)}>
          {children}
        </div>
      </div>
    </div>
  );
}
