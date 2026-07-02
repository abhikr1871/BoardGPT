import { useEffect, useRef, useState } from 'react';
import { AnalysisPanel } from '../components/AnalysisPanel';
import { MoveCard } from '../components/MoveCard';
import { EvalBar } from '../components/EvalBar';
import { CoachAssistant } from '../components/CoachAssistant';
import { loadSettings } from '../lib/storage';
import { bandForCp } from '../lib/evaluation';
import type { Settings } from '../types';
import { useLiveGame, getSite, isLiveSite } from './useLiveGame';
import { drawArrows, clearArrows, type ArrowSpec } from '../content/arrow';
import { OpeningRecommender } from '../components/OpeningRecommender';
import { getOpeningRecommendations } from '../engine/openings';
import { DEFAULT_SETTINGS } from '../types';
import type { AnalysisResult } from '../types';
import { MiniPill } from '../components/MiniPill';
import { SidebarIcons, type SidebarFeature } from '../components/SidebarIcons';
import { getTheme } from '../lib/themes';

interface FeatureFlags {
  arrows: boolean;
  coach: boolean;
  evalBar: boolean;
  openings: boolean;
}

const ARROW_GREEN = 'rgba(34,197,94,0.9)';
const ARROW_BLUE = 'rgba(59,130,246,0.85)';
const ARROW_RED = 'rgba(239,68,68,0.8)';

/** Build the arrow set for a position given the user's toggles. */
function arrowsFor(a: AnalysisResult, s: Settings, hoverUci?: string | null): ArrowSpec[] {
  if (hoverUci) {
    // Hovering a move card: show just that move, bright.
    return [{ uci: hoverUci, color: ARROW_GREEN, widthFactor: 0.18, opacity: 0.95 }];
  }
  const specs: ArrowSpec[] = [];
  if (s.showThreatArrow && a.threat?.uci) {
    specs.push({ uci: a.threat.uci, color: ARROW_RED, widthFactor: 0.1, opacity: 0.45, dashed: true });
  }
  if (s.showAltArrow && a.moves[1]?.uci) {
    specs.push({ uci: a.moves[1].uci, color: ARROW_BLUE, widthFactor: 0.12, opacity: 0.55 });
  }
  if (s.showBestArrow && a.moves[0]?.uci) {
    specs.push({ uci: a.moves[0].uci, color: ARROW_GREEN, widthFactor: 0.16, opacity: 0.85 });
  }
  return specs;
}

const CORNER: Record<Settings['overlayPosition'], React.CSSProperties> = {
  'top-left':     { top: 8, left: 8 },
  'top-right':    { top: 8, right: 8 },
  'bottom-left':  { bottom: 8, left: 8 },
  'bottom-right': { bottom: 8, right: 8 },
};

const isChessCom = () =>
  typeof location !== 'undefined' && location.hostname.endsWith('chess.com');

// Shows Live tab on all supported sites
const showLiveTab = () => isLiveSite();

const MIN_W = 260;
const MAX_W = 560;
const DEFAULT_W = 360;

export function OverlayApp() {
  const [visible, setVisible] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [pos, setPos] = useState<React.CSSProperties>(CORNER['top-right']);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [mode, setMode] = useState<'live' | 'manual'>(isLiveSite() ? 'live' : 'manual');
  const [liveEnabled, setLiveEnabled] = useState(true);
  const [width, setWidth] = useState(DEFAULT_W);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [hoverUci, setHoverUci] = useState<string | null>(null);
  const [miniMode, setMiniMode] = useState(false);
  const [features, setFeatures] = useState<FeatureFlags>({
    arrows: true, coach: true, evalBar: true, openings: true,
  });
  const panelRef = useRef<HTMLDivElement>(null);
  const resizingRef = useRef(false);
  const resizeStartRef = useRef({ x: 0, startW: 0 });

  const live = useLiveGame(mode === 'live' && liveEnabled && visible);

  useEffect(() => {
    loadSettings().then((s) => {
      setSettings(s);
      setPos(CORNER[s.overlayPosition]);
      setLiveEnabled(s.liveAutoDetect);
      setMiniMode(s.miniMode);
      if (isLiveSite() && s.liveAutoDetect) setMode('live');
    });
    const listener = (msg: { type?: string }) => {
      if (msg?.type === 'TOGGLE_OVERLAY') setVisible((v) => !v);
    };
    chrome.runtime?.onMessage?.addListener(listener);
    return () => chrome.runtime?.onMessage?.removeListener(listener);
  }, []);

  // Draw all board arrows (best/alt/threat, or a single hovered move) on update.
  useEffect(() => {
    if (mode === 'live' && features.arrows && live.analysis?.moves?.length) {
      drawArrows(arrowsFor(live.analysis, settings, hoverUci));
    } else {
      clearArrows();
    }
    return () => clearArrows();
  }, [mode, live.analysis, settings, hoverUci, features.arrows]);

  const openOptions = () =>
    chrome.tabs?.create
      ? chrome.tabs.create({ url: chrome.runtime.getURL('src/options/index.html') })
      : window.open(chrome.runtime.getURL('src/options/index.html'));

  const onSidebarToggle = (f: SidebarFeature) => {
    if (f === 'settings') return openOptions();
    if (f === 'arrows') return setFeatures((v) => ({ ...v, arrows: !v.arrows }));
    if (f === 'coach') return setFeatures((v) => ({ ...v, coach: !v.coach }));
    if (f === 'eval') return setFeatures((v) => ({ ...v, evalBar: !v.evalBar }));
    if (f === 'openings') return setFeatures((v) => ({ ...v, openings: !v.openings }));
  };

  // Drag to move panel
  useEffect(() => {
    if (!drag) return;
    const onMove = (e: MouseEvent) =>
      setPos({ top: e.clientY - drag.y, left: e.clientX - drag.x });
    const onUp = () => setDrag(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [drag]);

  // Resize by dragging the left edge
  const onResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = true;
    resizeStartRef.current = { x: e.clientX, startW: width };

    const onMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const delta = resizeStartRef.current.x - ev.clientX;
      const newW = Math.min(MAX_W, Math.max(MIN_W, resizeStartRef.current.startW + delta));
      setWidth(newW);
    };
    const onUp = () => {
      resizingRef.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  if (!visible) return null;

  const a = live.analysis;
  const whiteCp = a ? Math.round(a.evaluation * 100) : 0;
  const band = bandForCp(whiteCp);
  const theme = getTheme(settings.theme);

  // Compact mini-mode: a tiny floating pill + the sidebar icons.
  if (miniMode) {
    return (
      <>
        <MiniPill analysis={a} onExpand={() => setMiniMode(false)} />
        {showLiveTab() && <SidebarIcons onToggle={onSidebarToggle} active={features as any} />}
      </>
    );
  }

  return (
    <div
      ref={panelRef}
      className="fixed z-[2147483647] font-sans"
      style={{ ...pos, width }}
    >
      {showLiveTab() && <SidebarIcons onToggle={onSidebarToggle} active={features as any} />}
      {/* Left resize handle */}
      <div
        onMouseDown={onResizeMouseDown}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 6,
          cursor: 'ew-resize',
          zIndex: 10,
          borderRadius: '8px 0 0 8px',
          background: 'rgba(34,197,94,0.15)',
          transition: 'background 0.2s',
        }}
        title="Drag to resize"
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(34,197,94,0.45)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(34,197,94,0.15)')}
      />

      {/* Main panel */}
      <div
        style={{
          marginLeft: 6,
          borderRadius: 14,
          overflow: 'hidden',
          boxShadow: `0 8px 40px rgba(0,0,0,0.7), 0 0 0 1px ${theme.accent}30`,
          background: theme.panelBg,
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        {/* ── Header ── */}
        <div
          className="flex items-center justify-between px-3 py-2 cursor-move select-none"
          style={{
            background: 'linear-gradient(90deg, #0d2318 0%, #111f2e 100%)',
            borderBottom: '1px solid rgba(34,197,94,0.2)',
          }}
          onMouseDown={(e) => {
            const rect = panelRef.current!.getBoundingClientRect();
            setDrag({ x: e.clientX - rect.left, y: e.clientY - rect.top });
          }}
        >
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 15 }}>♟</span>
            <span
              style={{
                fontWeight: 800,
                fontSize: 13,
                letterSpacing: '0.04em',
                background: 'linear-gradient(90deg, #22c55e, #4ade80)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              BoardGPT
            </span>
          </div>

          <div className="flex items-center gap-1">
            {/* Size indicator + reset */}
            <span
              title="Reset size"
              onClick={() => setWidth(DEFAULT_W)}
              style={{
                fontSize: 10,
                color: '#4b5563',
                cursor: 'pointer',
                padding: '2px 5px',
                borderRadius: 4,
                border: '1px solid #1f2937',
                userSelect: 'none',
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = '#22c55e')}
              onMouseLeave={e => (e.currentTarget.style.color = '#4b5563')}
            >
              {width}px ↺
            </span>

            <button
              title="Mini mode"
              onClick={() => setMiniMode(true)}
              style={{
                background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer',
                fontSize: 13, padding: '2px 5px', borderRadius: 4, lineHeight: 1,
              }}
              onMouseEnter={e => (e.currentTarget.style.color = '#22c55e')}
              onMouseLeave={e => (e.currentTarget.style.color = '#6b7280')}
            >
              ▬
            </button>

            <button
              title={collapsed ? 'Expand' : 'Collapse'}
              onClick={() => setCollapsed((c) => !c)}
              style={{
                background: 'none',
                border: 'none',
                color: '#6b7280',
                cursor: 'pointer',
                fontSize: 13,
                padding: '2px 5px',
                borderRadius: 4,
                lineHeight: 1,
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = '#22c55e')}
              onMouseLeave={e => (e.currentTarget.style.color = '#6b7280')}
            >
              {collapsed ? '▢' : '—'}
            </button>

            <button
              title="Hide (Alt+C)"
              onClick={() => setVisible(false)}
              style={{
                background: 'none',
                border: 'none',
                color: '#6b7280',
                cursor: 'pointer',
                fontSize: 13,
                padding: '2px 5px',
                borderRadius: 4,
                lineHeight: 1,
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
              onMouseLeave={e => (e.currentTarget.style.color = '#6b7280')}
            >
              ✕
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        {!collapsed && (
          <div
            className="chessai-scroll overflow-y-auto"
            style={{ padding: '10px 12px 12px', maxHeight: '92vh', overflowY: 'auto' }}
          >
            {/* Mode switcher (all supported live sites) */}
            {showLiveTab() && (
              <div
                style={{
                  display: 'flex',
                  marginBottom: 10,
                  borderRadius: 8,
                  background: '#0d1520',
                  padding: 3,
                  border: '1px solid #1f2937',
                  gap: 3,
                }}
              >
                {(['live', 'manual'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    style={{
                      flex: 1,
                      borderRadius: 6,
                      padding: '5px 0',
                      fontSize: 11,
                      fontWeight: mode === m ? 700 : 400,
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.18s',
                      background: mode === m
                        ? 'linear-gradient(90deg,#16a34a,#22c55e)'
                        : 'transparent',
                      color: mode === m ? '#000' : '#6b7280',
                      boxShadow: mode === m ? '0 2px 8px rgba(34,197,94,0.3)' : 'none',
                    }}
                  >
                    {m === 'live' ? `⚡ Live (${getSite()})` : '✏ Manual FEN'}
                  </button>
                ))}
              </div>
            )}

            {mode === 'manual' && <AnalysisPanel />}

            {mode === 'live' && (
              <LiveView
                status={live.status}
                analyzing={live.analyzing}
                band={band}
                a={a}
                recorded={live.recorded}
                lastMove={live.update?.lastMoveSan ?? null}
                turn={live.update?.turn ?? null}
                whiteCp={whiteCp}
                fen={live.update?.fen ?? null}
                site={getSite()}
                onHoverMove={setHoverUci}
                features={features}
              />
            )}

            {/* Dashboard button */}
            <button
              style={{
                marginTop: 12,
                width: '100%',
                borderRadius: 8,
                padding: '8px 0',
                fontSize: 11,
                fontWeight: 600,
                border: '1px solid #1f2937',
                background: 'linear-gradient(90deg,#0d1520,#111827)',
                color: '#9ca3af',
                cursor: 'pointer',
                letterSpacing: '0.02em',
                transition: 'all 0.18s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = '#22c55e';
                (e.currentTarget as HTMLButtonElement).style.color = '#22c55e';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = '#1f2937';
                (e.currentTarget as HTMLButtonElement).style.color = '#9ca3af';
              }}
              onClick={() =>
                chrome.tabs?.create
                  ? chrome.tabs.create({ url: chrome.runtime.getURL('src/dashboard/index.html') })
                  : window.open(chrome.runtime.getURL('src/dashboard/index.html'))
              }
            >
              📊 Open post-game analysis →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function LiveView({
  status,
  analyzing,
  band,
  a,
  recorded,
  lastMove,
  turn,
  whiteCp,
  fen,
  site,
  onHoverMove,
  features,
}: {
  status: ReturnType<typeof useLiveGame>['status'];
  analyzing: boolean;
  band: { label: string; color: string };
  a: ReturnType<typeof useLiveGame>['analysis'];
  recorded: boolean;
  lastMove: string | null;
  turn: 'w' | 'b' | null;
  whiteCp: number;
  fen?: string | null;
  site?: string;
  onHoverMove?: (uci: string | null) => void;
  features?: FeatureFlags;
}) {
  const show = features ?? { arrows: true, coach: true, evalBar: true, openings: true };
  const siteLabel = site && site !== 'other' ? site : 'chess';
  if (status === 'no-board' || status === 'idle') {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '24px 8px',
          color: '#6b7280',
          fontSize: 12,
        }}
      >
        <div style={{ fontSize: 28, marginBottom: 8 }}>👀</div>
        <div style={{ fontWeight: 600, color: '#9ca3af', marginBottom: 4 }}>
          Looking for your {siteLabel} board…
        </div>
        <div style={{ fontSize: 11, lineHeight: 1.5 }}>
          Open or start a game on Chess.com, Lichess, or Chess24. BoardGPT watches the board and suggests moves automatically.
        </div>
      </div>
    );
  }

  const openingRec = fen ? getOpeningRecommendations(fen) : null;

  return (
    <div>
      {/* Status bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
          padding: '5px 8px',
          borderRadius: 7,
          background: '#0d1520',
          border: '1px solid #1f2937',
          fontSize: 11,
        }}
      >
        <span style={{ color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 5 }}>
          <span
            style={{
              display: 'inline-block',
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: '#22c55e',
              animation: 'pulse 1.5s infinite',
            }}
          />
          Watching · {turn === 'w' ? '⬜ White' : turn === 'b' ? '⬛ Black' : '—'} to move
        </span>
        {a && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                padding: '2px 5px',
                borderRadius: 4,
                background: a.engine === 'stockfish' ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)',
                color: a.engine === 'stockfish' ? '#4ade80' : '#fbbf24',
                border: `1px solid ${a.engine === 'stockfish' ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.3)'}`,
              }}
              title={a.engine === 'stockfish' ? 'Stockfish 16 WASM active' : 'Fallback JS engine active'}
            >
              {a.engine === 'stockfish' ? '⚡ Stockfish 16' : '⚠️ Backup JS'}
            </span>
            <span style={{ fontWeight: 700, color: band.color, fontSize: 12 }}>
              {band.label} {a.evaluation >= 0 ? '+' : ''}
              {a.evaluation.toFixed(1)}
            </span>
          </div>
        )}
      </div>

      {lastMove && (
        <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 8 }}>
          Last move:{' '}
          <span style={{ fontFamily: 'monospace', color: '#d1d5db', fontWeight: 600 }}>
            {lastMove}
          </span>
        </div>
      )}

      {show.openings && openingRec && <OpeningRecommender recommender={openingRec} />}

      {analyzing && !a && (
        <div style={{ textAlign: 'center', padding: '16px 0', color: '#6b7280', fontSize: 12 }}>
          <span style={{ animation: 'pulse 1s infinite' }}>⚙ Analyzing…</span>
        </div>
      )}

      {a && (
        <div style={{ display: 'flex', gap: 10 }}>
          {show.evalBar && <EvalBar cp={whiteCp} />}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {a.moves.map((m) => (
              <div
                key={m.uci}
                onMouseEnter={() => onHoverMove?.(m.uci)}
                onMouseLeave={() => onHoverMove?.(null)}
              >
                <MoveCard line={m} turn={a.turn} />
              </div>
            ))}
            <div style={{ fontSize: 10, color: '#4b5563', marginTop: 2 }}>
              engine: {a.engine} · {a.latencyMs} ms{analyzing ? ' · updating…' : ''}
            </div>
          </div>
        </div>
      )}

      {/* AI Coach Assistant */}
      {a && show.coach && (
        <CoachAssistant
          analysis={a}
          lastMove={lastMove}
          turn={turn}
          analyzing={analyzing}
        />
      )}

      {recorded && (
        <div
          style={{
            marginTop: 10,
            padding: '6px 10px',
            borderRadius: 7,
            background: 'rgba(34,197,94,0.1)',
            border: '1px solid rgba(34,197,94,0.3)',
            fontSize: 11,
            color: '#22c55e',
          }}
        >
          ✓ Game finished — recorded for post-game analysis.
        </div>
      )}
    </div>
  );
}
