import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { coachInsight } from '../engine/claude';
import { reviewGame } from '../engine/postgame';
import { listGames, type StoredGame } from '../lib/games';
import { listMistakes, type Mistake } from '../lib/mistakeDB';
import { loadSettings } from '../lib/storage';
import type { GameReview, Settings } from '../types';

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

/** Aggregate performance numbers derived from the reviewed games + mistake store. */
interface PerfStats {
  wins: number;
  losses: number;
  draws: number;
  avgAccuracy: number;
  blunderRate: number;
  totalBlunders: number;
  accuracyByResult: { W: number | null; L: number | null; D: number | null };
}

/** Ordered [theme, count] pairs, most frequent first. */
type ThemeCounts = ReadonlyArray<readonly [string, number]>;

/**
 * Assemble a concise, plain-text summary of the player's numbers for the coach
 * prompt. Kept deterministic and free of markup so any AI tier can consume it.
 */
function buildSummary(games: number, stats: PerfStats, themes: ThemeCounts): string {
  const acc = (v: number | null) => (v === null ? 'n/a' : `${v}%`);
  const topThemes =
    themes.length > 0
      ? themes
          .slice(0, 3)
          .map(([theme, count]) => `${themeLabel(theme)} (${count})`)
          .join(', ')
      : 'none recorded';
  const perGame = games > 0 ? Math.round((stats.totalBlunders / games) * 10) / 10 : 0;
  const lines = [
    `Games analysed: ${games}.`,
    `Record (W/L/D): ${stats.wins}/${stats.losses}/${stats.draws}.`,
    `Average accuracy: ${stats.avgAccuracy}%.`,
    `Blunder rate: ${stats.blunderRate}% (about ${perGame} blunders per game).`,
    `Accuracy in wins: ${acc(stats.accuracyByResult.W)}, draws: ${acc(
      stats.accuracyByResult.D,
    )}, losses: ${acc(stats.accuracyByResult.L)}.`,
    `Most common mistake themes: ${topThemes}.`,
  ];
  return lines.join('\n');
}

/**
 * Local heuristic coaching summary, used when no AI backend is configured
 * (coachInsight returned null). Generated purely from the same aggregate stats.
 */
function heuristicInsight(games: number, stats: PerfStats, themes: ThemeCounts): string {
  const perGame = games > 0 ? Math.round((stats.totalBlunders / games) * 10) / 10 : 0;
  const topTheme = themes.length > 0 ? themeLabel(themes[0][0]) : null;
  const themeList =
    themes.length > 0
      ? themes
          .slice(0, 3)
          .map(([theme]) => themeLabel(theme).toLowerCase())
          .join(', ')
      : null;

  const paras: string[] = [];
  paras.push(
    `Across your last **${games}** analysed game${games === 1 ? '' : 's'} you're averaging **${
      stats.avgAccuracy
    }%** accuracy with a record of **${stats.wins}W / ${stats.losses}L / ${stats.draws}D**.`,
  );
  paras.push(
    `You blunder about **${perGame} time${perGame === 1 ? '' : 's'} per game** (a ${
      stats.blunderRate
    }% blunder rate)` +
      (themeList ? `, and your most common mistakes are **${themeList}**.` : '.'),
  );

  let focus: string;
  if (stats.blunderRate > 5) {
    focus = topTheme
      ? `Focus on cutting down blunders — before each move, do a quick check for ${topTheme.toLowerCase()} and undefended pieces.`
      : 'Focus on cutting down blunders — take an extra moment each move to check for hanging pieces and opponent threats.';
  } else if (stats.avgAccuracy < 80) {
    focus = topTheme
      ? `Your blunder rate is under control; to raise accuracy, drill ${topTheme.toLowerCase()} and calculate one move deeper in sharp positions.`
      : 'Your blunder rate is under control; to raise accuracy, slow down in critical moments and calculate one move deeper.';
  } else {
    focus =
      'Solid, consistent play — keep it up and push for precision by reviewing the few inaccuracies that slip through.';
  }
  paras.push(`**Focus:** ${focus}`);

  return paras.join('\n\n');
}

/** Split a **bold** span-aware paragraph into React nodes, mapping **x** → <strong>. */
function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    nodes.push(
      <strong key={`b${key++}`} style={{ color: TEXT, fontWeight: 700 }}>
        {m[1]}
      </strong>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/** Render coach text: split on blank lines into paragraphs, applying inline bold. */
function CoachText({ text }: { text: string }) {
  const paras = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const list = paras.length > 0 ? paras : [text];
  return (
    <>
      {list.map((p, i) => (
        <p
          key={i}
          style={{
            fontSize: 13,
            lineHeight: 1.55,
            color: MUTED,
            margin: i === 0 ? '0 0 8px 0' : '0 0 8px 0',
          }}
        >
          {renderInline(p)}
        </p>
      ))}
    </>
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

  // AI Coach Insights (Phase 4) — populated once local stats are ready.
  const [insight, setInsight] = useState<string | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  /** True when the shown text came from the local heuristic (no AI configured). */
  const [insightFromFallback, setInsightFromFallback] = useState(false);

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

  const stats = useMemo<PerfStats>(() => {
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

  // Guards against out-of-order async completions (e.g. rapid Regenerate clicks).
  const insightRunRef = useRef(0);

  const fetchInsight = useCallback(async () => {
    const gameCount = reviewed.length;
    if (gameCount === 0) return; // only fetch when there's at least 1 game
    const runId = ++insightRunRef.current;
    setInsightLoading(true);
    try {
      const summary = buildSummary(gameCount, stats, themeCounts);
      let text: string | null = null;
      try {
        const settings: Settings = await loadSettings();
        text = await coachInsight(summary, settings);
      } catch (e) {
        console.warn('[ChessAI] AI coach insight failed:', e);
        text = null;
      }
      if (insightRunRef.current !== runId) return; // superseded by a newer run
      if (text && text.trim()) {
        setInsight(text.trim());
        setInsightFromFallback(false);
      } else {
        setInsight(heuristicInsight(gameCount, stats, themeCounts));
        setInsightFromFallback(true);
      }
    } catch (e) {
      // Never let the coach card crash the tab — degrade to the local heuristic.
      console.warn('[ChessAI] AI coach card error:', e);
      if (insightRunRef.current === runId) {
        try {
          setInsight(heuristicInsight(gameCount, stats, themeCounts));
          setInsightFromFallback(true);
        } catch {
          /* ignore */
        }
      }
    } finally {
      if (insightRunRef.current === runId) setInsightLoading(false);
    }
  }, [reviewed.length, stats, themeCounts]);

  // Kick off (or refresh) the insight once local analysis has finished.
  useEffect(() => {
    if (loading || reviewed.length === 0) return;
    void fetchInsight();
  }, [loading, fetchInsight, reviewed.length]);

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

            {/* AI Coach Insights (Phase 4) — glassmorphic, accent green. */}
            <div
              style={{
                position: 'relative',
                background: 'rgba(34,197,94,0.06)',
                border: `1px solid rgba(34,197,94,0.35)`,
                borderRadius: 12,
                padding: 16,
                marginBottom: 20,
                boxShadow: '0 1px 24px rgba(34,197,94,0.08)',
                backdropFilter: 'blur(6px)',
                WebkitBackdropFilter: 'blur(6px)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  marginBottom: insight || insightLoading ? 10 : 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 15, color: ACCENT }}>✦</span>
                  <h2 style={{ fontSize: 13, fontWeight: 800, color: ACCENT, margin: 0 }}>
                    AI Coach Insights
                  </h2>
                  {insightFromFallback && insight && !insightLoading && (
                    <span
                      style={{
                        fontSize: 10,
                        color: MUTED,
                        border: `1px solid ${BORDER}`,
                        borderRadius: 999,
                        padding: '1px 8px',
                      }}
                    >
                      offline summary
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void fetchInsight()}
                  disabled={insightLoading}
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: insightLoading ? MUTED : ACCENT,
                    background: 'transparent',
                    border: `1px solid ${insightLoading ? BORDER : 'rgba(34,197,94,0.5)'}`,
                    borderRadius: 8,
                    padding: '4px 10px',
                    cursor: insightLoading ? 'default' : 'pointer',
                  }}
                >
                  {insightLoading ? 'Thinking…' : 'Regenerate'}
                </button>
              </div>

              {insightLoading && !insight && (
                <div style={{ fontSize: 13, color: MUTED }}>
                  Reviewing your numbers and drafting coaching tips…
                </div>
              )}
              {insight && <CoachText text={insight} />}
              {!insightLoading && !insight && (
                <div style={{ fontSize: 12, color: MUTED }}>
                  No insight yet — hit Regenerate to analyse your recent play.
                </div>
              )}
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
