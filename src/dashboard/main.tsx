import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { reviewGame } from '../engine/postgame';
import type { GameReview, MoveQuality } from '../types';
import { cpToBarFraction } from '../lib/evaluation';
import { listGames, type StoredGame } from '../lib/games';
import { captureFromReview } from '../lib/mistakeDB';
import { MistakeClinic } from './MistakeClinic';
import { RepertoireTrainer } from './RepertoireTrainer';
import { Masterclass } from './Masterclass';
import { Analytics } from './Analytics';
import { StudyPlan } from './StudyPlan';
import { GameHistory } from './GameHistory';
import { LoginPage } from './LoginPage';
import { PremiumPage } from './PremiumPage';
import { PremiumGate } from './PremiumGate';
import { ReviewBoard } from './ReviewBoard';
import { getAuth } from '../lib/auth';
import { loadSettings } from '../lib/storage';
import { freeUsesLeft, consumeAnalysis, FREE_ANALYSIS_LIMIT } from '../lib/usage';
import '../styles/tailwind.css';

type Tab =
  | 'review'
  | 'clinic'
  | 'trainer'
  | 'courses'
  | 'analytics'
  | 'plan'
  | 'account'
  | 'premium';

const SAMPLE_PGN = `[Event "Sample Game"]
[White "You"]
[Black "Opponent"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. b4 Bxb4 5. c3 Ba5 6. d4 exd4 7. O-O d3
8. Qb3 Qf6 9. e5 Qg6 10. Re1 Nge7 11. Ba3 b5 12. Qxb5 Rb8 13. Qa4 Bb6
14. Nbd2 Bb7 15. Ne4 Qf5 16. Bxd3 Qh5 17. Nf6+ gxf6 18. exf6 Rg8 19. Rad1 Qxf3
20. Rxe7+ Nxe7 21. Qxd7+ Kxd7 22. Bf5+ Ke8 23. Bd7+ Kf8 24. Bxe7# 1-0`;

const QUALITY_STYLE: Record<MoveQuality, { label: string; color: string; symbol: string }> = {
  brilliant: { label: 'Brilliant', color: '#22d3ee', symbol: '!!' },
  best: { label: 'Best', color: '#22c55e', symbol: '!' },
  good: { label: 'Good', color: '#86efac', symbol: '' },
  inaccuracy: { label: 'Inaccuracy', color: '#facc15', symbol: '?!' },
  mistake: { label: 'Mistake', color: '#fb923c', symbol: '?' },
  blunder: { label: 'Blunder', color: '#ef4444', symbol: '??' },
  book: { label: 'Book', color: '#9ca3af', symbol: '' },
};

function AccuracyGraph({ review }: { review: GameReview }) {
  const w = 640, h = 120, pad = 4;
  const pts = review.moves.map((m, i) => {
    const x = pad + (i / Math.max(1, review.moves.length - 1)) * (w - 2 * pad);
    const y = pad + (1 - cpToBarFraction(m.evalAfter)) * (h - 2 * pad);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-32 bg-gray-900 rounded border border-gray-800">
      <line x1={pad} y1={h / 2} x2={w - pad} y2={h / 2} stroke="#374151" strokeDasharray="4 4" />
      <polyline points={pts.join(' ')} fill="none" stroke="#22c55e" strokeWidth={2} />
    </svg>
  );
}

function Dashboard() {
  const [pgn, setPgn] = useState(SAMPLE_PGN);
  const [review, setReview] = useState<GameReview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recent, setRecent] = useState<StoredGame[]>([]);
  const [tab, setTab] = useState<Tab>('review');
  const [myColor, setMyColor] = useState<'w' | 'b'>('w');
  const [captured, setCaptured] = useState<number | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [premium, setPremium] = useState(false);
  const [usesLeft, setUsesLeft] = useState<number>(FREE_ANALYSIS_LIMIT);
  const [booted, setBooted] = useState(false);

  const refreshAuthUsage = () =>
    Promise.all([
      getAuth().catch(() => null),
      freeUsesLeft().catch(() => FREE_ANALYSIS_LIMIT),
      loadSettings().catch(() => null),
    ]).then(([auth, left, settings]) => {
      setLoggedIn(!!auth?.token);
      setPremium(auth?.plan === 'premium' || settings?.plan === 'premium');
      setUsesLeft(left);
      return { authed: !!auth?.token, left };
    });

  useEffect(() => {
    listGames().then(setRecent).catch(() => {});
    // First-run flow: send anonymous users to the Login page by default.
    refreshAuthUsage().then(({ authed }) => {
      if (!authed) setTab('account');
      setBooted(true);
    });
  }, []);

  const locked = !loggedIn && usesLeft <= 0;

  function run() {
    if (locked) {
      setTab('account');
      return;
    }
    setError(null);
    setBusy(true);
    setCaptured(null);
    // Defer so the button shows a busy state before the sync analysis runs.
    setTimeout(() => {
      try {
        const rv = reviewGame(pgn);
        setReview(rv);
        // Count this analysis against the free tier (unlimited when logged in).
        consumeAnalysis().then((left) => setUsesLeft(left)).catch(() => {});
        // Feed the player's mistakes into the spaced-repetition clinic.
        captureFromReview(rv, myColor).then((n) => setCaptured(n)).catch(() => {});
      } catch (e) {
        setError('Could not parse that PGN. ' + (e as Error).message);
      } finally {
        setBusy(false);
      }
    }, 20);
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'review', label: '📊 Review' },
    { id: 'clinic', label: '🩺 Mistake Clinic' },
    { id: 'trainer', label: '📖 Repertoire Trainer' },
    { id: 'courses', label: '🎓 Masterclasses' },
    { id: 'analytics', label: '📈 Analytics' },
    { id: 'plan', label: '🗓️ Study Plan' },
    { id: 'account', label: loggedIn ? '👤 Account' : '🔑 Login' },
    { id: 'premium', label: '⭐ Premium' },
  ];

  return (
    <div 
      className="h-screen text-gray-100 font-sans relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #020617 0%, #0f172a 100%)' }}
    >
      {/* Ambient background glows */}
      <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vh] rounded-full bg-green-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50vw] h-[50vh] rounded-full bg-cyan-500/10 blur-[120px] pointer-events-none" />

      <div className="relative z-10 flex h-full w-full">
        {/* ── Left sidebar ── */}
        <aside className="shrink-0 w-60 border-r border-white/5 bg-gray-900/40 backdrop-blur-md flex flex-col p-4 gap-1 h-full overflow-y-auto custom-scrollbar">
          <div className="flex items-center gap-2 px-2 mb-6 mt-1">
            <span className="text-2xl filter drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]">♟</span>
            <span className="text-lg font-black bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-cyan-400 tracking-tight">
              BoardGPT
            </span>
          </div>
          {TABS.map((t) => {
            const active = tab === t.id;
            const isPremiumTab = t.id === 'trainer' || t.id === 'courses' || t.id === 'analytics';
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  background: active ? 'linear-gradient(135deg, #16a34a, #059669)' : 'transparent',
                  boxShadow: active ? '0 4px 12px rgba(22, 163, 74, 0.3)' : 'none',
                }}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center justify-between ${
                  active ? 'text-white' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                }`}
              >
                <span>{t.label}</span>
                {isPremiumTab && !premium && <span title="Premium" className="text-[10px]">⭐</span>}
              </button>
            );
          })}
          <div className="mt-auto px-2 pt-4 text-[11px] text-gray-500">
            {premium ? '⭐ Premium' : loggedIn ? 'Free plan' : 'Not signed in'}
          </div>
        </aside>

        {/* ── Main content (full remaining width) ── */}
        <main className="flex-1 min-w-0 p-4 sm:p-8 h-full overflow-y-auto custom-scrollbar">
        {tab === 'clinic' && <MistakeClinic />}
        {tab === 'trainer' && (
          <PremiumGate feature="Opening Trainer" premium={premium} onUpgrade={() => setTab('premium')}>
            <RepertoireTrainer />
          </PremiumGate>
        )}
        {tab === 'courses' && (
          <PremiumGate feature="Masterclasses" premium={premium} onUpgrade={() => setTab('premium')}>
            <Masterclass />
          </PremiumGate>
        )}
        {tab === 'analytics' && (
          <PremiumGate feature="Analytics" premium={premium} onUpgrade={() => setTab('premium')}>
            <Analytics />
          </PremiumGate>
        )}
        {tab === 'plan' && <StudyPlan />}
        {tab === 'account' && (
          <LoginPage onAuthChanged={() => refreshAuthUsage()} />
        )}
        {tab === 'premium' && <PremiumPage />}

        {tab === 'review' && (
        <>
        <p className="text-xs text-gray-500 mb-4">
          Paste a PGN or pick a past game, then get per-move classification, accuracy and coaching (blueprint §8).
        </p>

        {/* Free-tier status / lock */}
        {!loggedIn && (
          locked ? (
            <div className="mb-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4">
              <div className="text-sm font-semibold text-yellow-300 mb-1">
                🔒 You've used all {FREE_ANALYSIS_LIMIT} free analyses
              </div>
              <div className="text-xs text-gray-300 mb-3">
                Log in for unlimited game analysis and cloud history, or go Premium for the full toolkit.
              </div>
              <div className="flex gap-2">
                <button
                  className="rounded bg-accent px-3 py-1.5 text-xs font-semibold text-black hover:brightness-110"
                  onClick={() => setTab('account')}
                >
                  Log in — it's free
                </button>
                <button
                  className="rounded border border-gray-600 px-3 py-1.5 text-xs text-gray-200 hover:border-accent"
                  onClick={() => setTab('premium')}
                >
                  See Premium ⭐
                </button>
              </div>
            </div>
          ) : (
            <div className="mb-4 text-xs text-gray-400">
              Free tier · <span className="text-accent font-semibold">{usesLeft}</span> of {FREE_ANALYSIS_LIMIT} analyses left ·{' '}
              <button className="text-accent underline" onClick={() => setTab('account')}>Log in</button> for unlimited
            </div>
          )
        )}

        <div className="mb-3 text-xs text-gray-400 flex items-center gap-2">
          Your color for mistake capture:
          <select
            className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs"
            value={myColor}
            onChange={(e) => setMyColor(e.target.value as 'w' | 'b')}
          >
            <option value="w">White</option>
            <option value="b">Black</option>
          </select>
          {captured !== null && <span className="text-accent">+{captured} mistake(s) saved to clinic</span>}
        </div>

        {/* Cloud/local game history integrated directly into Review */}
        <div className="mb-4">
          <GameHistory onOpen={(p) => { setPgn(p); setReview(null); }} />
        </div>

        <textarea
          className="w-full h-32 rounded bg-gray-900 border border-gray-700 p-3 text-xs font-mono outline-none focus:border-accent"
          value={pgn}
          spellCheck={false}
          onChange={(e) => setPgn(e.target.value)}
        />
        <div className="mt-2 flex gap-2">
          <button
            className="rounded bg-accent px-4 py-2 text-sm font-semibold text-black hover:brightness-110 disabled:opacity-50"
            onClick={run}
            disabled={busy}
          >
            {busy ? 'Analyzing…' : 'Analyze game'}
          </button>
          <button
            className="rounded bg-gray-800 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
            onClick={() => setPgn(SAMPLE_PGN)}
          >
            Load sample
          </button>
        </div>

        {error && <div className="text-red-400 text-sm mt-3">{error}</div>}

        {review && (
          <div className="mt-6 space-y-6">
            {/* Interactive replay + analysis board */}
            <ReviewBoard pgn={pgn} />

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-panel-alt border border-gray-700 p-4">
                <div className="text-xs text-gray-400">White accuracy</div>
                <div className="text-2xl font-bold text-accent">{review.accuracy.white}%</div>
              </div>
              <div className="rounded-lg bg-panel-alt border border-gray-700 p-4">
                <div className="text-xs text-gray-400">Black accuracy</div>
                <div className="text-2xl font-bold text-accent">{review.accuracy.black}%</div>
              </div>
              <div className="rounded-lg bg-panel-alt border border-gray-700 p-4">
                <div className="text-xs text-gray-400">Opening · Result</div>
                <div className="text-sm font-semibold mt-1">{review.opening ?? 'Unknown'}</div>
                <div className="text-xs text-gray-500">{review.result}</div>
              </div>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-gray-300 mb-2">Accuracy graph (white POV)</h2>
              <AccuracyGraph review={review} />
            </div>

            {review.coachingSummary && (
              <div className="rounded-lg bg-panel-alt border border-gray-700 p-4">
                <h2 className="text-sm font-semibold text-accent mb-1">AI Coaching Summary</h2>
                <p className="text-sm text-gray-200 leading-relaxed">{review.coachingSummary}</p>
              </div>
            )}

            <div>
              <h2 className="text-sm font-semibold text-gray-300 mb-2">Move-by-move</h2>
              <div className="rounded-lg border border-gray-800 overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-900 text-gray-400">
                    <tr>
                      <th className="text-left px-3 py-2">#</th>
                      <th className="text-left px-3 py-2">Move</th>
                      <th className="text-left px-3 py-2">Quality</th>
                      <th className="text-left px-3 py-2">Best</th>
                      <th className="text-left px-3 py-2">Comment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {review.moves.map((m) => {
                      const q = QUALITY_STYLE[m.quality];
                      const critical = review.criticalMoments.includes(m.ply);
                      return (
                        <tr key={m.ply} className={`border-t border-gray-800 ${critical ? 'bg-red-950/30' : ''}`}>
                          <td className="px-3 py-1.5 text-gray-500">
                            {m.color === 'w' ? `${m.moveNumber}.` : `${m.moveNumber}…`}
                          </td>
                          <td className="px-3 py-1.5 font-mono">{m.san}</td>
                          <td className="px-3 py-1.5 font-semibold" style={{ color: q.color }}>
                            {q.symbol} {q.label}
                          </td>
                          <td className="px-3 py-1.5 font-mono text-gray-400">{m.bestSan}</td>
                          <td className="px-3 py-1.5 text-gray-300">{m.comment}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        </>
        )}
        </main>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Dashboard />
  </StrictMode>,
);
