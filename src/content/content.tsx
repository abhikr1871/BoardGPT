import { createRoot } from 'react-dom/client';
import { StrictMode } from 'react';
import { OverlayApp } from '../overlay/OverlayApp';
import '../styles/tailwind.css';

/**
 * Content script entry. Injects the overlay root into the host page.
 * Runs on Chess.com / Lichess / Chess24 per the manifest matches.
 */
const HOST_ID = 'chessai-overlay-root';

function mount() {
  if (document.getElementById(HOST_ID)) return;
  const host = document.createElement('div');
  host.id = HOST_ID;
  document.body.appendChild(host);
  createRoot(host).render(
    <StrictMode>
      <OverlayApp />
    </StrictMode>,
  );
}

mount();
