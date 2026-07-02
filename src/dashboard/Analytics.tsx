import { useEffect, useMemo, useState } from 'react';
import { reviewGame } from '../engine/postgame';
import { listGames, type StoredGame } from '../lib/games';
import { listMistakes, type Mistake } from '../lib/mistakeDB';
import type { GameReview } from '../types';

/**
 * Performance analytics (Phase 3). Re-reviews the most recent games locally and
 * summarises results, accuracy, blunder rate and a per-game accuracy trend as a
 * dependency-free inline SVG chart. Also surfaces the player's most common
 * mistake themes from the spaced-repetition store.
 */

const ACCENT = '#22c55e';
const PANEL = '#0f172a';
const PANEL_ALT = '#111827';
const BORDER = '#1f2937';
const TEXT = '#e5e7eb';
const MUTED = '#9ca3af';

const MAX_GAMES = 20;

const THEME_LABELS: Record<string, string> = {
  'hanging-piece': 'Hanging pieces',
  tactics: 'Tactics',
};

function themeLabel(theme: string): string {
  return THEME_LABELS[theme] ?? theme;
}

interface ReviewedGame {
  game: StoredGame;
  review: GameReview;
  /** Player accuracy — averaged across both sides (color-agnostic history). */
  accuracy: number;
  blunders: number;
  outcome: 'W' | 'L' | 'D' | '?';
}

/** Classify a stored result string from the player's perspective (white default). */
function outcomeFromResult(result: string): 'W' | 'L' | 'D' | '?' {
  const r = result.trim();
  if (r === '1-0') return 'W';
  if (r === '0-1') return 'L';
  if (r === '1/2-1/2' || r === '½-½') return 'D';
  return '?';
}

const card: React.CSSProperties = {
  background: PANEL_ALT,
  border: `1px solid ${BORDER}`,
  borderRadius: 10,
  padding: 16,
};

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={card}>
      <div style={{ fontSize: 11, color: MUTED }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: color ?? TEXT, marginTop: 2 }}>{value}</div>
    </div>
  );
}

/** Inline SVG line+bar chart of accuracy across recent games (oldest → newest). */
function AccuracyTrend({ data }: { data: ReviewedGame[] }) {
  const w = 640;
  const h = 160;
  const pad = 24;
  const series = [...data].reverse(); // chronological
  if (series.length === 0) {
    return <div style={{ fontSize: 12, color: MUTED }}>No games to chart yet.</div>;
  }
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;
  const barW = Math.max(2, (innerW / series.length) * 0.5);

  const x = (i: number) =>
    series.length === 1 ? pad + innerW / 2 : pad + (i / (series.length - 1)) * innerW;
  const y = (acc: number) => pad + (1 - Math.max(0, Math.min(100, acc)) / 100) * innerH;

  const points = series.map((g, i) => `${x(i).toFixed(1)},${y(g.accuracy).toFixed(1)}`).join(' ');

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      style={{ width: '100%', height: 160, background: PANEL, borderRadius: 8, border: `1px solid ${BORDER}` }}
    >
      {/* gridlines at 50% and 75% */}
      {[50, 75].map((g) => (
        <g key={g}>
          <line x1={pad} y1={y(g)} x2={w - pad} y2={y(g)} stroke={BORDER} strokeDasharray="4 4" />
          <text x={4} y={y(g) + 3} fill={MUTED} fontSize={9}>
            {g}
          </text>
        </g>
      ))}
      {/* bars */}
      {series.map((g, i) => (
        <rect
          key={g.game.id}
          x={x(i) - barW / 2}
          y={y(g.accuracy)}
          width={barW}
          height={h - pad - y(g.accuracy)}
          fill="rgba(34,197,94,0.18)"
        />
      ))}
      {/* trend line */}
      <polyline points={points} fill="none" stroke={ACCENT} strokeWidth={2} />
      {series.map((g, i) => (
        <circle key={`${g.game.id}-pt`} cx={x(i)} cy={y(g.accuracy)} r={2.5} fill={ACCENT} />
      ))}
    </svg>
  );
}

export function Analytics() {
  const [reviewed, setReviewed] = useState<ReviewedGame[]>([]);
  const [totalGames, setTotalGames] = useState(0);
  const [mistakes, setMistakes] = useState<Mistake[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [games, allMistakes] = await Promise.all([
        listGames().catch(() => [] as StoredGame[]),
        listMistakes().catch(() => [] as Mistake[]),
      ]);
      const recent = games.slice(0, MAX_GAMES);
      const results: ReviewedGame[] = [];
      for (const game of recent) {
        try {
          const review = reviewGame(game.pgn);
          const accuracy = (review.accuracy.white + review.accuracy.black) / 2;
          const blunders = review.moves.filter((m) => m.quality === 'blunder').length;
          results.push({
            game,
            review,
            accuracy: Math.round(accuracy * 10) / 10,
            blunders,
            outcome: outcomeFromResult(game.result),
          });
        } catch {
          /* skip unparseable games */
        }
      }
      if (!cancelled) {
        setReviewed(results);
        setTotalGames(games.length);
        setMistakes(allMistakes);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => {
    const wins = reviewed.filter((r) => r.outcome === 'W').length;
    const losses = reviewed.filter((r) => r.outcome === 'L').length;
    const draws = reviewed.filter((r) => r.outcome === 'D').length;
    const totalMoves = reviewed.reduce((s, r) => s + r.review.moves.length, 0);
    const totalBlunders = reviewed.reduce((s, r) => s + r.blunders, 0);
    const avgAccuracy =
      reviewed.length > 0
        ? Math.round((reviewed.reduce((s, r) => s + r.accuracy, 0) / reviewed.length) * 10) / 10
        : 0;
    const blunderRate = totalMoves > 0 ? Math.round((totalBlunders / totalMoves) * 1000) / 10 : 0;

    const byResult = (outcome: 'W' | 'L' | 'D') => {
      const rel = reviewed.filter((r) => r.outcome === outcome);
      if (!rel.length) return null;
      return Math.round((rel.reduce((s, r) => s + r.accuracy, 0) / rel.length) * 10) / 10;
    };

    return {
      wins,
      losses,
      draws,
      avgAccuracy,
      blunderRate,
      totalBlunders,
      accuracyByResult: { W: byResult('W'), L: byResult('L'), D: byResult('D') },
    };
  }, [reviewed]);

  const themeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const m of mistakes) counts[m.theme] = (counts[m.theme] ?? 0) + 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [mistakes]);

  return (
    <div style={{ color: TEXT, fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: ACCENT, margin: '0 0 4px 0' }}>Analytics</h1>
        <p style={{ fontSize: 12, color: MUTED, margin: '0 0 16px 0' }}>
          Trends from your {reviewed.length} most recent analysed game
          {reviewed.length === 1 ? '' : 's'}
          {totalGames > reviewed.length ? ` (of ${totalGames} recorded)` : ''}.
        </p>

        {loading && <div style={{ fontSize: 13, color: MUTED }}>Crunching your games…</div>}

        {!loading && reviewed.length === 0 && (
          <div style={{ ...card, textAlign: 'center', color: MUTED, fontSize: 13 }}>
            No analysable games yet. Record or import a game to see your stats.
          </div>
        )}

        {!loading && reviewed.length > 0 && (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 12,
                marginBottom: 20,
              }}
            >
              <Stat label="Games" value={String(reviewed.length)} />
              <Stat
                label="W / L / D"
                value={`${stats.wins}/${stats.losses}/${stats.draws}`}
                color={ACCENT}
              />
              <Stat label="Avg accuracy" value={`${stats.avgAccuracy}%`} color={ACCENT} />
              <Stat
                label="Blunder rate"
                value={`${stats.blunderRate}%`}
                color={stats.blunderRate > 5 ? '#fb923c' : TEXT}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 13, fontWeight: 700, color: TEXT, margin: '0 0 8px 0' }}>
                Accuracy over recent games
              </h2>
              <AccuracyTrend data={reviewed} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <div style={card}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
                  Accuracy by result
                </div>
                {(['W', 'D', 'L'] as const).map((k) => {
                  const value = stats.accuracyByResult[k];
                  const labels: Record<'W' | 'D' | 'L', string> = {
                    W: 'Wins',
                    D: 'Draws',
                    L: 'Losses',
                  };
                  return (
                    <div
                      key={k}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 12,
                        padding: '4px 0',
                        color: MUTED,
                      }}
                    >
                      <span>{labels[k]}</span>
                      <span style={{ fontWeight: 700, color: value === null ? '#6b7280' : TEXT }}>
                        {value === null ? '—' : `${value}%`}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div style={card}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
                  Weaknesses to work on
                </div>
                {themeCounts.length === 0 ? (
                  <div style={{ fontSize: 12, color: MUTED }}>
                    No recurring mistakes captured yet.
                  </div>
                ) : (
                  themeCounts.map(([theme, count]) => (
                    <div
                      key={theme}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 12,
                        padding: '4px 0',
                        color: MUTED,
                      }}
                    >
                      <span>{themeLabel(theme)}</span>
                      <span style={{ fontWeight: 700, color: '#fb923c' }}>{count}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
