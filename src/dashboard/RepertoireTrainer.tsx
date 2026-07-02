import { useMemo, useState } from 'react';
import { Chess } from 'chess.js';
import { getOpeningRecommendations, type RepertoireOption } from '../engine/openings';

/**
 * Opening drill. The player picks a colour and walks the opening book: for the
 * current position we surface the recommended repertoire moves (from
 * {@link getOpeningRecommendations}); the player plays one, and a lightweight,
 * engine-free heuristic answers for the opponent (grab the centre, then develop
 * knights) so the drill keeps flowing. A simple counter tracks how often the
 * player stayed in book.
 */

const ACCENT = '#22c55e';
const PANEL = '#0f172a';
const PANEL_ALT = '#111827';
const BORDER = '#1f2937';
const TEXT = '#e5e7eb';
const MUTED = '#9ca3af';

// Opponent reply preferences, best first. The heuristic plays the first of
// these that is legal, else falls back to any legal move.
const OPPONENT_PREFS = [
  'e5', 'e6', 'c5', 'd5', 'c6', 'Nf6', 'Nc6', // Black-ish replies to 1.e4/1.d4
  'e4', 'd4', 'Nf3', 'c4', 'Nc3', 'g3', // White-ish first/second moves
  'd6', 'g6', 'Be7', 'Bc5', 'Bb4', 'O-O',
];

interface HistoryEntry {
  san: string;
  by: 'you' | 'opponent';
  inBook: boolean;
}

const card: React.CSSProperties = {
  background: PANEL_ALT,
  border: `1px solid ${BORDER}`,
  borderRadius: 10,
  padding: 16,
};

const primaryBtn: React.CSSProperties = {
  padding: '9px 16px',
  borderRadius: 8,
  border: 'none',
  background: ACCENT,
  color: '#0b1120',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
};

const ghostBtn: React.CSSProperties = {
  padding: '8px 14px',
  borderRadius: 8,
  border: `1px solid ${BORDER}`,
  background: 'transparent',
  color: TEXT,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

/** Picks a plausible opponent reply with no engine: prefer centre/development. */
function chooseOpponentMove(game: Chess): string | null {
  const legal = game.moves(); // SAN list
  if (legal.length === 0) return null;
  for (const pref of OPPONENT_PREFS) {
    if (legal.includes(pref)) return pref;
  }
  // Otherwise prefer a quiet developing move over a random capture.
  const developing = legal.find((m) => /^N[a-h][1-8]$/.test(m) || /^B[a-h][1-8]$/.test(m));
  return developing ?? legal[0];
}

export function RepertoireTrainer() {
  const [color, setColor] = useState<'w' | 'b'>('w');
  const [fen, setFen] = useState(() => new Chess().fen());
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [hits, setHits] = useState(0);
  const [total, setTotal] = useState(0);
  const [manualMove, setManualMove] = useState('');
  const [note, setNote] = useState<string | null>(null);

  // Recommendation book for the position currently on the board.
  const recommendation = useMemo(() => getOpeningRecommendations(fen), [fen]);
  const bookSans = useMemo(
    () => new Set((recommendation?.options ?? []).map((o) => o.moveSan)),
    [recommendation],
  );

  const game = useMemo(() => new Chess(fen), [fen]);
  const yourTurn = game.turn() === color;
  const isGameOver = game.moves().length === 0;

  function reset(nextColor: 'w' | 'b' = color) {
    const fresh = new Chess();
    setColor(nextColor);
    setFen(fresh.fen());
    setHistory([]);
    setHits(0);
    setTotal(0);
    setManualMove('');
    setNote(nextColor === 'b' ? 'You are Black — White moves first.' : null);

    // If the player is Black, let White open with a book/heuristic move.
    if (nextColor === 'b') {
      const opening = chooseOpponentMove(fresh);
      if (opening) {
        fresh.move(opening);
        setFen(fresh.fen());
        setHistory([{ san: opening, by: 'opponent', inBook: true }]);
      }
    }
  }

  /** Applies the player's move, records book accuracy, then auto-replies. */
  function playMove(san: string) {
    setNote(null);
    const next = new Chess(fen);
    let played: { san: string } | null = null;
    try {
      played = next.move(san);
    } catch {
      played = null;
    }
    if (!played) {
      setNote(`"${san}" is not a legal move here.`);
      return;
    }

    const wasBook = bookSans.has(played.san);
    const entries: HistoryEntry[] = [{ san: played.san, by: 'you', inBook: wasBook }];
    setHits((h) => h + (wasBook ? 1 : 0));
    setTotal((t) => t + 1);
    setManualMove('');

    // Opponent replies immediately (unless the game just ended).
    if (next.moves().length > 0) {
      const reply = chooseOpponentMove(next);
      if (reply) {
        const replyBook = getOpeningRecommendations(next.fen()) != null;
        next.move(reply);
        entries.push({ san: reply, by: 'opponent', inBook: replyBook });
      }
    }

    setFen(next.fen());
    setHistory((prev) => [...prev, ...entries]);
  }

  const accuracy = total > 0 ? Math.round((hits / total) * 100) : 100;

  return (
    <div style={{ color: TEXT, fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: ACCENT, margin: '0 0 4px 0' }}>
          Repertoire Trainer
        </h1>
        <p style={{ fontSize: 12, color: MUTED, margin: '0 0 16px 0' }}>
          Rehearse your openings. Pick the recommended moves to stay in book; the trainer plays a
          plausible opponent reply and keeps the line going.
        </p>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: MUTED }}>Play as</span>
          <button
            style={color === 'w' ? primaryBtn : ghostBtn}
            onClick={() => reset('w')}
          >
            White
          </button>
          <button
            style={color === 'b' ? primaryBtn : ghostBtn}
            onClick={() => reset('b')}
          >
            Black
          </button>
          <button style={{ ...ghostBtn, marginLeft: 'auto' }} onClick={() => reset()}>
            Restart
          </button>
        </div>

        {/* Scoreboard */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <div style={{ ...card, flex: 1, padding: 12 }}>
            <div style={{ fontSize: 11, color: MUTED }}>Book accuracy</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: ACCENT }}>{accuracy}%</div>
          </div>
          <div style={{ ...card, flex: 1, padding: 12 }}>
            <div style={{ fontSize: 11, color: MUTED }}>In book</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>
              {hits}
              <span style={{ fontSize: 13, color: MUTED }}> / {total}</span>
            </div>
          </div>
          <div style={{ ...card, flex: 1, padding: 12 }}>
            <div style={{ fontSize: 11, color: MUTED }}>Ply</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{history.length}</div>
          </div>
        </div>

        {/* Current FEN */}
        <div
          style={{
            fontSize: 11,
            fontFamily: 'monospace',
            color: MUTED,
            background: PANEL,
            border: `1px solid ${BORDER}`,
            borderRadius: 6,
            padding: '6px 8px',
            marginBottom: 12,
            wordBreak: 'break-all',
          }}
        >
          {fen}
        </div>

        {note && (
          <div style={{ fontSize: 12, color: '#fca5a5', marginBottom: 12 }}>{note}</div>
        )}

        {/* Recommendations for the current position */}
        <div style={{ ...card, marginBottom: 12 }}>
          {isGameOver ? (
            <div style={{ fontSize: 13, color: MUTED }}>
              No legal moves — the line has reached its end. Restart to drill again.
            </div>
          ) : !yourTurn ? (
            <div style={{ fontSize: 13, color: MUTED }}>Waiting for the opponent…</div>
          ) : recommendation ? (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                Recommended moves
                <span style={{ fontSize: 11, color: MUTED, fontWeight: 500 }}>
                  {' '}
                  — [{recommendation.eco}] {recommendation.openingName}
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {recommendation.options.map((opt: RepertoireOption) => (
                  <button
                    key={opt.id}
                    onClick={() => playMove(opt.moveSan)}
                    title={opt.description}
                    style={{
                      textAlign: 'left',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: `1px solid rgba(34,197,94,0.3)`,
                      background: 'rgba(34,197,94,0.1)',
                      color: '#4ade80',
                      cursor: 'pointer',
                      minWidth: 150,
                    }}
                  >
                    <div style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 14 }}>
                      {opt.moveSan}
                    </div>
                    <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{opt.title}</div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 13, color: MUTED }}>
              Out of book — no repertoire recommendation for this position. Type any legal move
              below to keep exploring.
            </div>
          )}

          {/* Manual move entry (always available on your turn) */}
          {yourTurn && !isGameOver && (
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <input
                value={manualMove}
                onChange={(e) => setManualMove(e.target.value)}
                placeholder="Or play your own move (e.g. Nf3)"
                spellCheck={false}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && manualMove.trim()) playMove(manualMove.trim());
                }}
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  borderRadius: 8,
                  border: `1px solid ${BORDER}`,
                  background: PANEL,
                  color: TEXT,
                  fontSize: 13,
                  fontFamily: 'monospace',
                  outline: 'none',
                }}
              />
              <button
                style={primaryBtn}
                onClick={() => manualMove.trim() && playMove(manualMove.trim())}
              >
                Play
              </button>
            </div>
          )}
        </div>

        {/* Move list */}
        {history.length > 0 && (
          <div style={card}>
            <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, marginBottom: 8 }}>
              Line so far
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontFamily: 'monospace', fontSize: 13 }}>
              {history.map((h, i) => (
                <span
                  key={i}
                  title={h.by === 'you' ? (h.inBook ? 'In book' : 'Off book') : 'Opponent reply'}
                  style={{
                    padding: '2px 6px',
                    borderRadius: 4,
                    background:
                      h.by === 'you'
                        ? h.inBook
                          ? 'rgba(34,197,94,0.15)'
                          : 'rgba(251,146,60,0.15)'
                        : PANEL,
                    color: h.by === 'you' ? (h.inBook ? '#4ade80' : '#fb923c') : MUTED,
                    border: `1px solid ${BORDER}`,
                  }}
                >
                  {i % 2 === 0 ? `${Math.floor(i / 2) + 1}.` : ''} {h.san}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
