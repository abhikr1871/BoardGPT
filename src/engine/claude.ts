import { Chess } from 'chess.js';
import type { EngineLine, Settings } from '../types';
import { formatEval } from '../lib/evaluation';

/**
 * Natural-language move explanations (blueprint §6). Uses the Anthropic API
 * when a key is configured in settings; otherwise generates a solid heuristic
 * explanation so the demo works with zero configuration.
 */

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

const SYSTEM_PROMPT =
  'You are a chess coach. Given a board position and candidate moves, ' +
  'explain each move in 2-3 sentences. Be concise. Use simple language. ' +
  'Mention threats, tactical motifs, and positional goals. ' +
  'Return one line per move in the form "SAN: explanation".';

export async function explainMoves(
  fen: string,
  moves: EngineLine[],
  pgnMoves: string,
  settings: Settings,
): Promise<EngineLine[]> {
  if (settings.verbosity === 'off' || moves.length === 0) return moves;

  // Tier 0 — on-device Chrome built-in AI (Gemini Nano). Free, private and
  // offline. Tried first; falls through silently when the API isn't present.
  try {
    const nano = await explainWithGeminiNano(fen, moves, settings);
    if (nano) return nano;
  } catch (e) {
    console.warn('[ChessAI] Gemini Nano unavailable, trying next tier:', e);
  }

  // Tier 1 — Anthropic Claude (when an API key is configured).
  if (settings.anthropicApiKey) {
    try {
      return await explainWithClaude(fen, moves, pgnMoves, settings);
    } catch (e) {
      console.warn('[ChessAI] Claude call failed, using heuristic:', e);
    }
  }

  // Tier 2 — rule-based heuristic (always available).
  return moves.map((m) => ({ ...m, explanation: heuristicExplanation(fen, m) }));
}

/**
 * Tier 0 explainer using Chrome's built-in on-device model (Gemini Nano) via
 * the Prompt API (`self.ai.languageModel`). Returns explanations for every move,
 * or null when the API is unavailable / not yet downloaded so callers can fall
 * back. Best-effort and defensive — never throws for missing capabilities.
 */
export async function explainWithGeminiNano(
  fen: string,
  moves: EngineLine[],
  settings: Settings,
): Promise<EngineLine[] | null> {
  const ai = (self as any).ai;
  if (!('ai' in self) || !ai?.languageModel) return null;

  // Only proceed when the model is actually usable on this device.
  try {
    const caps = await ai.languageModel.capabilities?.();
    if (caps && caps.available === 'no') return null;
  } catch {
    // Older builds may not expose capabilities(); attempt creation anyway.
  }

  let session: any;
  try {
    session = await ai.languageModel.create({ systemPrompt: SYSTEM_PROMPT });
  } catch {
    return null;
  }

  try {
    const chess = new Chess(fen);
    const color = chess.turn() === 'w' ? 'White' : 'Black';
    const detail = settings.verbosity === 'detailed' ? '3-4' : '2';
    const moveList = moves
      .map((m, i) => `${i + 1}. ${m.san} (eval: ${m.cp} centipawns)`)
      .join('\n');

    const prompt =
      `Position (FEN): ${fen}\n` +
      `Current player: ${color}\n\n` +
      `Engine top moves:\n${moveList}\n\n` +
      `Explain each move in ${detail} sentences. ` +
      `Return one line per move in the form "SAN: explanation".`;

    const text: string = await session.prompt(prompt);
    const perMove = parseExplanations(text ?? '', moves);
    return moves.map((m, i) => ({
      ...m,
      explanation: perMove[i] ?? heuristicExplanation(fen, m),
    }));
  } catch {
    return null;
  } finally {
    try {
      session?.destroy?.();
    } catch {
      // ignore cleanup errors
    }
  }
}

async function explainWithClaude(
  fen: string,
  moves: EngineLine[],
  pgnMoves: string,
  settings: Settings,
): Promise<EngineLine[]> {
  const chess = new Chess(fen);
  const color = chess.turn() === 'w' ? 'White' : 'Black';
  const detail = settings.verbosity === 'detailed' ? '3-4' : '2';
  const moveList = moves
    .map((m, i) => `${i + 1}. ${m.san} (eval: ${m.cp} centipawns)`)
    .join('\n');

  const userContent =
    `Position (FEN): ${fen}\n` +
    `Current player: ${color}\n` +
    `Move history: ${pgnMoves || '(none)'}\n\n` +
    `Engine top moves:\n${moveList}\n\n` +
    `Explain each move in ${detail} sentences.`;

  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': settings.anthropicApiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: settings.claudeModel,
      max_tokens: 600,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    }),
  });

  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text: string = data?.content?.[0]?.text ?? '';
  const perMove = parseExplanations(text, moves);
  return moves.map((m, i) => ({ ...m, explanation: perMove[i] ?? heuristicExplanation(fen, m) }));
}

/** Split the model output back into one explanation per move by matching SAN. */
function parseExplanations(text: string, moves: EngineLine[]): (string | undefined)[] {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  return moves.map((m) => {
    const match = lines.find((l) => l.includes(m.san));
    if (!match) return undefined;
    return match.replace(/^\d+\.\s*/, '').replace(new RegExp(`^${escapeRe(m.san)}\\s*[:\\-–]\\s*`), '').trim();
  });
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Rule-based explanation used when no API key is set. Inspects the move with
 * chess.js to describe captures, checks, castling, promotions, centralization,
 * and development in plain English.
 */
export function heuristicExplanation(fen: string, line: EngineLine): string {
  const chess = new Chess(fen);
  const from = line.uci.slice(0, 2);
  const to = line.uci.slice(2, 4);
  const promotion = line.uci.length > 4 ? line.uci[4] : undefined;

  let move;
  try {
    move = chess.move({ from, to, promotion });
  } catch {
    return `${line.san} is the engine's suggestion here (eval ${formatEval(line.cp, line.mate)}).`;
  }

  const parts: string[] = [];
  const pieceNames: Record<string, string> = {
    p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king',
  };
  const piece = pieceNames[move.piece];

  if (move.san === 'O-O') parts.push('Castles kingside, tucking the king to safety and connecting the rooks.');
  else if (move.san === 'O-O-O') parts.push('Castles queenside, activating the rook and safeguarding the king.');
  else if (move.captured) parts.push(`Captures the ${pieceNames[move.captured]} on ${to}, winning material or relieving pressure.`);
  else parts.push(`Develops the ${piece} to ${to}.`);

  if (move.promotion) parts.push(`Promotes to a ${pieceNames[move.promotion]}, a decisive material gain.`);
  if (chess.inCheck()) parts.push('It gives check, forcing an immediate response.');

  const central = ['d4', 'd5', 'e4', 'e5', 'c4', 'c5', 'f4', 'f5'];
  if (central.includes(to)) parts.push('It fights for central control and opens lines for the pieces.');

  const evalStr = formatEval(line.cp, line.mate);
  const verdict =
    line.mate !== null
      ? `Leads to forced mate (${evalStr}).`
      : line.cp >= 100
        ? `The engine rates this clearly favourable (${evalStr}).`
        : line.cp <= -100
          ? `The position stays difficult (${evalStr}), but this is the toughest defence.`
          : `The evaluation stays roughly balanced (${evalStr}).`;
  parts.push(verdict);

  return parts.join(' ');
}
