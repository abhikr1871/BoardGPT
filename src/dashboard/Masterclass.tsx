import { useState } from 'react';
import { COURSES, type Course } from '../data/courses';

/**
 * Guided lessons. Renders the bundled courses (imported as JSON) as a list and,
 * once one is chosen, walks its teaching positions one step at a time: title,
 * the FEN shown as plain text, and the coaching point. Purely presentational —
 * no engine or board rendering required.
 */

const ACCENT = '#22c55e';
const PANEL = '#0f172a';
const PANEL_ALT = '#111827';
const BORDER = '#1f2937';
const TEXT = '#e5e7eb';
const MUTED = '#9ca3af';

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
  padding: '9px 16px',
  borderRadius: 8,
  border: `1px solid ${BORDER}`,
  background: 'transparent',
  color: TEXT,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

export function Masterclass() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  const course: Course | undefined = COURSES.find((c) => c.id === activeId);

  function openCourse(id: string) {
    setActiveId(id);
    setStep(0);
  }

  return (
    <div style={{ color: TEXT, fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: ACCENT, margin: '0 0 4px 0' }}>
          Masterclass
        </h1>
        <p style={{ fontSize: 12, color: MUTED, margin: '0 0 16px 0' }}>
          Short, guided lessons on essential patterns. Pick a course and step through each
          teaching position.
        </p>

        {/* Course picker */}
        {!course && (
          <div style={{ display: 'grid', gap: 10 }}>
            {COURSES.map((c) => (
              <button
                key={c.id}
                onClick={() => openCourse(c.id)}
                style={{
                  ...card,
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{c.title}</div>
                  <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
                    {c.steps.length} lesson{c.steps.length === 1 ? '' : 's'}
                  </div>
                </span>
                <span style={{ color: ACCENT, fontSize: 18, fontWeight: 700 }}>&rsaquo;</span>
              </button>
            ))}
            {COURSES.length === 0 && (
              <div style={{ ...card, color: MUTED, fontSize: 13 }}>No courses available.</div>
            )}
          </div>
        )}

        {/* Step viewer */}
        {course && (
          <div>
            <button
              style={{ ...ghostBtn, marginBottom: 12, padding: '6px 12px' }}
              onClick={() => setActiveId(null)}
            >
              &lsaquo; All courses
            </button>

            <div style={card}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  marginBottom: 12,
                }}
              >
                <span style={{ fontSize: 13, color: MUTED }}>{course.title}</span>
                <span style={{ fontSize: 12, color: MUTED }}>
                  Step {step + 1} of {course.steps.length}
                </span>
              </div>

              {course.steps[step] && (
                <>
                  <h2 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 10px 0' }}>
                    {course.steps[step].title}
                  </h2>

                  <div style={{ fontSize: 11, color: MUTED, marginBottom: 4 }}>Position (FEN)</div>
                  <div
                    style={{
                      fontSize: 12,
                      fontFamily: 'monospace',
                      color: TEXT,
                      background: PANEL,
                      border: `1px solid ${BORDER}`,
                      borderRadius: 6,
                      padding: '8px 10px',
                      marginBottom: 12,
                      wordBreak: 'break-all',
                    }}
                  >
                    {course.steps[step].fen}
                  </div>

                  <div
                    style={{
                      fontSize: 14,
                      lineHeight: 1.55,
                      color: '#d1d5db',
                      borderLeft: `3px solid ${ACCENT}`,
                      paddingLeft: 12,
                    }}
                  >
                    {course.steps[step].point}
                  </div>
                </>
              )}

              {/* Progress dots */}
              <div style={{ display: 'flex', gap: 6, marginTop: 16 }}>
                {course.steps.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setStep(i)}
                    aria-label={`Go to step ${i + 1}`}
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      border: 'none',
                      cursor: 'pointer',
                      background: i === step ? ACCENT : BORDER,
                    }}
                  />
                ))}
              </div>

              {/* Prev / Next */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
                <button
                  style={{ ...ghostBtn, opacity: step === 0 ? 0.4 : 1 }}
                  disabled={step === 0}
                  onClick={() => setStep((s) => Math.max(0, s - 1))}
                >
                  &lsaquo; Previous
                </button>
                {step < course.steps.length - 1 ? (
                  <button style={primaryBtn} onClick={() => setStep((s) => s + 1)}>
                    Next &rsaquo;
                  </button>
                ) : (
                  <button style={primaryBtn} onClick={() => setActiveId(null)}>
                    Finish
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
