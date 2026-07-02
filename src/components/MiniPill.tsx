import { useEffect, useRef, useState } from 'react';
import type { AnalysisResult } from '../types';

/**
 * Compact, draggable floating pill (Phase 4 mini-mode). Shows a colour swatch
 * for the current evaluation, the eval number, the best move SAN and an engine
 * badge. Clicking anywhere on the pill expands back to the full overlay.
 *
 * Kept intentionally small (~120px) and glassmorphic so it can sit unobtrusively
 * on top of a live board.
 */

interface Props {
  analysis: AnalysisResult | null;
  onExpand: () => void;
}

/** Map a white-POV centipawn score to a swatch colour (green ↔ red). */
function cpToColor(cp: number): string {
  if (cp >= 300) return '#22c55e';
  if (cp >= 100) return '#86efac';
  if (cp >= 25) return '#60a5fa';
  if (cp >= -25) return '#e5e7eb';
  if (cp >= -100) return '#facc15';
  if (cp >= -300) return '#fb923c';
  return '#ef4444';
}

/** Format the pawn evaluation for the pill, e.g. "+1.8" or "M3". */
function formatPillEval(a: AnalysisResult): string {
  const best = a.moves[0];
  if (best && best.mate !== null) return `M${Math.abs(best.mate)}`;
  const v = a.evaluation;
  return (v >= 0 ? '+' : '') + v.toFixed(1);
}

export function MiniPill({ analysis, onExpand }: Props) {
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 12, left: 12 });
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const movedRef = useRef(false);
  const pillRef = useRef<HTMLDivElement>(null);

  // Drag to reposition; suppress the click-to-expand when a real drag happened.
  useEffect(() => {
    if (!drag) return;
    const onMove = (e: MouseEvent) => {
      movedRef.current = true;
      setPos({ top: e.clientY - drag.y, left: e.clientX - drag.x });
    };
    const onUp = () => setDrag(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [drag]);

  const whiteCp = analysis ? Math.round(analysis.evaluation * 100) : 0;
  const swatch = cpToColor(whiteCp);
  const best = analysis?.moves[0];
  const isStockfish = analysis?.engine === 'stockfish';

  return (
    <div
      ref={pillRef}
      onMouseDown={(e) => {
        movedRef.current = false;
        const rect = pillRef.current!.getBoundingClientRect();
        setDrag({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }}
      onClick={() => {
        if (!movedRef.current) onExpand();
      }}
      title="Click to expand · drag to move"
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        zIndex: 2147483647,
        width: 120,
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        padding: '6px 9px',
        borderRadius: 20,
        cursor: 'pointer',
        userSelect: 'none',
        fontFamily: 'sans-serif',
        background: 'linear-gradient(135deg, rgba(15,25,35,0.85) 0%, rgba(17,24,39,0.85) 100%)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 6px 24px rgba(0,0,0,0.55), 0 0 0 1px rgba(34,197,94,0.12)',
      }}
    >
      {/* Eval swatch */}
      <span
        style={{
          flex: '0 0 auto',
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: swatch,
          boxShadow: `0 0 8px ${swatch}`,
        }}
      />

      {/* Eval number */}
      <span
        style={{
          fontFamily: 'monospace',
          fontSize: 12,
          fontWeight: 700,
          color: swatch,
          minWidth: 30,
        }}
      >
        {analysis ? formatPillEval(analysis) : '—'}
      </span>

      {/* Best move SAN */}
      <span
        style={{
          flex: 1,
          fontFamily: 'monospace',
          fontSize: 13,
          fontWeight: 800,
          color: '#4ade80',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          letterSpacing: '0.02em',
        }}
      >
        {best ? best.san : '…'}
      </span>

      {/* Engine badge */}
      <span
        title={isStockfish ? 'Stockfish 16 active' : 'Backup JS engine active'}
        style={{ flex: '0 0 auto', fontSize: 11, lineHeight: 1 }}
      >
        {isStockfish ? '⚡' : '⚠️'}
      </span>
    </div>
  );
}
