import React, { useState } from 'react';
import type { OpeningRecommendation, RepertoireOption } from '../engine/openings';
import { drawBestMoveArrow } from '../content/arrow';

interface Props {
  recommender: OpeningRecommendation;
  onSelectMove?: (uci: string) => void;
}

const STYLE_COLORS: Record<RepertoireOption['style'], { bg: string; text: string; border: string; icon: string }> = {
  aggressive: { bg: 'rgba(239,68,68,0.12)', text: '#f87171', border: 'rgba(239,68,68,0.3)', icon: '⚔️' },
  tactical: { bg: 'rgba(249,115,22,0.12)', text: '#fb923c', border: 'rgba(249,115,22,0.3)', icon: '🔥' },
  positional: { bg: 'rgba(59,130,246,0.12)', text: '#60a5fa', border: 'rgba(59,130,246,0.3)', icon: '🛡️' },
  solid: { bg: 'rgba(16,185,129,0.12)', text: '#34d399', border: 'rgba(16,185,129,0.3)', icon: '🧱' },
  universal: { bg: 'rgba(168,85,247,0.12)', text: '#c084fc', border: 'rgba(168,85,247,0.3)', icon: '🏰' },
};

export function OpeningRecommender({ recommender, onSelectMove }: Props) {
  const [selectedId, setSelectedId] = useState<string>(recommender.options[0]?.id || '');
  const selected = recommender.options.find((o) => o.id === selectedId) || recommender.options[0];

  const isWhite = recommender.playerColor === 'w';

  return (
    <div
      style={{
        margin: '10px 0',
        padding: '12px',
        borderRadius: '10px',
        background: 'linear-gradient(145deg, #111827 0%, #0f172a 100%)',
        border: '1px solid rgba(34,197,94,0.25)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 16 }}>{isWhite ? '📖' : '🛡️'}</span>
          <span style={{ fontWeight: 800, fontSize: 13, color: '#f3f4f6', letterSpacing: '0.02em' }}>
            {isWhite ? 'White Opening Repertoires' : 'Black Counterattack Shield'}
          </span>
        </div>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            padding: '2px 6px',
            borderRadius: 4,
            background: 'rgba(34,197,94,0.15)',
            color: '#4ade80',
            border: '1px solid rgba(34,197,94,0.3)',
            fontFamily: 'monospace',
          }}
        >
          [{recommender.eco}] {recommender.openingName}
        </span>
      </div>

      <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 10, lineHeight: 1.4 }}>
        {isWhite
          ? 'Choose your grandmaster opening plan to dictate the style of the game:'
          : 'White has launched an attack! Choose an active counter-strategy to equalize and fight back:'}
      </div>

      {/* Tabs / Pills for Options */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, overflowX: 'auto', paddingBottom: 2 }}>
        {recommender.options.map((opt) => {
          const st = STYLE_COLORS[opt.style] || STYLE_COLORS.solid;
          const isSelected = opt.id === selected?.id;
          return (
            <button
              key={opt.id}
              onClick={() => {
                setSelectedId(opt.id);
                drawBestMoveArrow(opt.moveUci);
                if (onSelectMove) onSelectMove(opt.moveUci);
              }}
              style={{
                flex: '1 1 auto',
                padding: '6px 10px',
                borderRadius: 7,
                border: `1px solid ${isSelected ? '#22c55e' : st.border}`,
                background: isSelected ? 'rgba(34,197,94,0.18)' : st.bg,
                color: isSelected ? '#4ade80' : st.text,
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              <span>{st.icon}</span>
              <span>{opt.moveSan}</span>
              <span style={{ fontSize: 10, opacity: 0.85 }}>({opt.title})</span>
            </button>
          );
        })}
      </div>

      {/* Selected Option Details */}
      {selected && (
        <div
          style={{
            padding: '10px',
            borderRadius: 8,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontWeight: 700, fontSize: 12, color: '#f9fafb' }}>
              {selected.name}
            </span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                textTransform: 'uppercase',
                padding: '1px 5px',
                borderRadius: 3,
                background: STYLE_COLORS[selected.style].bg,
                color: STYLE_COLORS[selected.style].text,
                border: `1px solid ${STYLE_COLORS[selected.style].border}`,
              }}
            >
              {selected.style}
            </span>
          </div>

          <p style={{ fontSize: 11, color: '#d1d5db', lineHeight: 1.4, marginBottom: 8, margin: '0 0 8px 0' }}>
            {selected.description}
          </p>

          <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', marginBottom: 4 }}>
            💡 Key Strategic Ideas:
          </div>
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: '#a78bfa', lineHeight: 1.5 }}>
            {selected.keyIdeas.map((idea, i) => (
              <li key={i}>{idea}</li>
            ))}
          </ul>

          <button
            onClick={() => {
              drawBestMoveArrow(selected.moveUci);
              if (onSelectMove) onSelectMove(selected.moveUci);
            }}
            style={{
              marginTop: 10,
              width: '100%',
              padding: '7px 0',
              borderRadius: 6,
              border: 'none',
              background: 'linear-gradient(90deg, #16a34a, #22c55e)',
              color: '#ffffff',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 10px rgba(34,197,94,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            🎯 Highlight {selected.moveSan} Arrow on Board
          </button>
        </div>
      )}
    </div>
  );
}
