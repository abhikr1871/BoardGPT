// Shared types used across the engine, UI and messaging layers.
// See blueprint §11 for the API/data schema this mirrors.

export type MoveLabel = 'BEST' | 'GOOD' | 'EQUAL';

/** A single ranked candidate move returned by the engine. */
export interface EngineLine {
  rank: number;
  /** UCI notation, e.g. "e2e4". */
  uci: string;
  /** Standard algebraic notation, e.g. "e4". */
  san: string;
  /** Evaluation in centipawns from the side-to-move's perspective. */
  cp: number;
  /** Mate distance in moves if the line is forced mate, else null. */
  mate: number | null;
  label: MoveLabel;
  /** Natural-language explanation (Claude or heuristic). */
  explanation?: string;
}

/** Result of analysing one position. Mirrors blueprint §11 response schema. */
export interface AnalysisResult {
  fen: string;
  /** Evaluation in pawns (not centipawns) for the eval bar. */
  evaluation: number;
  turn: 'w' | 'b';
  gamePhase: 'opening' | 'middlegame' | 'endgame';
  moves: EngineLine[];
  latencyMs: number;
  engine: 'stockfish' | 'builtin';
}

/** Post-game move classification symbols (blueprint §8). */
export type MoveQuality =
  | 'brilliant'
  | 'best'
  | 'good'
  | 'inaccuracy'
  | 'mistake'
  | 'blunder'
  | 'book';

export interface AnnotatedMove {
  ply: number;
  moveNumber: number;
  color: 'w' | 'b';
  san: string;
  fenBefore: string;
  fenAfter: string;
  evalBefore: number; // centipawns, white POV
  evalAfter: number; // centipawns, white POV
  bestSan: string;
  quality: MoveQuality;
  cpLoss: number;
  comment?: string;
}

export interface GameReview {
  pgn: string;
  opening?: string;
  result: string;
  moves: AnnotatedMove[];
  accuracy: { white: number; black: number };
  criticalMoments: number[]; // plies
  coachingSummary?: string;
}

export interface Settings {
  depth: number; // 10-22
  movesShown: 1 | 2 | 3;
  verbosity: 'brief' | 'detailed' | 'off';
  overlayPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  autoHideOpponentTurn: boolean;
  soundOnBlunder: boolean;
  anthropicApiKey: string;
  claudeModel: string;
  /** Auto-detect and analyze the live board on Chess.com. */
  liveAutoDetect: boolean;
  /** Backend base URL for game recording, e.g. http://localhost:3000. */
  apiBaseUrl: string;
  /** Optional bearer/JWT for the backend. */
  apiToken: string;
}

export const DEFAULT_SETTINGS: Settings = {
  depth: 18,
  movesShown: 3,
  verbosity: 'brief',
  overlayPosition: 'top-right',
  autoHideOpponentTurn: false,
  soundOnBlunder: true,
  anthropicApiKey: '',
  claudeModel: 'claude-sonnet-5',
  liveAutoDetect: true,
  apiBaseUrl: '',
  apiToken: '',
};

/** A recorded game payload sent to the backend. */
export interface GamePayload {
  id: string;
  pgn: string;
  result: string;
  source: string;
  createdAt: number;
}

// --- Messaging contract between content script and background worker ---
export type WorkerRequest =
  | { type: 'ANALYZE'; fen: string; depth?: number; multipv?: number }
  | { type: 'REVIEW_PGN'; pgn: string }
  | { type: 'GET_SETTINGS' }
  | { type: 'SAVE_SETTINGS'; settings: Partial<Settings> }
  | { type: 'SAVE_GAME'; game: GamePayload };

export type WorkerResponse =
  | { type: 'ANALYSIS'; result: AnalysisResult }
  | { type: 'REVIEW'; review: GameReview }
  | { type: 'SETTINGS'; settings: Settings }
  | { type: 'GAME_SAVED'; id: string; serverId?: string }
  | { type: 'ERROR'; message: string };
