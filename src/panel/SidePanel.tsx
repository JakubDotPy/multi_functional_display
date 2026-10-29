import { useState } from 'react';
import { bindingFor } from '../core/input/keyboard';
import { serialSupported } from '../core/input/links';
import { useMfd } from '../core/store';
import { OSB_IDS } from '../core/types';
import { clock } from '../format';

export function SidePanel() {
  const { engine, state, bindings, link, connectSerial, connectWs, disconnect } = useMfd();
  const page = engine.page(state.page);
  const keys = engine.resolveKeys(state);
  const own = engine.pageKeys(state);
  const globalIds = OSB_IDS.filter((id) => keys[id] && !own[id]);
  const [wsUrl, setWsUrl] = useState('ws://localhost:8765');
  const connected = link.status === 'open' || link.status === 'connecting';

  return (
    <aside className="panel" aria-label="Testbench panel">
      <header className="panel-head">
        <span className="panel-kicker">MFD TESTBENCH</span>
        <span className="panel-ident">{engine.config.ident}</span>
      </header>

      <section className="panel-sec" aria-live="polite">
        <h2 className="panel-h">
          <span>{page.label}</span>
          <span className="panel-dim">{page.title}</span>
        </h2>
        {page.description && <p className="panel-desc">{page.description}</p>}
      </section>

      <section className="panel-sec">
        <h3 className="panel-sub">SOFT KEYS</h3>
        <ul className="keylist">
          {OSB_IDS.filter((id) => own[id]).map((id) => {
            const k = keys[id]!;
            const kb = bindingFor(bindings, (e) => e.type === 'osb' && e.id === id);
            return (
              <li key={id} className={k.disabled ? 'is-off' : k.active ? 'is-on' : undefined}>
                <span className="kl-id">{String(id).padStart(2, '0')}</span>
                <span className="kl-kb">{kb ?? ''}</span>
                <span className="kl-label">{k.label.replace('\n', ' ')}</span>
                <span className="kl-hint">{k.hint ?? ''}</span>
              </li>
            );
          })}
          {globalIds.length > 0 && (
            <li className="kl-global">
              <span className="kl-id">{String(Math.min(...globalIds)).padStart(2, '0')}+</span>
              <span className="kl-kb" />
              <span className="kl-hint">
                {globalIds
                  .slice()
                  .sort((a, b) => b - a)
                  .map((id) => (
                    <span key={id} className={keys[id]!.active ? 'kl-gon' : undefined}>
                      {keys[id]!.label}
                    </span>
                  ))}
              </span>
            </li>
          )}
        </ul>
      </section>

      <section className="panel-sec">
        <h3 className="panel-sub">
          HARDWARE LINK <span className={`dot dot-${link.status}`} aria-hidden="true" />
          <span className="panel-dim">{link.kind ? `${link.kind.toUpperCase()} ${link.status.toUpperCase()}` : 'NONE'}</span>
        </h3>
        <div className="link-row">
          {connected ? (
            <button type="button" className="pbtn" onClick={disconnect}>DISCONNECT</button>
          ) : (
            <>
              <button
                type="button"
                className="pbtn"
                onClick={connectSerial}
                disabled={!serialSupported()}
                title={serialSupported() ? 'Connect a microcontroller over USB serial' : 'WebSerial needs Chrome or Edge'}
              >
                USB SERIAL
              </button>
              <button type="button" className="pbtn" onClick={() => connectWs(wsUrl)}>WS</button>
            </>
          )}
        </div>
        {!connected && (
          <label className="ws-field">
            <span className="sr-only">WebSocket URL</span>
            <input value={wsUrl} onChange={(e) => setWsUrl(e.target.value)} spellCheck={false} />
          </label>
        )}
        {(link.detail || link.lastLine) && (
          <p className="panel-tiny">{link.lastLine ? `RX ${link.lastLine}` : link.detail}</p>
        )}
      </section>

      <section className="panel-sec panel-grow">
        <h3 className="panel-sub">EVENT LOG</h3>
        <ol className="log" aria-live="polite">
          {state.messages.slice(0, 9).map((m) => (
            <li key={m.id}>
              <span className="log-t">{clock(m.t)}</span> {m.text}
            </li>
          ))}
        </ol>
      </section>

      <footer className="panel-help">
        TAB / ⇧TAB keys · ENTER press · 1–0 QWERT ASDFG OSBs · [ ] BRT · ; ' CON · , . SYM · − = GAIN · SPACE sim ·
        ESC cancel
      </footer>
    </aside>
  );
}
