import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MfdLayout } from '../src/App';
import { engine } from '../src/app.config';
import { MfdProvider } from '../src/core/store';

function setup() {
  return render(
    <MfdProvider engine={engine} clock={false}>
      <MfdLayout mode="full" />
    </MfdProvider>,
  );
}
const svg = (c: HTMLElement) => c.querySelector('svg.display-svg') as SVGSVGElement;
const legends = (c: HTMLElement) => Array.from(c.querySelectorAll('.legend-text')).map((t) => t.textContent);

describe('MFD UI', () => {
  it('renders 20 OSBs and 8 rocker halves as real buttons', () => {
    setup();
    expect(screen.getAllByRole('button', { name: /^OSB \d+/ })).toHaveLength(20);
    expect(screen.getAllByRole('button', { name: /(increase|decrease)$/ })).toHaveLength(8);
  });

  it('clicking a bottom OSB changes page and legends', () => {
    const { container } = setup();
    expect(svg(container).dataset.page).toBe('NAV');
    expect(legends(container)).toContain('DCLT');
    fireEvent.click(screen.getByRole('button', { name: /^OSB 14: FLT/ }));
    expect(svg(container).dataset.page).toBe('FLT');
    expect(legends(container)).toContain('SYNC');
    expect(legends(container)).not.toContain('DCLT');
  });

  it('disabled keys are marked aria-disabled', () => {
    setup();
    const fltKey = screen.getByRole('button', { name: /^OSB 14/ });
    fireEvent.click(fltKey);
    // RST is disabled at T+0
    expect(screen.getByRole('button', { name: /^OSB 5: RST/ })).toHaveAttribute('aria-disabled', 'true');
    // a blank OSB is inert
    expect(screen.getByRole('button', { name: /^OSB 4: no function/ })).toHaveAttribute('aria-disabled', 'true');
  });

  it('keyboard shortcuts drive OSBs (physical key codes)', () => {
    const { container } = setup();
    act(() => {
      fireEvent.keyDown(window, { code: 'KeyE' });
    });
    expect(svg(container).dataset.page).toBe('SYS');
  });

  it('BRT rocker changes the rendered display filter immediately', () => {
    const { container } = setup();
    const before = svg(container).style.filter;
    fireEvent.click(screen.getByRole('button', { name: 'BRT decrease' }));
    expect(svg(container).style.filter).not.toBe(before);
    expect(svg(container).style.filter).toMatch(/brightness\(0\.775\)/);
  });

  it('side panel lists the current page soft keys', () => {
    setup();
    expect(screen.getByRole('complementary', { name: 'Testbench panel' })).toHaveTextContent('HORIZONTAL SITUATION');
  });

  it('exposes a window.mfd scripting API', () => {
    const { container } = setup();
    act(() => {
      (window as any).mfd.line('PAGE DATA');
    });
    expect(svg(container).dataset.page).toBe('DATA');
  });
});
