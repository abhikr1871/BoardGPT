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
 *
 * Keys are `"<placement> <sideToMove>"` (the first two FEN fields). Every key
 * and every moveUci/moveSan below was generated and verified with chess.js so
 * recommendations keep appearing as the opening develops through moves 3-6.
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
      {
        id: 'b-eng-nf6',
        title: 'The Flexible Indian',
        name: 'Anglo-Indian Defense (1... Nf6)',
        style: 'universal',
        moveSan: 'Nf6',
        moveUci: 'g8f6',
        eco: 'A15',
        description: 'Develops naturally and keeps every structure open, ready to transpose into King\'s Indian, Nimzo, or Queen\'s Indian setups.',
        keyIdeas: ['Delay committing central pawns until White shows a plan', 'Keep the option of ...e5, ...d5, or a kingside fianchetto', 'Punish an early d4 by transposing to a favorite Indian defense'],
      },
    ],
  },

  // ─── Against 1. Nf3 / Reti (Black to move) ───────────────────────────────
  'rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b': {
    openingName: 'Reti Opening',
    eco: 'A04',
    playerColor: 'b',
    options: [
      {
        id: 'b-reti-d5',
        title: 'The Classical Center',
        name: 'Reti Opening: 1... d5',
        style: 'solid',
        moveSan: 'd5',
        moveUci: 'd7d5',
        eco: 'A06',
        description: 'Grabs the center immediately and dares White to prove the point of a flank strategy. The most principled reply to the Reti.',
        keyIdeas: ['Claim central space with the d5 pawn', 'Develop pieces around a firm center', 'Meet a later c4 with ...e6 or ...c6 support'],
      },
      {
        id: 'b-reti-nf6',
        title: 'The Symmetrical Response',
        name: 'Reti Opening: 1... Nf6',
        style: 'universal',
        moveSan: 'Nf6',
        moveUci: 'g8f6',
        eco: 'A05',
        description: 'Mirrors White\'s flexible development, keeping all options open and inviting a transposition into familiar territory.',
        keyIdeas: ['Match White tempo for tempo', 'Stay flexible for a King\'s Indian or Queen\'s Indian setup', 'Contest the center only once White commits'],
      },
      {
        id: 'b-reti-c5',
        title: 'The Reversed Flank Attack',
        name: 'Reti Opening: 1... c5',
        style: 'aggressive',
        moveSan: 'c5',
        moveUci: 'c7c5',
        eco: 'A04',
        description: 'Fights for the d4 square from the flank, aiming for an active Symmetrical-English structure with the initiative.',
        keyIdeas: ['Stake a claim on the d4 square', 'Develop actively with Nc6 and g6/Bg7', 'Pressure the queenside on the half-open c-file'],
      },
    ],
  },

  // ─── After 1. e4 e5 (White to move) ──────────────────────────────────────
  'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w': {
    openingName: 'Open Game',
    eco: 'C20',
    playerColor: 'w',
    options: [
      {
        id: 'w-oe5-nf3',
        title: 'The Main Line',
        name: "King's Knight Opening (2. Nf3)",
        style: 'universal',
        moveSan: 'Nf3',
        moveUci: 'g1f3',
        eco: 'C40',
        description: 'The best move in the position: it develops with tempo by attacking the e5 pawn and prepares the Italian Game or Ruy Lopez.',
        keyIdeas: ['Attack e5 immediately and gain a developing tempo', 'Prepare kingside castling', 'Steer toward Italian (Bc4) or Ruy Lopez (Bb5)'],
      },
      {
        id: 'w-oe5-bc4',
        title: 'The Quick Bishop',
        name: 'Bishop\'s Opening (2. Bc4)',
        style: 'aggressive',
        moveSan: 'Bc4',
        moveUci: 'f1c4',
        eco: 'C23',
        description: 'Trains the bishop on the sensitive f7 square right away and keeps flexible move orders to sidestep well-prepared defenses.',
        keyIdeas: ['Eye the weak f7 pawn early', 'Support a later d3 and Nf3 setup', 'Avoid heavily analyzed Petroff lines'],
      },
      {
        id: 'w-oe5-f4',
        title: 'The Romantic Gambit',
        name: "King's Gambit (2. f4)",
        style: 'tactical',
        moveSan: 'f4',
        moveUci: 'f2f4',
        eco: 'C30',
        description: 'A daring pawn sacrifice that rips open the f-file and leads to razor-sharp attacking play in return for the center.',
        keyIdeas: ['Sacrifice the f-pawn to seize the center', 'Open the f-file for a rook-fueled attack', 'Play for rapid development and initiative'],
      },
    ],
  },

  // ─── After 1. e4 e5 2. Nf3 (Black to move) ───────────────────────────────
  'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b': {
    openingName: "King's Knight Opening",
    eco: 'C40',
    playerColor: 'b',
    options: [
      {
        id: 'b-oe5-nc6',
        title: 'The Classical Defense',
        name: 'Open Game: 2... Nc6',
        style: 'tactical',
        moveSan: 'Nc6',
        moveUci: 'b8c6',
        eco: 'C44',
        description: 'The most natural reply, defending the e5 pawn and heading into the Italian Game, Ruy Lopez, and Scotch main lines.',
        keyIdeas: ['Defend the e5 pawn with the knight', 'Develop toward the center actively', 'Prepare ...Nf6 and rapid kingside castling'],
      },
      {
        id: 'b-oe5-nf6',
        title: 'The Petroff Counter',
        name: 'Petroff Defense (2... Nf6)',
        style: 'solid',
        moveSan: 'Nf6',
        moveUci: 'g8f6',
        eco: 'C42',
        description: 'Counterattacks e4 instead of defending e5, leading to symmetrical, rock-solid positions that are notoriously hard to crack.',
        keyIdeas: ['Hit the e4 pawn with a counterattack', 'Aim for a symmetrical, safe structure', 'Neutralize White\'s initiative through trades'],
      },
      {
        id: 'b-oe5-d6',
        title: 'The Solid Philidor',
        name: 'Philidor Defense (2... d6)',
        style: 'positional',
        moveSan: 'd6',
        moveUci: 'd7d6',
        eco: 'C41',
        description: 'A compact, resilient setup that reinforces e5 and builds a flexible pawn structure while avoiding sharp theory.',
        keyIdeas: ['Support the e5 pawn with d6', 'Develop behind a solid pawn shell', 'Prepare a later ...c6 and ...d5 break'],
      },
    ],
  },

  // ─── After 1. e4 e5 2. Nf3 Nc6 (White to move) ───────────────────────────
  'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w': {
    openingName: 'Open Game: Knights Developed',
    eco: 'C40',
    playerColor: 'w',
    options: [
      {
        id: 'w-nc6-bb5',
        title: 'The Spanish Torture',
        name: 'Ruy Lopez (3. Bb5)',
        style: 'positional',
        moveSan: 'Bb5',
        moveUci: 'f1b5',
        eco: 'C60',
        description: 'The most respected reply, pinning the knight that defends e5 and creating long-term positional pressure prized by champions.',
        keyIdeas: ['Pressure the c6 knight defending e5', 'Prepare c3 and d4 for a big center', 'Play a slow, strategic squeeze'],
      },
      {
        id: 'w-nc6-bc4',
        title: 'The Italian Game',
        name: 'Italian Game (3. Bc4)',
        style: 'aggressive',
        moveSan: 'Bc4',
        moveUci: 'f1c4',
        eco: 'C50',
        description: 'Points the bishop at f7 and heads for the classical Giuoco Piano or the sharp Evans Gambit and Fried Liver attacks.',
        keyIdeas: ['Target the f7 square', 'Build a center with c3 and d4', 'Choose calm (d3) or sharp (Evans Gambit) plans'],
      },
      {
        id: 'w-nc6-d4',
        title: 'The Open Center',
        name: 'Scotch Game (3. d4)',
        style: 'tactical',
        moveSan: 'd4',
        moveUci: 'd2d4',
        eco: 'C44',
        description: 'Strikes in the center at once, opening lines for quick development and avoiding the heavy theory of the Ruy Lopez.',
        keyIdeas: ['Open the center immediately with d4', 'Free the pieces for fast development', 'Trade the e-pawn to gain time on Black\'s knight'],
      },
    ],
  },

  // ─── After 1. e4 c5 (White to move) ──────────────────────────────────────
  'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w': {
    openingName: 'Sicilian Defense',
    eco: 'B20',
    playerColor: 'w',
    options: [
      {
        id: 'w-sic-nf3',
        title: 'The Open Sicilian',
        name: 'Open Sicilian (2. Nf3)',
        style: 'aggressive',
        moveSan: 'Nf3',
        moveUci: 'g1f3',
        eco: 'B27',
        description: 'The main line, preparing d4 to blow open the center and enter the most theory-rich, double-edged battlegrounds in chess.',
        keyIdeas: ['Prepare an early d4 to open the position', 'Fight for a lasting central and kingside initiative', 'Steer toward Najdorf, Dragon, or Sveshnikov main lines'],
      },
      {
        id: 'w-sic-bb5',
        title: 'The Rossolimo',
        name: 'Rossolimo Variation (2. Nf3 then Bb5)',
        style: 'positional',
        moveSan: 'Nf3',
        moveUci: 'g1f3',
        eco: 'B30',
        description: 'A low-theory anti-Sicilian setup: after ...Nc6 White plays Bb5 to swap on c6, damaging Black\'s structure and simplifying the fight.',
        keyIdeas: ['Aim for Bb5 to trade off the c6 knight', 'Saddle Black with doubled c-pawns', 'Avoid memorizing dense Open Sicilian theory'],
      },
      {
        id: 'w-sic-nc3',
        title: 'The Closed Sicilian',
        name: 'Closed Sicilian (2. Nc3)',
        style: 'positional',
        moveSan: 'Nc3',
        moveUci: 'b1c3',
        eco: 'B23',
        description: 'Keeps the center closed and builds a kingside attack with g3, Bg2, and f4, sidestepping the tactical Open Sicilian entirely.',
        keyIdeas: ['Keep the pawn tension and play positionally', 'Fianchetto with g3 and Bg2', 'Expand on the kingside with f4-f5'],
      },
    ],
  },

  // ─── After 1. e4 c5 2. Nf3 (Black to move) ───────────────────────────────
  'rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b': {
    openingName: 'Sicilian Defense: 2. Nf3',
    eco: 'B27',
    playerColor: 'b',
    options: [
      {
        id: 'b-sic2-d6',
        title: 'The Najdorf Setup',
        name: 'Sicilian: 2... d6',
        style: 'aggressive',
        moveSan: 'd6',
        moveUci: 'd7d6',
        eco: 'B50',
        description: 'The flexible move behind the famous Najdorf and Dragon, controlling e5 and preparing ...Nf6 with a resilient counterattacking structure.',
        keyIdeas: ['Control the e5 square', 'Prepare ...Nf6 and a queenside expansion', 'Head for a Najdorf or Dragon setup'],
      },
      {
        id: 'b-sic2-nc6',
        title: 'The Classical Development',
        name: 'Sicilian: 2... Nc6',
        style: 'tactical',
        moveSan: 'Nc6',
        moveUci: 'b8c6',
        eco: 'B30',
        description: 'Develops naturally toward the center and keeps the door open to the Sveshnikov and Classical Sicilian systems.',
        keyIdeas: ['Develop with pressure on d4', 'Keep options for ...e5 (Sveshnikov) or ...g6', 'Fight for central squares actively'],
      },
      {
        id: 'b-sic2-e6',
        title: 'The Solid Taimanov',
        name: 'Sicilian: 2... e6',
        style: 'solid',
        moveSan: 'e6',
        moveUci: 'e7e6',
        eco: 'B40',
        description: 'A flexible, sturdy move preparing ...d5 and heading for the Taimanov or Kan systems with a compact pawn structure.',
        keyIdeas: ['Prepare a central ...d5 break', 'Develop the light-squared bishop freely', 'Keep a solid, flexible pawn shape'],
      },
    ],
  },

  // ─── After 1. e4 c5 2. Nf3 d6 3. d4 (Black to move) ──────────────────────
  'rnbqkbnr/pp2pppp/3p4/2p5/3PP3/5N2/PPP2PPP/RNBQKB1R b': {
    openingName: 'Open Sicilian',
    eco: 'B50',
    playerColor: 'b',
    options: [
      {
        id: 'b-sic3-cxd4',
        title: 'The Main Capture',
        name: 'Open Sicilian: 3... cxd4',
        style: 'aggressive',
        moveSan: 'cxd4',
        moveUci: 'c5d4',
        eco: 'B50',
        description: 'The principled trade of the wing c-pawn for White\'s central d-pawn, opening the c-file and reaching the heart of the Open Sicilian.',
        keyIdeas: ['Swap the c-pawn for the central d-pawn', 'Open the half-open c-file for the rooks', 'Prepare ...Nf6 and a Najdorf/Scheveningen structure'],
      },
      {
        id: 'b-sic3-nf6',
        title: 'The Central Strike',
        name: 'Open Sicilian: 3... Nf6',
        style: 'tactical',
        moveSan: 'Nf6',
        moveUci: 'g8f6',
        eco: 'B50',
        description: 'Immediately attacks the e4 pawn, forcing White to defend and gaining a developing tempo before recapturing on d4.',
        keyIdeas: ['Hit the e4 pawn with tempo', 'Provoke Nc3 or a defensive move from White', 'Keep the dynamic Sicilian tension'],
      },
    ],
  },

  // ─── After 1. e4 c6 (White to move) ──────────────────────────────────────
  'rnbqkbnr/pp1ppppp/2p5/8/4P3/8/PPPP1PPP/RNBQKBNR w': {
    openingName: 'Caro-Kann Defense',
    eco: 'B10',
    playerColor: 'w',
    options: [
      {
        id: 'w-caro-d4',
        title: 'The Main Line',
        name: 'Caro-Kann: 2. d4',
        style: 'positional',
        moveSan: 'd4',
        moveUci: 'd2d4',
        eco: 'B12',
        description: 'Builds the ideal broad pawn center and invites 2... d5, leading to the classical Advance and Exchange main lines.',
        keyIdeas: ['Occupy the center with e4 and d4', 'Prepare Nc3/Nd2 to support e4', 'Choose Advance (e5) or classical structures'],
      },
      {
        id: 'w-caro-nc3',
        title: 'The Two Knights',
        name: 'Caro-Kann: 2. Nc3',
        style: 'aggressive',
        moveSan: 'Nc3',
        moveUci: 'b1c3',
        eco: 'B11',
        description: 'A flexible developing move preparing Nf3 for the Two Knights, keeping the game fresh and steering away from heavy main-line theory.',
        keyIdeas: ['Develop the knight and defend e4', 'Follow with Nf3 for the Two Knights setup', 'Provoke ...d5 and gain quick development'],
      },
      {
        id: 'w-caro-nf3',
        title: 'The Flexible Knight',
        name: 'Caro-Kann: 2. Nf3',
        style: 'universal',
        moveSan: 'Nf3',
        moveUci: 'g1f3',
        eco: 'B10',
        description: 'Prepares d4 with a flexible move order, keeping options open to transpose into main lines or quieter systems.',
        keyIdeas: ['Support a later d4 push', 'Keep a flexible, low-theory move order', 'Develop naturally toward kingside castling'],
      },
    ],
  },

  // ─── After 1. e4 c6 2. d4 d5 (White to move) ─────────────────────────────
  'rnbqkbnr/pp2pppp/2p5/3p4/3PP3/8/PPP2PPP/RNBQKBNR w': {
    openingName: 'Caro-Kann Defense: Main Line',
    eco: 'B12',
    playerColor: 'w',
    options: [
      {
        id: 'w-caro2-nc3',
        title: 'The Classical Main Line',
        name: 'Caro-Kann: 3. Nc3',
        style: 'positional',
        moveSan: 'Nc3',
        moveUci: 'b1c3',
        eco: 'B15',
        description: 'Defends e4 and invites the classical 3... dxe4, after which White recaptures with the knight and enjoys smooth, harmonious development.',
        keyIdeas: ['Defend the e4 pawn with the knight', 'Recapture on e4 to keep central presence', 'Aim for easy piece development and a slight space edge'],
      },
      {
        id: 'w-caro2-e5',
        title: 'The Advance Variation',
        name: 'Caro-Kann: 3. e5 (Advance)',
        style: 'aggressive',
        moveSan: 'e5',
        moveUci: 'e4e5',
        eco: 'B12',
        description: 'Grabs space by pushing past and clamps down on Black\'s position, targeting the light-squared bishop before it gets active.',
        keyIdeas: ['Seize a big space advantage with e5', 'Restrict the c8 bishop after ...Bf5', 'Play c3 and build a kingside attack'],
      },
      {
        id: 'w-caro2-exd5',
        title: 'The Exchange Variation',
        name: 'Caro-Kann: 3. exd5 (Exchange)',
        style: 'solid',
        moveSan: 'exd5',
        moveUci: 'e4d5',
        eco: 'B13',
        description: 'Releases the central tension for a clear, easy-to-handle structure that sidesteps sharp theory while keeping a pleasant edge.',
        keyIdeas: ['Simplify into a clear pawn structure', 'Develop with Bd3, c3, and Nf3', 'Play a comfortable, low-risk middlegame'],
      },
    ],
  },

  // ─── After 1. e4 e6 (White to move) ──────────────────────────────────────
  'rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR w': {
    openingName: 'French Defense',
    eco: 'C00',
    playerColor: 'w',
    options: [
      {
        id: 'w-fr-d4',
        title: 'The Main Line',
        name: 'French Defense: 2. d4',
        style: 'positional',
        moveSan: 'd4',
        moveUci: 'd2d4',
        eco: 'C00',
        description: 'Builds the classic big center and invites 2... d5, leading to the rich Advance, Tarrasch, and Winawer main lines.',
        keyIdeas: ['Establish a broad e4-d4 center', 'Prepare Nc3 or Nd2 to support e4', 'Choose Advance (e5) or classical setups'],
      },
      {
        id: 'w-fr-nc3',
        title: 'The Sharp Attack',
        name: 'French Defense: 2. d4 then Nc3',
        style: 'aggressive',
        moveSan: 'Nc3',
        moveUci: 'b1c3',
        eco: 'C10',
        description: 'Develops toward the classical and Winawer main lines, defending e4 actively and keeping maximum attacking potential on the kingside.',
        keyIdeas: ['Defend e4 while developing', 'Head for classical or Winawer battles', 'Play for a kingside pawn storm'],
      },
      {
        id: 'w-fr-nf3',
        title: 'The Flexible System',
        name: 'French Defense: 2. Nf3',
        style: 'universal',
        moveSan: 'Nf3',
        moveUci: 'g1f3',
        eco: 'C00',
        description: 'A calm, flexible developing move that prepares d4 and keeps quiet King\'s Indian Attack setups on the table.',
        keyIdeas: ['Prepare d4 with a flexible order', 'Keep the King\'s Indian Attack available', 'Sidestep heavily analyzed French theory'],
      },
    ],
  },

  // ─── After 1. d4 d5 (White to move) ──────────────────────────────────────
  'rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w': {
    openingName: "Queen's Pawn Game",
    eco: 'D00',
    playerColor: 'w',
    options: [
      {
        id: 'w-qp-c4',
        title: "The Queen's Gambit",
        name: "Queen's Gambit (2. c4)",
        style: 'positional',
        moveSan: 'c4',
        moveUci: 'c2c4',
        eco: 'D06',
        description: 'The classical main line: it challenges Black\'s d5 pawn from the flank and fights for the center in the most respected way.',
        keyIdeas: ['Pressure the d5 pawn from the flank', 'Open lines if Black captures on c4', 'Aim for a lasting central and space advantage'],
      },
      {
        id: 'w-qp-nf3',
        title: 'The Flexible Move Order',
        name: "Queen's Pawn: 2. Nf3",
        style: 'universal',
        moveSan: 'Nf3',
        moveUci: 'g1f3',
        eco: 'D02',
        description: 'Develops a piece and keeps the c4 break in reserve, allowing transpositions into the Queen\'s Gambit or a quiet system.',
        keyIdeas: ['Develop naturally before committing pawns', 'Keep c4 and London options open', 'Steer toward a familiar structure'],
      },
      {
        id: 'w-qp-bf4',
        title: 'The London System',
        name: 'London System (2. Bf4)',
        style: 'solid',
        moveSan: 'Bf4',
        moveUci: 'c1f4',
        eco: 'D02',
        description: 'A rock-solid, easy-to-learn setup that develops the bishop outside the pawn chain and yields a durable, harmonious position against nearly anything.',
        keyIdeas: ['Develop the bishop to f4 before e3', 'Build the classic e3-d4-c3 pyramid', 'Play a reliable, low-theory system'],
      },
    ],
  },

  // ─── After 1. d4 d5 2. c4 (Black to move) ────────────────────────────────
  'rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR b': {
    openingName: "Queen's Gambit",
    eco: 'D06',
    playerColor: 'b',
    options: [
      {
        id: 'b-qg-e6',
        title: 'The Classical Decline',
        name: "Queen's Gambit Declined (2... e6)",
        style: 'solid',
        moveSan: 'e6',
        moveUci: 'e7e6',
        eco: 'D30',
        description: 'The most reliable defense: it firmly supports d5 and builds an unshakable classical structure trusted at the highest level.',
        keyIdeas: ['Reinforce the d5 stronghold', 'Develop with Nf6 and Be7', 'Prepare a later ...c5 to free the position'],
      },
      {
        id: 'b-qg-c6',
        title: 'The Solid Slav',
        name: 'Slav Defense (2... c6)',
        style: 'positional',
        moveSan: 'c6',
        moveUci: 'c7c6',
        eco: 'D10',
        description: 'Supports d5 with the c-pawn, keeping the light-squared bishop\'s diagonal open for active development.',
        keyIdeas: ['Support d5 without blocking the c8 bishop', 'Develop Bf5 or Bg4 actively', 'Build a super-solid pawn chain'],
      },
      {
        id: 'b-qg-dxc4',
        title: 'The Accepted Gambit',
        name: "Queen's Gambit Accepted (2... dxc4)",
        style: 'tactical',
        moveSan: 'dxc4',
        moveUci: 'd5c4',
        eco: 'D20',
        description: 'Takes the gambit pawn to open lines and gain quick, active piece play, planning to return the pawn for smooth development.',
        keyIdeas: ['Grab the c4 pawn to open the position', 'Develop rapidly with ...Nf6 and ...e6', 'Aim for a timely ...c5 break in the center'],
      },
    ],
  },

  // ─── After 1. d4 Nf6 (White to move) ─────────────────────────────────────
  'rnbqkb1r/pppppppp/5n2/8/3P4/8/PPP1PPPP/RNBQKBNR w': {
    openingName: 'Indian Defense',
    eco: 'A45',
    playerColor: 'w',
    options: [
      {
        id: 'w-ind-c4',
        title: 'The Main Line',
        name: 'Indian Defense: 2. c4',
        style: 'positional',
        moveSan: 'c4',
        moveUci: 'c2c4',
        eco: 'E00',
        description: 'The principled central grab, staking out space and heading for the great King\'s Indian, Nimzo-Indian, and Queen\'s Indian battlegrounds.',
        keyIdeas: ['Build a strong c4-d4 center', 'Develop Nc3 to control central squares', 'Enter mainstream Indian Defense theory'],
      },
      {
        id: 'w-ind-nf3',
        title: 'The Flexible System',
        name: 'Indian Defense: 2. Nf3',
        style: 'universal',
        moveSan: 'Nf3',
        moveUci: 'g1f3',
        eco: 'A46',
        description: 'Develops a piece and keeps every structure in reserve, ready to add c4 for a main line or slot into a London/Catalan setup.',
        keyIdeas: ['Develop before committing central pawns', 'Keep c4, London, and Catalan options open', 'Prevent an early ...e5 freeing break'],
      },
      {
        id: 'w-ind-bg5',
        title: 'The Trompowsky Attack',
        name: 'Trompowsky Attack (2. Bg5)',
        style: 'aggressive',
        moveSan: 'Bg5',
        moveUci: 'c1g5',
        eco: 'A45',
        description: 'A sharp anti-Indian weapon that pins the f6 knight, threatens to double Black\'s pawns, and sidesteps mountains of theory.',
        keyIdeas: ['Pin the f6 knight immediately', 'Threaten to damage Black\'s pawn structure', 'Play an offbeat, low-theory attacking game'],
      },
    ],
  },

  // ─── After 1. d4 Nf6 2. c4 (Black to move) ───────────────────────────────
  'rnbqkb1r/pppppppp/5n2/8/2PP4/8/PP2PPPP/RNBQKBNR b': {
    openingName: 'Indian Defense: 2. c4',
    eco: 'E00',
    playerColor: 'b',
    options: [
      {
        id: 'b-ind-g6',
        title: "The King's Indian",
        name: "King's Indian Defense (2... g6)",
        style: 'aggressive',
        moveSan: 'g6',
        moveUci: 'g7g6',
        eco: 'E60',
        description: 'Prepares the g7 fianchetto, letting White build a big center before Black unleashes a ferocious kingside counterattack.',
        keyIdeas: ['Fianchetto the dark-squared bishop to g7', 'Castle kingside and prepare ...e5', 'Storm the kingside once the center locks'],
      },
      {
        id: 'b-ind-e6',
        title: 'The Nimzo / Queen\'s Indian',
        name: 'Nimzo-Indian Setup (2... e6)',
        style: 'positional',
        moveSan: 'e6',
        moveUci: 'e7e6',
        eco: 'E20',
        description: 'Keeps maximum flexibility, aiming for the excellent Nimzo-Indian (…Bb4) or the solid Queen\'s Indian if White avoids Nc3.',
        keyIdeas: ['Prepare ...Bb4 to pin the c3 knight', 'Fight for control of the e4 square', 'Choose Nimzo or Queen\'s Indian by move order'],
      },
      {
        id: 'b-ind-c5',
        title: 'The Benoni Counterstrike',
        name: 'Benoni / Symmetrical (2... c5)',
        style: 'tactical',
        moveSan: 'c5',
        moveUci: 'c7c5',
        eco: 'A56',
        description: 'Immediately challenges White\'s center from the flank, steering toward the dynamic Benoni or a Symmetrical English structure.',
        keyIdeas: ['Strike at the d4 pawn at once', 'Accept an asymmetrical, unbalanced fight', 'Generate queenside play in Benoni structures'],
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
