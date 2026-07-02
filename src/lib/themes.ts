/**
 * Overlay colour themes (Phase 4 UI/UX). Each theme drives the overlay chrome
 * (background, panel, accent, text) and the three board-arrow colours so the
 * whole experience recolours from a single `Settings.theme` id.
 *
 * `midnight` (Midnight OLED) is the default and the fallback for unknown ids.
 */

export interface Theme {
  id: string;
  name: string;
  /** App/overlay background. */
  bg: string;
  /** Inner panel / card background. */
  panelBg: string;
  /** Accent colour (buttons, highlights, active states). */
  accent: string;
  /** Primary text colour. */
  text: string;
  /** Best-move arrow colour. */
  arrowBest: string;
  /** Alternative-move arrow colour. */
  arrowAlt: string;
  /** Opponent-threat arrow colour. */
  arrowThreat: string;
}

export const THEMES: Theme[] = [
  {
    id: 'cyberpunk',
    name: 'Cyberpunk Neon',
    bg: '#0a0014',
    panelBg: '#160029',
    accent: '#f000ff',
    text: '#e6d5ff',
    arrowBest: 'rgba(0,255,209,0.9)',
    arrowAlt: 'rgba(0,183,255,0.85)',
    arrowThreat: 'rgba(240,0,255,0.8)',
  },
  {
    id: 'gold',
    name: 'Grandmaster Gold',
    bg: '#1a1408',
    panelBg: '#241b0c',
    accent: '#e0b53f',
    text: '#f5ecd6',
    arrowBest: 'rgba(224,181,63,0.9)',
    arrowAlt: 'rgba(96,165,250,0.85)',
    arrowThreat: 'rgba(239,68,68,0.8)',
  },
  {
    id: 'midnight',
    name: 'Midnight OLED',
    bg: '#0f1923',
    panelBg: '#111827',
    accent: '#22c55e',
    text: '#e5e7eb',
    arrowBest: 'rgba(34,197,94,0.9)',
    arrowAlt: 'rgba(59,130,246,0.85)',
    arrowThreat: 'rgba(239,68,68,0.8)',
  },
  {
    id: 'light',
    name: 'Classic Light',
    bg: '#f4f4f5',
    panelBg: '#ffffff',
    accent: '#16a34a',
    text: '#111827',
    arrowBest: 'rgba(22,163,74,0.9)',
    arrowAlt: 'rgba(37,99,235,0.85)',
    arrowThreat: 'rgba(220,38,38,0.8)',
  },
];

const DEFAULT_THEME_ID = 'midnight';

/** Resolve a theme by id, falling back to Midnight OLED for unknown ids. */
export function getTheme(id: string): Theme {
  return (
    THEMES.find((t) => t.id === id) ??
    THEMES.find((t) => t.id === DEFAULT_THEME_ID) ??
    THEMES[0]
  );
}
