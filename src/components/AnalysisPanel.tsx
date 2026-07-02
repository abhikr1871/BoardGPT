import { useEffect, useState } from 'react';
import { Chess } from 'chess.js';
import type { AnalysisResult, Settings } from '../types';
import { analyze } from '../engine/analysis';
import { explainMoves } from '../engine/claude';
import { loadSettings } from '../lib/storage';
import { MoveCard } from './MoveCard';
import { EvalBar } from './EvalBar';
import { bandForCp } from '../lib/evaluation';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** Core analysis UI reused by the overlay and the popup. */
export function AnalysisPanel({ compact = false }: { compact?: boolean }) {
  const [fen, setFen] = useState(START_FEN);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    loadSettings().then(setSettings);
  }, []);

  async function runAnalysis(inputFen: string) {
    setError(null);
    // Validate FEN with chess.js before running the engine.
    try {
      new Chess(inputFen);
    } catch {
      setError('Invalid FEN — please check the position string.');
      return;
    }
    setLoading(true);
    try {
      const s = settings ?? (await loadSettings());
      const res = await analyze(inputFen, s.depth, s.movesShown);
      const moves = await explainMoves(inputFen, res.moves, '', s);
      setResult({ ...res, moves });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const whiteCp = result ? Math.round(result.evaluation * 100) : 0;
  const band = bandForCp(whiteCp);

  return (
    <div className="text-gray-100">
      <div className="flex gap-2 mb-3">
        <input
          className="flex-1 rounded bg-gray-900 border border-gray-700 px-2 py-1.5 text-xs font-mono outline-none focus:border-accent"
          value={fen}
          spellCheck={false}
          onChange={(e) => setFen(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && runAnalysis(fen)}
          placeholder="Paste a FEN position…"
        />
        <button
          className="rounded bg-accent px-3 py-1.5 text-xs font-semibold text-black hover:brightness-110 disabled:opacity-50"
          disabled={loading}
          onClick={() => runAnalysis(fen)}
        >
          {loading ? '…' : 'Analyze'}
        </button>
      </div>

      <div className="flex gap-2 mb-3 text-[11px]">
        <button className="text-gray-400 hover:text-accent" onClick={() => setFen(START_FEN)}>
          Reset to start
        </button>
      </div>

      {error && <div className="text-red-400 text-xs mb-2">{error}</div>}

      {result && (
        <div className="flex gap-3">
          {!compact && <EvalBar cp={whiteCp} />}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2 text-xs">
              <span className="text-gray-400">
                {result.turn === 'w' ? 'White' : 'Black'} to move · {result.gamePhase}
              </span>
              <span className="font-semibold" style={{ color: band.color }}>
                {band.label} {result.evaluation >= 0 ? '+' : ''}
                {result.evaluation.toFixed(1)}
              </span>
            </div>
            <div className="space-y-2">
              {result.moves.map((m) => (
                <MoveCard key={m.uci} line={m} turn={result.turn} />
              ))}
            </div>
            <div className="mt-2 text-[10px] text-gray-500">
              engine: {result.engine} · {result.latencyMs} ms
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
