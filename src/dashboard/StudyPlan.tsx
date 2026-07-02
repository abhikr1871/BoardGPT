import { useEffect, useMemo, useState } from 'react';
import { reviewGame } from '../engine/postgame';
import { listGames, type StoredGame } from '../lib/games';
import { listMistakes, type Mistake } from '../lib/mistakeDB';

/**
 * Weekly study plan (Phase 3 learning platform). Pure client-side heuristics:
 * counts mistake themes and re-reviews recent games to spot patterns, then
 * turns them into a friendly, checkable to-do list. No network, no engine calls
 * beyond the local review pass.
 */

const ACCENT = '#22c55e';
const PANEL = '#0f172a';
const PANEL_ALT = '#111827';
const BORDER = '#1f2937';
const TEXT = '#e5e7eb';
const MUTED = '#9ca3af';

const MAX_GAMES = 20;

interface PlanItem {
  id: string;
  title: string;
  detail: string;
  icon: string;
}

const THEME_LABELS: Record<string, string> = {
  'hanging-piece': 'hanging pieces',
  tactics: 'tactics',
};

function themeLabel(theme: string): string {
  return THEME_LABELS[theme] ?? theme;
}

function buildPlan(games: StoredGame[], mistakes: Mistake[]): PlanItem[] {
  const items: PlanItem[] = [];

  // Re-review recent games for aggregate signals.
  let blunders = 0;
  let openingInaccuracies = 0;
  let endgameInaccuracies = 0;
  let analysed = 0;
  let accuracySum = 0;

  for (const g of games.slice(0, MAX_GAMES)) {
    try {
      const review = reviewGame(g.pgn);
      analysed += 1;
      accuracySum += (review.accuracy.white + review.accuracy.black) / 2;
      const total = review.moves.length;
      for (const m of review.moves) {
        const isBad = m.quality === 'mistake' || m.quality === 'blunder' || m.quality === 'inaccuracy';
        if (m.quality === 'blunder') blunders += 1;
        if (!isBad) continue;
        if (m.ply < 12) openingInaccuracies += 1;
        else if (m.ply > total - 16) endgameInaccuracies += 1;
      }
    } catch {
      /* skip unparseable */
    }
  }

  const avgAccuracy = analysed > 0 ? accuracySum / analysed : null;

  // Theme counts from the mistake store.
  const themeCounts: Record<string, number> = {};
  for (const m of mistakes) themeCounts[m.theme] = (themeCounts[m.theme] ?? 0) + 1;
  const topTheme = Object.entries(themeCounts).sort((a, b) => b[1] - a[1])[0];

  if (blunders > 0) {
    items.push({
      id: 'blunders',
      icon: '🎯',
      title: `Drill tactics — you blundered ${blunders} time${blunders === 1 ? '' : 's'} recently`,
      detail: 'Do 15 minutes of tactics puzzles daily and double-check every forcing reply before moving.',
    });
  }

  if (topTheme && topTheme[1] > 0) {
    items.push({
      id: `theme-${topTheme[0]}`,
      icon: '🧩',
      title: `Shore up your biggest weakness: ${themeLabel(topTheme[0])}`,
      detail: `You've logged ${topTheme[1]} ${themeLabel(topTheme[0])} mistake${
        topTheme[1] === 1 ? '' : 's'
      }. Clear the due cards in the Mistake Clinic this week.`,
    });
  }

  if (endgameInaccuracies >= 3) {
    items.push({
      id: 'endgame',
      icon: '♚',
      title: 'Accuracy dips in the endgame — review K+P and rook endings',
      detail: `Study one endgame masterclass and practise converting simple king-and-pawn positions.`,
    });
  }

  if (openingInaccuracies >= 3) {
    items.push({
      id: 'opening',
      icon: '📖',
      title: 'Tighten your opening — early inaccuracies are creeping in',
      detail: 'Spend a session in the Repertoire Trainer reinforcing your main lines to move 8.',
    });
  }

  if (avgAccuracy !== null && avgAccuracy < 80) {
    items.push({
      id: 'accuracy',
      icon: '📈',
      title: `Lift your average accuracy (currently ${Math.round(avgAccuracy)}%)`,
      detail: 'Play slower time controls and take a few seconds to consider candidate moves before committing.',
    });
  }

  // Always-on habits so the plan is never empty.
  items.push({
    id: 'review-habit',
    icon: '🔁',
    title: 'Review every game you play this week',
    detail: 'Run each finished game through the analyser and capture new mistakes for the clinic.',
  });

  if (mistakes.length === 0 && games.length === 0) {
    items.unshift({
      id: 'getting-started',
      icon: '🚀',
      title: 'Play and record a few games to unlock a tailored plan',
      detail: 'Once you have a handful of games, this plan adapts to your specific weak spots.',
    });
  }

  return items;
}

export function StudyPlan() {
  const [items, setItems] = useState<PlanItem[]>([]);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [games, mistakes] = await Promise.all([
        listGames().catch(() => [] as StoredGame[]),
        listMistakes().catch(() => [] as Mistake[]),
      ]);
      const plan = buildPlan(games, mistakes);
      if (!cancelled) {
        setItems(plan);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const completed = useMemo(() => items.filter((i) => done[i.id]).length, [items, done]);

  function toggle(id: string) {
    setDone((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div style={{ color: TEXT, fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: ACCENT, margin: '0 0 4px 0' }}>
          Your Weekly Study Plan
        </h1>
        <p style={{ fontSize: 12, color: MUTED, margin: '0 0 16px 0' }}>
          A personalised checklist built from your recent games and logged mistakes. Tick items off
          as you go.
        </p>

        {loading && <div style={{ fontSize: 13, color: MUTED }}>Building your plan…</div>}

        {!loading && (
          <>
            <div style={{ fontSize: 12, color: MUTED, marginBottom: 12 }}>
              {completed} of {items.length} done
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {items.map((item) => {
                const checked = !!done[item.id];
                return (
                  <button
                    key={item.id}
                    onClick={() => toggle(item.id)}
                    style={{
                      display: 'flex',
                      gap: 12,
                      textAlign: 'left',
                      background: PANEL_ALT,
                      border: `1px solid ${checked ? 'rgba(34,197,94,0.4)' : BORDER}`,
                      borderRadius: 10,
                      padding: 14,
                      cursor: 'pointer',
                      opacity: checked ? 0.7 : 1,
                    }}
                  >
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        flexShrink: 0,
                        borderRadius: 6,
                        border: `1px solid ${checked ? ACCENT : BORDER}`,
                        background: checked ? ACCENT : PANEL,
                        color: '#0b1120',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 13,
                        fontWeight: 800,
                        marginTop: 1,
                      }}
                    >
                      {checked ? '✓' : ''}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          marginBottom: 2,
                          textDecoration: checked ? 'line-through' : 'none',
                        }}
                      >
                        <span style={{ marginRight: 6 }} aria-hidden>
                          {item.icon}
                        </span>
                        {item.title}
                      </div>
                      <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.4 }}>{item.detail}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
