import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';
import './styles.css';
import { App, readMode } from './App';
import { engine } from './app.config';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App engine={engine} mode={readMode(window.location.search)} />
  </StrictMode>,
);
