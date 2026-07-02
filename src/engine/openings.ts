export interface RepertoireOption {
  id: string;
  title: string;              // e.g. "The Sharp Counterattack"
  name: string;               // e.g. "Sicilian Defense: Dragon Variation"
  style: 'aggressive' | 'solid' | 'positional' | 'tactical' | 'universal';
  moveSan: string;            // e.g. "c5"
  moveUci: string;            // e.g. "c7c5"
  eco: string;                // e.g. "B20"
  description: string;        // e.g. "Fights for central control asynchronously and prepares a fierce kingside attack."
  keyIdeas: string[];         // e.g. ["Exchange c-pawn for White's d-pawn", "Fianchetto dark-square bishop to g7"]
}

export interface OpeningRecommendation {
  openingName: string;
  eco: string;
  playerColor: 'w' | 'b';
  options: RepertoireOption[];
}

/**
 * Local prefix dictionary mapping FEN position signatures (placement + turn)
 * to structured master repertoires and counterattacks.
 */
const REPERTOIRE_BOOK: Record<string, OpeningRecommendation> = {
  // ─── Starting Position (Move 0, White to move) ───────────────────────────
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w': {
    openingName: 'Initial Position',
    eco: 'A00',
    playerColor: 'w',
    options: [
      {
        id: 'w-e4',
        title: 'The Tactical King',
        name: "King's Pawn Opening (1. e4)",
        style: 'aggressive',
        moveSan: 'e4',
        moveUci: 'e2e4',
        eco: 'B00',
        description: "Directly stakes a claim in the center and opens diagonals for the queen and king's bishop. Leads to sharp, tactical games like the Italian Game or King's Gambit.",
        keyIdeas: ['Develop kingside knight to f3 quickly', 'Prepare rapid castling', 'Aim for Italian Game (Bc4) or Ruy Lopez (Bb5)'],
      },
      {
        id: 'w-d4',
        title: 'The Positional Master',
        name: "Queen's Pawn Opening (1. d4)",
        style: 'positional',
        moveSan: 'd4',
        moveUci: 'd2d4',
        eco: 'D00',
        description: 'Creates a rock-solid, protected central pawn. Favored by World Champions for strategic control, leading to the Queen\'s Gambit or Catalan Opening.',
        keyIdeas: ['Follow up with c4 to pressure Black\'s center', 'Develop knight to c3', 'Control light squares across the board'],
      },
      {
        id: 'w-nf3',
        title: 'The Universal System',
        name: 'Reti Opening / London System (1. Nf3)',
        style: 'universal',
        moveSan: 'Nf3',
        moveUci: 'g1f3',
        eco: 'A04',
        description: 'A flexible hypermodern setup. Allows White to see Black\'s setup before committing central pawns, seamlessly transitioning into the invincible London System.',
        keyIdeas: ['Develop dark-squared bishop to f4 early', 'Build a solid pawn pyramid (d4-e3-c3)', 'Impenetrable structure against any Black defense'],
      },
    ],
  },

  // ─── Against 1. e4 (Black to move) ───────────────────────────────────────
  'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b': {
    openingName: "King's Pawn Opening",
    eco: 'B00',
    playerColor: 'b',
    options: [
      {
        id: 'b-sicilian',
        title: 'The Sharp Counterattack',
        name: 'Sicilian Defense (1... c5)',
        style: 'aggressive',
        moveSan: 'c5',
        moveUci: 'c7c5',
        eco: 'B20',
        description: 'The highest-scoring counterattack against 1. e4. Black fights for central control asynchronously by challenging the d4 square from the flank.',
        keyIdeas: ['Exchange flank c-pawn for White\'s central d-pawn', 'Open the half-open c-file for heavy piece attacks', 'Prepare dynamic Dragon or Najdorf formations'],
      },
      {
        id: 'b-caro',
        title: 'The Impenetrable Wall',
        name: 'Caro-Kann Defense (1... c6)',
        style: 'solid',
        moveSan: 'c6',
        moveUci: 'c7c6',
        eco: 'B10',
        description: 'An ultra-solid classical defense. Black prepares 2... d5 to challenge the center without blocking the light-squared bishop.',
        keyIdeas: ['Support the d5 central strike with c6', 'Develop the light-squared bishop to f5 or g4 before playing e6', 'Enjoy a healthy, weakness-free pawn structure'],
      },
      {
        id: 'b-e5',
        title: 'The Classical Challenge',
        name: 'Open Game (1... e5)',
        style: 'tactical',
        moveSan: 'e5',
        moveUci: 'e7e5',
        eco: 'C20',
        description: 'Meets force with force. Directly matches White\'s central space and opens diagonals for active tactical counter-gambits.',
        keyIdeas: ['Defend e5 with Nc6 when attacked by Nf3', 'Meet Bc4 (Italian Game) with active Nf6 (Two Knights Counterattack)', 'Fierce tactical battles in the center'],
      },
    ],
  },

  // ─── Against 1. d4 (Black to move) ───────────────────────────────────────
  'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b': {
    openingName: "Queen's Pawn Opening",
    eco: 'D00',
    playerColor: 'b',
    options: [
      {
        id: 'b-kid',
        title: 'The Hypermodern Fight',
        name: "King's Indian / Nimzo Counterattack (1... Nf6)",
        style: 'aggressive',
        moveSan: 'Nf6',
        moveUci: 'g8f6',
        eco: 'E00',
        description: 'Allows White to build a pawn center, then launches a devastating kingside counterattack with a fianchettoed bishop on g7.',
        keyIdeas: ['Fianchetto dark-squared bishop to g7 (g6, Bg7)', 'Castle kingside rapidly', 'Strike at White\'s center with e5 or c5 pawn breaks'],
      },
      {
        id: 'b-qgd',
        title: 'The Classical Shield',
        name: "Queen's Gambit Declined (1... e6)",
        style: 'solid',
        moveSan: 'e6',
        moveUci: 'e7e6',
        eco: 'D30',
        description: 'A grandmaster staple. Secures d5 with e6, refusing White\'s c4 gambit pawn while maintaining an unshakable foothold in the center.',
        keyIdeas: ['Maintain central d5 stronghold', 'Develop knight to f6 and bishop to e7', 'Prepare c5 pawn break later to liberate pieces'],
      },
      {
        id: 'b-slav',
        title: 'The Solid Slav Defense',
        name: 'Slav Defense (1... c6)',
        style: 'positional',
        moveSan: 'c6',
        moveUci: 'c7c6',
        eco: 'D10',
        description: 'Supports the d5 pawn with c6 instead of e6, keeping the diagonal open for Black\'s light-squared bishop to enter the active game.',
        keyIdeas: ['Support d5 without trapping the c8 bishop', 'Develop Bf5 or Bg4 actively', 'Super-solid pawn chain hard for White to crack'],
      },
    ],
  },

  // ─── Against 1. c4 / English Opening (Black to move) ─────────────────────
  'rnbqkbnr/pppppppp/8/8/2P5/8/PP1PPPPP/RNBQKBNR b': {
    openingName: 'English Opening',
    eco: 'A10',
    playerColor: 'b',
    options: [
      {
        id: 'b-eng-e5',
        title: 'The Reversed Sicilian',
        name: 'King\'s English Counterattack (1... e5)',
        style: 'tactical',
        moveSan: 'e5',
        moveUci: 'e7e5',
        eco: 'A20',
        description: 'Turns the tables on White by playing a Sicilian Defense with an extra tempo. Fights actively for the d4 square.',
        keyIdeas: ['Develop Nc6 and Nf6 rapidly', 'Challenge White\'s flank control with active piece play', 'Aim for d5 central pawn break'],
      },
      {
        id: 'b-eng-c5',
        title: 'The Symmetrical Wall',
        name: 'Symmetrical English Defense (1... c5)',
        style: 'solid',
        moveSan: 'c5',
        moveUci: 'c7c5',
        eco: 'A30',
        description: 'Mirrors White\'s setup to maintain strict positional balance and neutralizes White\'s early flank ambitions.',
        keyIdeas: ['Match White\'s pawn formation step-by-step', 'Fianchetto dark-squared bishop to g7', 'Control the d4 square tightly'],
      },
    ],
  },
};

/**
 * Given a full FEN string, returns structured opening repertoires or counterattacks
 * if the position matches our master book. Returns null once out of book.
 */
export function getOpeningRecommendations(fen: string): OpeningRecommendation | null {
  if (!fen) return null;
  // Extract just placement and active color (e.g., "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b")
  const parts = fen.trim().split(/\s+/);
  if (parts.length < 2) return null;
  const sig = `${parts[0]} ${parts[1]}`;
  return REPERTOIRE_BOOK[sig] || null;
}
