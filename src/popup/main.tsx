import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AnalysisPanel } from '../components/AnalysisPanel';
import '../styles/tailwind.css';

function Popup() {
  return (
    <div className="bg-panel p-4 text-gray-100 font-sans">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-sm font-bold text-accent">♟ BoardGPT</h1>
        <a
          className="text-[11px] text-gray-400 hover:text-accent"
          href={chrome.runtime.getURL('src/options/index.html')}
          target="_blank"
          rel="noreferrer"
        >
          Settings
        </a>
      </div>
      <AnalysisPanel />
      <a
        className="mt-3 block text-center rounded bg-gray-800 hover:bg-gray-700 text-xs py-1.5 text-gray-300"
        href={chrome.runtime.getURL('src/dashboard/index.html')}
        target="_blank"
        rel="noreferrer"
      >
        Open post-game analysis →
      </a>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Popup />
  </StrictMode>,
);
