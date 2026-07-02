import { useEffect, useMemo, useState } from 'react';
import { listMistakes, type Mistake } from '../lib/mistakeDB';
import {
  addTask,
  listTasks,
  removeTask,
  toggleTask,
  type StudyTask,
} from '../lib/studyTasks';

/**
 * Study Plan (Phase 5). A professional month calendar where the player
 * schedules training tasks. Everything is persisted locally through
 * {@link ../lib/studyTasks} (chrome.storage today, server later). Suggested
 * quick-adds are derived from the local mistake store so the plan nudges the
 * player toward their actual weak spots.
 */

const ACCENT = '#22c55e';
const PANEL = '#0f172a';
const PANEL_ALT = '#111827';
const BORDER = '#1f2937';
const TEXT = '#e5e7eb';
const MUTED = '#9ca3af';

type Category = StudyTask['category'];

const CATEGORIES: Category[] = ['tactics', 'openings', 'endgames', 'review', 'other'];

const CATEGORY_LABELS: Record<Category, string> = {
  tactics: 'Tactics',
  openings: 'Openings',
  endgames: 'Endgames',
  review: 'Review',
  other: 'Other',
};

const CATEGORY_COLORS: Record<Category, string> = {
  tactics: '#22c55e',
  openings: '#38bdf8',
  endgames: '#a78bfa',
  review: '#fbbf24',
  other: '#94a3b8',
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

// ---- Date helpers (no external libs) ---------------------------------------

/** Formats a Date as a local YYYY-MM-DD key (matching StudyTask.date). */
function toKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** Sunday that starts the week containing `d`. */
function startOfWeek(d: Date): Date {
  const s = startOfDay(d);
  return addDays(s, -s.getDay());
}

/** The 42 cells (6 weeks) covering the month grid that contains `viewDate`. */
function buildMonthGrid(viewDate: Date): Date[] {
  const first = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const gridStart = addDays(startOfDay(first), -first.getDay());
  const cells: Date[] = [];
  for (let i = 0; i < 42; i += 1) cells.push(addDays(gridStart, i));
  return cells;
}

// ---- Quick-add suggestions -------------------------------------------------

interface Suggestion {
  key: string;
  title: string;
  category: Category;
}

/**
 * Turns the local mistake tally into a short list of one-tap tasks. We always
 * offer the staples (review a game, endgame drill, opening prep) and surface a
 * dedicated tactics push when tactical mistakes dominate.
 */
function buildSuggestions(mistakes: Mistake[]): Suggestion[] {
  const suggestions: Suggestion[] = [];

  const tacticsCount = mistakes.filter(
    (m) => m.theme === 'tactics' || m.theme === 'hanging-piece',
  ).length;

  if (tacticsCount >= 3) {
    suggestions.push({
      key: 'practice-tactics',
      title: `Practice Tactics (${tacticsCount} logged)`,
      category: 'tactics',
    });
  }

  suggestions.push(
    { key: 'review-game', title: 'Review a game', category: 'review' },
    { key: 'endgame-drill', title: 'Endgame drill', category: 'endgames' },
    { key: 'opening-prep', title: 'Opening prep', category: 'openings' },
  );

  return suggestions;
}

// ---- Reusable styles -------------------------------------------------------

const ghostBtn: React.CSSProperties = {
  padding: '7px 12px',
  borderRadius: 8,
  border: `1px solid ${BORDER}`,
  background: 'transparent',
  color: TEXT,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
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

const card: React.CSSProperties = {
  background: PANEL_ALT,
  border: `1px solid ${BORDER}`,
  borderRadius: 10,
  padding: 16,
};

// ---- Component -------------------------------------------------------------

export function StudyPlan() {
  const today = useMemo(() => startOfDay(new Date()), []);
  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewDate, setViewDate] = useState<Date>(() => startOfDay(new Date()));
  const [selectedKey, setSelectedKey] = useState<string>(() => toKey(new Date()));
  const [draftTitle, setDraftTitle] = useState('');
  const [draftCategory, setDraftCategory] = useState<Category>('tactics');

  async function reload() {
    const list = await listTasks().catch(() => [] as StudyTask[]);
    setTasks(list);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [list, mistakes] = await Promise.all([
        listTasks().catch(() => [] as StudyTask[]),
        listMistakes().catch(() => [] as Mistake[]),
      ]);
      if (!cancelled) {
        setTasks(list);
        setSuggestions(buildSuggestions(mistakes));
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Group tasks by day for O(1) cell lookups.
  const tasksByDay = useMemo(() => {
    const map: Record<string, StudyTask[]> = {};
    for (const t of tasks) {
      (map[t.date] ??= []).push(t);
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => a.createdAt - b.createdAt);
    }
    return map;
  }, [tasks]);

  const cells = useMemo(() => buildMonthGrid(viewDate), [viewDate]);
  const todayKey = toKey(today);
  const selectedTasks = tasksByDay[selectedKey] ?? [];

  // Weekly progress spans the Sun–Sat week that contains the selected day.
  const weekProgress = useMemo(() => {
    const [y, m, d] = selectedKey.split('-').map(Number);
    const selected = new Date(y, (m ?? 1) - 1, d ?? 1);
    const weekStart = startOfWeek(selected);
    const keys = new Set<string>();
    for (let i = 0; i < 7; i += 1) keys.add(toKey(addDays(weekStart, i)));
    let total = 0;
    let done = 0;
    for (const t of tasks) {
      if (!keys.has(t.date)) continue;
      total += 1;
      if (t.done) done += 1;
    }
    return { total, done, weekStart, weekEnd: addDays(weekStart, 6) };
  }, [selectedKey, tasks]);

  const selectedLabel = useMemo(() => {
    const [y, m, d] = selectedKey.split('-').map(Number);
    const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
    return dt.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }, [selectedKey]);

  function goToMonth(delta: number) {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  }

  function goToday() {
    const now = startOfDay(new Date());
    setViewDate(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedKey(toKey(now));
  }

  function selectCell(cell: Date) {
    setSelectedKey(toKey(cell));
    // Keep the view on the month of the clicked day for out-of-month cells.
    if (cell.getMonth() !== viewDate.getMonth() || cell.getFullYear() !== viewDate.getFullYear()) {
      setViewDate(new Date(cell.getFullYear(), cell.getMonth(), 1));
    }
  }

  async function handleAdd() {
    const title = draftTitle.trim();
    if (!title) return;
    await addTask(selectedKey, title, draftCategory).catch(() => undefined);
    setDraftTitle('');
    await reload();
  }

  async function handleQuickAdd(s: Suggestion) {
    await addTask(selectedKey, s.title, s.category).catch(() => undefined);
    await reload();
  }

  async function handleToggle(id: string) {
    await toggleTask(id).catch(() => undefined);
    await reload();
  }

  async function handleRemove(id: string) {
    await removeTask(id).catch(() => undefined);
    await reload();
  }

  return (
    <div style={{ color: TEXT, fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
      <div style={{ maxWidth: 980, margin: '0 auto', padding: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: ACCENT, margin: '0 0 4px 0' }}>
          Study Plan
        </h1>
        <p style={{ fontSize: 12, color: MUTED, margin: '0 0 16px 0' }}>
          Schedule your training on the calendar. Tasks are saved on this device — click a day to
          plan it, tick things off as you go.
        </p>

        {loading && <div style={{ fontSize: 13, color: MUTED }}>Loading your calendar…</div>}

        {!loading && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1.6fr) minmax(280px, 1fr)',
              gap: 16,
              alignItems: 'start',
            }}
          >
            {/* Calendar */}
            <div style={card}>
              {/* Toolbar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 12,
                }}
              >
                <div style={{ fontSize: 16, fontWeight: 800 }}>
                  {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    style={{ ...ghostBtn, padding: '6px 10px' }}
                    onClick={() => goToMonth(-1)}
                    aria-label="Previous month"
                    title="Previous month"
                  >
                    ‹
                  </button>
                  <button style={{ ...ghostBtn, padding: '6px 12px' }} onClick={goToday}>
                    Today
                  </button>
                  <button
                    style={{ ...ghostBtn, padding: '6px 10px' }}
                    onClick={() => goToMonth(1)}
                    aria-label="Next month"
                    title="Next month"
                  >
                    ›
                  </button>
                </div>
              </div>

              {/* Weekday header */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 1fr)',
                  gap: 6,
                  marginBottom: 6,
                }}
              >
                {WEEKDAYS.map((w) => (
                  <div
                    key={w}
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: MUTED,
                      textAlign: 'center',
                      textTransform: 'uppercase',
                      letterSpacing: 0.4,
                    }}
                  >
                    {w}
                  </div>
                ))}
              </div>

              {/* Day grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 1fr)',
                  gap: 6,
                }}
              >
                {cells.map((cell) => {
                  const key = toKey(cell);
                  const inMonth = cell.getMonth() === viewDate.getMonth();
                  const isToday = key === todayKey;
                  const isSelected = key === selectedKey;
                  const dayTasks = tasksByDay[key] ?? [];
                  return (
                    <button
                      key={key}
                      onClick={() => selectCell(cell)}
                      style={{
                        position: 'relative',
                        minHeight: 74,
                        textAlign: 'left',
                        padding: 6,
                        borderRadius: 8,
                        cursor: 'pointer',
                        background: isSelected ? 'rgba(34,197,94,0.12)' : PANEL,
                        border: `1px solid ${
                          isSelected ? ACCENT : isToday ? 'rgba(34,197,94,0.45)' : BORDER
                        }`,
                        opacity: inMonth ? 1 : 0.4,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: isToday ? 800 : 600,
                            color: isToday ? ACCENT : inMonth ? TEXT : MUTED,
                          }}
                        >
                          {cell.getDate()}
                        </span>
                        {dayTasks.length > 0 && (
                          <span style={{ fontSize: 10, color: MUTED, fontWeight: 700 }}>
                            {dayTasks.filter((t) => t.done).length}/{dayTasks.length}
                          </span>
                        )}
                      </div>

                      {/* Task dots / pills */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                        {dayTasks.slice(0, 4).map((t) => (
                          <span
                            key={t.id}
                            title={`${CATEGORY_LABELS[t.category]}: ${t.title}`}
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: 999,
                              background: CATEGORY_COLORS[t.category],
                              opacity: t.done ? 0.4 : 1,
                            }}
                          />
                        ))}
                        {dayTasks.length > 4 && (
                          <span style={{ fontSize: 9, color: MUTED, lineHeight: '8px' }}>
                            +{dayTasks.length - 4}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Category legend */}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 12,
                  marginTop: 12,
                  paddingTop: 12,
                  borderTop: `1px solid ${BORDER}`,
                }}
              >
                {CATEGORIES.map((c) => (
                  <span
                    key={c}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: MUTED }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 999,
                        background: CATEGORY_COLORS[c],
                      }}
                    />
                    {CATEGORY_LABELS[c]}
                  </span>
                ))}
              </div>
            </div>

            {/* Day panel */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Weekly progress summary */}
              <div style={card}>
                <div style={{ fontSize: 12, color: MUTED, marginBottom: 6, fontWeight: 700 }}>
                  This week
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: ACCENT }}>
                  {weekProgress.done}
                  <span style={{ fontSize: 14, color: MUTED, fontWeight: 700 }}>
                    {' '}
                    / {weekProgress.total} done
                  </span>
                </div>
                <div
                  style={{
                    marginTop: 8,
                    height: 8,
                    borderRadius: 999,
                    background: PANEL,
                    border: `1px solid ${BORDER}`,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${
                        weekProgress.total > 0
                          ? Math.round((weekProgress.done / weekProgress.total) * 100)
                          : 0
                      }%`,
                      background: ACCENT,
                    }}
                  />
                </div>
                <div style={{ fontSize: 11, color: MUTED, marginTop: 6 }}>
                  {weekProgress.weekStart.toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  })}{' '}
                  –{' '}
                  {weekProgress.weekEnd.toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  })}
                </div>
              </div>

              {/* Selected day tasks + add form */}
              <div style={card}>
                <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 2 }}>{selectedLabel}</div>
                <div style={{ fontSize: 11, color: MUTED, marginBottom: 12 }}>
                  {selectedTasks.length === 0
                    ? 'No tasks scheduled.'
                    : `${selectedTasks.length} task${selectedTasks.length === 1 ? '' : 's'} scheduled.`}
                </div>

                {/* Task list */}
                {selectedTasks.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                    {selectedTasks.map((t) => (
                      <div
                        key={t.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          background: PANEL,
                          border: `1px solid ${t.done ? 'rgba(34,197,94,0.4)' : BORDER}`,
                          borderRadius: 8,
                          padding: '8px 10px',
                        }}
                      >
                        <button
                          onClick={() => void handleToggle(t.id)}
                          aria-label={t.done ? 'Mark not done' : 'Mark done'}
                          style={{
                            width: 20,
                            height: 20,
                            flexShrink: 0,
                            borderRadius: 6,
                            border: `1px solid ${t.done ? ACCENT : BORDER}`,
                            background: t.done ? ACCENT : 'transparent',
                            color: '#0b1120',
                            fontSize: 12,
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {t.done ? '✓' : ''}
                        </button>
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            flexShrink: 0,
                            borderRadius: 999,
                            background: CATEGORY_COLORS[t.category],
                          }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              textDecoration: t.done ? 'line-through' : 'none',
                              color: t.done ? MUTED : TEXT,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {t.title}
                          </div>
                          <div style={{ fontSize: 10, color: MUTED }}>
                            {CATEGORY_LABELS[t.category]}
                          </div>
                        </div>
                        <button
                          onClick={() => void handleRemove(t.id)}
                          aria-label="Delete task"
                          title="Delete task"
                          style={{
                            flexShrink: 0,
                            border: 'none',
                            background: 'transparent',
                            color: MUTED,
                            fontSize: 16,
                            lineHeight: 1,
                            cursor: 'pointer',
                            padding: 2,
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add task form */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    placeholder="Add a task (e.g. 20 tactics puzzles)"
                    spellCheck={false}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleAdd();
                    }}
                    style={{
                      padding: '9px 12px',
                      borderRadius: 8,
                      border: `1px solid ${BORDER}`,
                      background: PANEL,
                      color: TEXT,
                      fontSize: 13,
                      outline: 'none',
                    }}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <select
                      value={draftCategory}
                      onChange={(e) => setDraftCategory(e.target.value as Category)}
                      style={{
                        flex: 1,
                        padding: '9px 10px',
                        borderRadius: 8,
                        border: `1px solid ${BORDER}`,
                        background: PANEL,
                        color: TEXT,
                        fontSize: 13,
                        outline: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {CATEGORY_LABELS[c]}
                        </option>
                      ))}
                    </select>
                    <button
                      style={{ ...primaryBtn, opacity: draftTitle.trim() ? 1 : 0.5 }}
                      disabled={!draftTitle.trim()}
                      onClick={() => void handleAdd()}
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>

              {/* Quick-add suggestions */}
              <div style={card}>
                <div style={{ fontSize: 12, color: MUTED, marginBottom: 10, fontWeight: 700 }}>
                  Suggested tasks
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {suggestions.map((s) => (
                    <button
                      key={s.key}
                      onClick={() => void handleQuickAdd(s)}
                      title={`Add "${s.title}" to ${selectedLabel}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '6px 10px',
                        borderRadius: 999,
                        border: `1px solid ${BORDER}`,
                        background: PANEL,
                        color: TEXT,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 999,
                          background: CATEGORY_COLORS[s.category],
                        }}
                      />
                      {s.title}
                      <span style={{ color: MUTED, fontWeight: 800 }}>+</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
