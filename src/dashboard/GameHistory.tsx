import { useEffect, useMemo, useState } from 'react';
import { listGames, type StoredGame } from '../lib/games';

/**
 * Game history browser (Phase 3). Lists recorded games with result/source
 * filters and a synced-to-cloud marker. Clicking a game copies its PGN to the
 * clipboard, or hands it to an optional `onOpen` callback (e.g. to load it into
 * the review tab).
 */

const ACCENT = '#22c55e';
const PANEL = '#0f172a';
const PANEL_ALT = '#111827';
const BORDER = '#1f2937';
const TEXT = '#e5e7eb';
const MUTED = '#9ca3af';

const ALL = '__all__';

function selectStyle(): React.CSSProperties {
  return {
    background: PANEL,
    border: `1px solid ${BORDER}`,
    borderRadius: 6,
    color: TEXT,
    fontSize: 12,
    padding: '6px 8px',
    outline: 'none',
  };
}

export function GameHistory({ onOpen }: { onOpen?: (pgn: string) => void }) {
  const [games, setGames] = useState<StoredGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [resultFilter, setResultFilter] = useState<string>(ALL);
  const [sourceFilter, setSourceFilter] = useState<string>(ALL);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    listGames()
      .then(setGames)
      .catch(() => setGames([]))
      .finally(() => setLoading(false));
  }, []);

  const results = useMemo(
    () => Array.from(new Set(games.map((g) => g.result))).sort(),
    [games],
  );
  const sources = useMemo(
    () => Array.from(new Set(games.map((g) => g.source))).sort(),
    [games],
  );

  const filtered = useMemo(
    () =>
      games.filter(
        (g) =>
          (resultFilter === ALL || g.result === resultFilter) &&
          (sourceFilter === ALL || g.source === sourceFilter),
      ),
    [games, resultFilter, sourceFilter],
  );

  async function handleClick(game: StoredGame) {
    if (onOpen) {
      onOpen(game.pgn);
      return;
    }
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(game.pgn);
        setCopiedId(game.id);
        setTimeout(() => setCopiedId((cur) => (cur === game.id ? null : cur)), 1500);
      }
    } catch {
      /* clipboard may be blocked; ignore */
    }
  }

  return (
    <div style={{ color: TEXT, fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: ACCENT, margin: '0 0 4px 0' }}>
          Game History
        </h1>
        <p style={{ fontSize: 12, color: MUTED, margin: '0 0 16px 0' }}>
          Your recorded games. Click one to {onOpen ? 'open it' : 'copy its PGN'}. The ☁ marker
          means it has synced to the cloud.
        </p>

        <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
          <label style={{ fontSize: 12, color: MUTED, display: 'flex', gap: 6, alignItems: 'center' }}>
            Result
            <select
              value={resultFilter}
              onChange={(e) => setResultFilter(e.target.value)}
              style={selectStyle()}
            >
              <option value={ALL}>All</option>
              {results.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <label style={{ fontSize: 12, color: MUTED, display: 'flex', gap: 6, alignItems: 'center' }}>
            Source
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              style={selectStyle()}
            >
              <option value={ALL}>All</option>
              {sources.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <span style={{ fontSize: 12, color: MUTED, marginLeft: 'auto' }}>
            {filtered.length} game{filtered.length === 1 ? '' : 's'}
          </span>
        </div>

        {loading && <div style={{ fontSize: 13, color: MUTED }}>Loading games…</div>}

        {!loading && games.length === 0 && (
          <div
            style={{
              background: PANEL_ALT,
              border: `1px solid ${BORDER}`,
              borderRadius: 10,
              padding: 16,
              textAlign: 'center',
              color: MUTED,
              fontSize: 13,
            }}
          >
            No games recorded yet.
          </div>
        )}

        {!loading && games.length > 0 && (
          <div
            style={{
              border: `1px solid ${BORDER}`,
              borderRadius: 10,
              overflow: 'hidden',
              background: PANEL_ALT,
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: PANEL, color: MUTED }}>
                  <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600 }}>Date</th>
                  <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600 }}>Result</th>
                  <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600 }}>Source</th>
                  <th style={{ textAlign: 'center', padding: '10px 14px', fontWeight: 600 }}>Synced</th>
                  <th style={{ padding: '10px 14px' }} />
                </tr>
              </thead>
              <tbody>
                {filtered.map((g) => (
                  <tr
                    key={g.id}
                    onClick={() => void handleClick(g)}
                    style={{ borderTop: `1px solid ${BORDER}`, cursor: 'pointer' }}
                  >
                    <td style={{ padding: '10px 14px', color: MUTED }}>
                      {new Date(g.createdAt).toLocaleDateString()}{' '}
                      <span style={{ color: '#4b5563' }}>
                        {new Date(g.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700 }}>
                      {g.result}
                    </td>
                    <td style={{ padding: '10px 14px', color: MUTED }}>{g.source}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                      {g.syncedToServer ? (
                        <span style={{ color: ACCENT }} title="Synced to cloud">
                          ☁
                        </span>
                      ) : (
                        <span style={{ color: '#4b5563' }} title="Local only">
                          —
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11 }}>
                      {copiedId === g.id ? (
                        <span style={{ color: ACCENT }}>Copied!</span>
                      ) : (
                        <span style={{ color: MUTED }}>{onOpen ? 'Open' : 'Copy PGN'}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
