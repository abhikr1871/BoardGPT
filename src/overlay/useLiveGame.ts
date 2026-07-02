import { useEffect, useRef, useState } from 'react';
import type { AnalysisResult, Settings } from '../types';
import { analyze } from '../engine/analysis';
import { explainMoves } from '../engine/claude';
import { loadSettings } from '../lib/storage';
import {
  findBoard,
  readPlacement,
  readClockTurn,
  readGameResult,
  GameTracker,
  type TrackerUpdate,
} from '../content/chesscomReader';
import {
  findLichessBoard,
  readLichessPlacement,
  readLichessClockTurn,
  readLichessGameResult,
} from '../content/lichessReader';
import {
  findChess24Board,
  readChess24Placement,
  readChess24ClockTurn,
  readChess24GameResult,
} from '../content/chess24Reader';
import { recordGame } from '../lib/games';

export type LiveStatus = 'idle' | 'no-board' | 'watching';

export interface LiveState {
  status: LiveStatus;
  update: TrackerUpdate | null;
  analysis: AnalysisResult | null;
  analyzing: boolean;
  recorded: boolean;
}

// ─── Site detection ────────────────────────────────────────────────────────────
export function getSite(): 'chess.com' | 'lichess' | 'chess24' | 'other' {
  if (typeof location === 'undefined') return 'other';
  const h = location.hostname;
  if (h.endsWith('chess.com')) return 'chess.com';
  if (h.endsWith('lichess.org')) return 'lichess';
  if (h.includes('chess24.com')) return 'chess24';
  return 'other';
}

export function isLiveSite(): boolean {
  return getSite() !== 'other';
}

// ─── Unified board reader ──────────────────────────────────────────────────────
interface SiteReader {
  findBoard: () => Element | null;
  readPlacement: (b: Element | null) => { placement: string; flipped: boolean } | null;
  readClockTurn: () => 'w' | 'b' | null;
  readGameResult: () => string | null;
  source: string;
}

function getReader(): SiteReader {
  const site = getSite();
  if (site === 'lichess') {
    return {
      findBoard: findLichessBoard,
      readPlacement: readLichessPlacement,
      readClockTurn: readLichessClockTurn,
      readGameResult: readLichessGameResult,
      source: 'lichess.org',
    };
  }
  if (site === 'chess24') {
    return {
      findBoard: findChess24Board,
      readPlacement: readChess24Placement,
      readClockTurn: readChess24ClockTurn,
      readGameResult: readChess24GameResult,
      source: 'chess24.com',
    };
  }
  // default: chess.com
  return {
    findBoard,
    readPlacement,
    readClockTurn,
    readGameResult,
    source: 'chess.com',
  };
}

/**
 * Watches the live board on Chess.com / Lichess / Chess24 and keeps `analysis`
 * up to date after every move. Records the game when it ends.
 * Runs only while `enabled`.
 */
export function useLiveGame(enabled: boolean): LiveState {
  const [state, setState] = useState<LiveState>({
    status: 'idle',
    update: null,
    analysis: null,
    analyzing: false,
    recorded: false,
  });

  const trackerRef = useRef(new GameTracker());
  const settingsRef = useRef<Settings | null>(null);
  const debounceRef = useRef<number | null>(null);
  const analyzingRef = useRef(false);
  const finishedRef = useRef(false);

  useEffect(() => {
    if (!enabled || getSite() === 'other') {
      setState((s) => ({ ...s, status: 'idle' }));
      return;
    }

    loadSettings().then((s) => (settingsRef.current = s));
    const reader = getReader();
    let observer: MutationObserver | null = null;
    let pollTimer: number | null = null;

    const handleChange = () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(processPosition, 280);
    };

    const processPosition = async () => {
      const board = reader.findBoard();
      if (!board) {
        setState((s) => (s.status === 'no-board' ? s : { ...s, status: 'no-board' }));
        return;
      }
      const snap = reader.readPlacement(board);
      if (!snap) {
        setState((s) => (s.status === 'no-board' ? s : { ...s, status: 'no-board' }));
        return;
      }

      const upd = trackerRef.current.update(snap, reader.readClockTurn());
      if (upd) {
        setState((s) => ({ ...s, status: 'watching', update: upd }));
        if (!analyzingRef.current) void runAnalysis(upd);
      } else {
        setState((s) => (s.status === 'watching' ? s : { ...s, status: 'watching' }));
      }

      // Game-over detection → record once.
      const result = reader.readGameResult();
      if (result && !finishedRef.current) {
        finishedRef.current = true;
        const pgn = trackerRef.current.currentFen()
          ? buildPgnWithResult(upd?.pgn ?? '', result)
          : '';
        try {
          await recordGame({ pgn, result, source: reader.source });
          setState((s) => (s.recorded ? s : { ...s, recorded: true }));
        } catch (e) {
          console.warn('[BoardGPT] recordGame failed', e);
        }
      }
    };

    const runAnalysis = async (upd: TrackerUpdate) => {
      analyzingRef.current = true;
      setState((s) => ({ ...s, analyzing: true }));
      try {
        const s = settingsRef.current ?? (await loadSettings());
        const res = await analyze(upd.fen, s.depth, s.movesShown);
        const moves = await explainMoves(upd.fen, res.moves, upd.pgn, s);
        setState((prev) => ({ ...prev, analysis: { ...res, moves }, analyzing: false }));
      } catch (e) {
        console.warn('[BoardGPT] live analysis failed', e);
        setState((prev) => ({ ...prev, analyzing: false }));
      } finally {
        analyzingRef.current = false;
      }
    };

    const board = reader.findBoard();
    if (board) {
      observer = new MutationObserver(handleChange);
      observer.observe(board, {
        childList: true,
        subtree: true,
        attributeFilter: ['class', 'style', 'data-fen', 'fen', 'data-position'],
      });
      // Also observe parent for Lichess (cg-board may be replaced)
      const parent = board.parentElement;
      if (parent && parent !== board) {
        observer.observe(parent, { childList: true });
      }
      processPosition();
    } else {
      setState((s) => (s.status === 'no-board' ? s : { ...s, status: 'no-board' }));
    }

    // Poll as safety net for late-mounting boards (especially Lichess SPA navigation)
    pollTimer = window.setInterval(() => {
      const b = reader.findBoard();
      if (b && !observer) {
        observer = new MutationObserver(handleChange);
        observer.observe(b, {
          childList: true,
          subtree: true,
          attributeFilter: ['class', 'style', 'data-fen', 'fen', 'data-position'],
        });
        processPosition();
      } else if (b) {
        // Re-check position even if observer exists (covers data-fen updates)
        processPosition();
      }
    }, 2000);

    return () => {
      observer?.disconnect();
      if (pollTimer) window.clearInterval(pollTimer);
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [enabled]);

  return state;
}

function buildPgnWithResult(pgn: string, result: string): string {
  if (!pgn) return `[Result "${result}"]\n\n${result}`;
  const header = `[Event "Live Game"]\n[Result "${result}"]\n\n`;
  return header + pgn + ` ${result}`;
}
