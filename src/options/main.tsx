import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DEFAULT_SETTINGS, type Settings } from '../types';
import { loadSettings, saveSettings } from '../lib/storage';
import '../styles/tailwind.css';

function Row({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="flex items-center justify-between gap-4 py-3 border-b border-gray-800">
      <span className="text-sm text-gray-200">
        {label}
        {hint && <span className="block text-[11px] text-gray-500">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function Options() {
  const [s, setS] = useState<Settings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadSettings().then(setS);
  }, []);

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setS((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function persist() {
    await saveSettings(s);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="min-h-screen bg-panel text-gray-100 font-sans">
      <div className="max-w-xl mx-auto p-8">
        <h1 className="text-lg font-bold text-accent mb-6">♟ BoardGPT — Settings</h1>

        <Row label="Analysis depth" hint="10–22 (Stockfish); scaled for the built-in engine">
          <div className="flex items-center gap-2">
            <input
              type="range" min={10} max={22} value={s.depth}
              onChange={(e) => update('depth', Number(e.target.value))}
            />
            <span className="w-6 text-right text-sm">{s.depth}</span>
          </div>
        </Row>

        <Row label="Number of moves shown">
          <select
            className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm"
            value={s.movesShown}
            onChange={(e) => update('movesShown', Number(e.target.value) as 1 | 2 | 3)}
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
          </select>
        </Row>

        <Row label="Explanation verbosity">
          <select
            className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm"
            value={s.verbosity}
            onChange={(e) => update('verbosity', e.target.value as Settings['verbosity'])}
          >
            <option value="brief">Brief</option>
            <option value="detailed">Detailed</option>
            <option value="off">Off</option>
          </select>
        </Row>

        <Row label="Overlay position">
          <select
            className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm"
            value={s.overlayPosition}
            onChange={(e) => update('overlayPosition', e.target.value as Settings['overlayPosition'])}
          >
            <option value="top-left">Top-left</option>
            <option value="top-right">Top-right</option>
            <option value="bottom-left">Bottom-left</option>
            <option value="bottom-right">Bottom-right</option>
          </select>
        </Row>

        <Row label="Auto-hide on opponent's turn">
          <input type="checkbox" checked={s.autoHideOpponentTurn}
            onChange={(e) => update('autoHideOpponentTurn', e.target.checked)} />
        </Row>

        <Row label="Sound alert on blunder">
          <input type="checkbox" checked={s.soundOnBlunder}
            onChange={(e) => update('soundOnBlunder', e.target.checked)} />
        </Row>

        <Row label="Live auto-detect on Chess.com" hint="Watch the board and suggest moves automatically">
          <input type="checkbox" checked={s.liveAutoDetect}
            onChange={(e) => update('liveAutoDetect', e.target.checked)} />
        </Row>

        <Row label="Best-move arrow (green)" hint="Board arrow for the top engine move">
          <input type="checkbox" checked={s.showBestArrow}
            onChange={(e) => update('showBestArrow', e.target.checked)} />
        </Row>

        <Row label="Alternative arrow (blue)" hint="Second-best candidate move">
          <input type="checkbox" checked={s.showAltArrow}
            onChange={(e) => update('showAltArrow', e.target.checked)} />
        </Row>

        <Row label="Opponent-threat arrow (red, dashed)" hint="Their strongest reply if it were their move">
          <input type="checkbox" checked={s.showThreatArrow}
            onChange={(e) => update('showThreatArrow', e.target.checked)} />
        </Row>

        <Row label="Overlay theme">
          <select
            className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm"
            value={s.theme}
            onChange={(e) => update('theme', e.target.value)}
          >
            <option value="midnight">Midnight OLED</option>
            <option value="cyberpunk">Cyberpunk Neon</option>
            <option value="gold">Grandmaster Gold</option>
            <option value="light">Classic Light</option>
          </select>
        </Row>

        <Row label="Compact mini mode" hint="Shrink the overlay to a small floating pill">
          <input type="checkbox" checked={s.miniMode}
            onChange={(e) => update('miniMode', e.target.checked)} />
        </Row>

        <Row label="Blunder-prevention shield" hint="Flash a warning when a hovered move drops your eval">
          <input type="checkbox" checked={s.blunderShield}
            onChange={(e) => update('blunderShield', e.target.checked)} />
        </Row>



        <div className="mt-6 flex items-center gap-3">
          <button
            className="rounded bg-accent px-4 py-2 text-sm font-semibold text-black hover:brightness-110"
            onClick={persist}
          >
            Save settings
          </button>
          {saved && <span className="text-xs text-accent">Saved ✓</span>}
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Options />
  </StrictMode>,
);
