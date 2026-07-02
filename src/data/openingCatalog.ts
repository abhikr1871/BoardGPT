/**
 * A curated catalog of well-known chess openings for the Opening Trainer.
 *
 * Every `moves` array is a legal SAN sequence from the initial position. Each
 * sequence in this file has been verified to apply cleanly with chess.js
 * v1.4.x (see the trainer's build notes) — feeding the moves one by one into a
 * fresh `new Chess()` never throws.
 *
 * `side` describes which colour the entry is a repertoire choice *for* — i.e.
 * the side the student would typically play when studying that opening. `ideas`
 * are short, human-readable strategic pointers surfaced in the theory panel.
 */

export interface CatalogOpening {
  id: string;
  name: string;
  eco: string;
  side: 'w' | 'b' | 'either';
  /** SAN moves from the initial position (verified legal via chess.js). */
  moves: string[];
  /** 2-4 short strategic ideas for the theory panel. */
  ideas: string[];
}

export const OPENING_CATALOG: CatalogOpening[] = [
  // ─────────────────────────────────────────────────────────────
  // 1.e4 e5 — Open Games
  // ─────────────────────────────────────────────────────────────
  {
    id: 'ruy-lopez',
    name: 'Ruy López',
    eco: 'C60',
    side: 'w',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'],
    ideas: [
      'Pressure the c6-knight that defends the e5-pawn.',
      'Aim for a big pawn centre with a later c3 and d4.',
      'One of the oldest and most respected 1.e4 e5 mainlines.',
    ],
  },
  {
    id: 'ruy-lopez-morphy',
    name: 'Ruy López, Morphy Defense',
    eco: 'C70',
    side: 'w',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O', 'Be7'],
    ideas: [
      '...a6 questions the bishop; White retreats to a4 keeping the pin idea.',
      'Both sides castle and prepare the central break c3 and d4.',
      'Leads to rich, strategic middlegames typical of the Closed Ruy.',
    ],
  },
  {
    id: 'italian-game',
    name: 'Italian Game',
    eco: 'C50',
    side: 'w',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'],
    ideas: [
      'The bishop eyes the sensitive f7-square.',
      'Fast development and easy, natural piece play.',
      'Can steer into the quiet Giuoco Piano or sharper gambits.',
    ],
  },
  {
    id: 'giuoco-piano',
    name: 'Giuoco Piano',
    eco: 'C53',
    side: 'w',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6', 'd3'],
    ideas: [
      'The "quiet game": build slowly with c3, d3 and a later d4.',
      'Keep the centre flexible and manoeuvre pieces to good squares.',
      'Modern top-level treatment of the Italian.',
    ],
  },
  {
    id: 'two-knights',
    name: 'Two Knights Defense',
    eco: 'C55',
    side: 'b',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6'],
    ideas: [
      'Black invites the sharp Ng5 attack on f7 and fights for the initiative.',
      'Often leads to gambit play and open, tactical positions.',
      'A combative alternative to the solid Giuoco Piano.',
    ],
  },
  {
    id: 'scotch-game',
    name: 'Scotch Game',
    eco: 'C45',
    side: 'w',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4', 'Nxd4'],
    ideas: [
      'Open the centre early with d4 to free the pieces.',
      'Trade the d-pawn for quick development and space.',
      'A direct, principled way to sidestep heavy Ruy López theory.',
    ],
  },
  {
    id: 'vienna-game',
    name: 'Vienna Game',
    eco: 'C25',
    side: 'w',
    moves: ['e4', 'e5', 'Nc3'],
    ideas: [
      'Develop the knight first, keeping f4 and Bc4 flexible.',
      'Can transpose to a delayed King’s Gambit with f4.',
      'A less-charted way to reach aggressive attacking setups.',
    ],
  },
  {
    id: 'kings-gambit',
    name: "King's Gambit",
    eco: 'C33',
    side: 'w',
    moves: ['e4', 'e5', 'f4'],
    ideas: [
      'Sacrifice the f-pawn for rapid development and open lines.',
      'Fight for a big centre and a kingside attack.',
      'A romantic, high-risk opening rewarding sharp calculation.',
    ],
  },
  {
    id: 'petrov-defense',
    name: 'Petrov Defense',
    eco: 'C42',
    side: 'b',
    moves: ['e4', 'e5', 'Nf3', 'Nf6'],
    ideas: [
      'Counterattack the e4-pawn instead of defending e5.',
      'A rock-solid, symmetrical defence prized for its safety.',
      'Neutralises White’s initiative and equalises reliably.',
    ],
  },
  {
    id: 'philidor-defense',
    name: 'Philidor Defense',
    eco: 'C41',
    side: 'b',
    moves: ['e4', 'e5', 'Nf3', 'd6'],
    ideas: [
      'Support e5 with the d6-pawn for a compact structure.',
      'Solid but slightly passive; aim for a timely ...d5 or ...f5 break.',
      'A dependable surprise weapon against 1.e4.',
    ],
  },
  {
    id: 'ponziani',
    name: 'Ponziani Opening',
    eco: 'C44',
    side: 'w',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'c3'],
    ideas: [
      'Prepare an immediate d4 to seize the centre.',
      'An old sideline that often catches opponents unprepared.',
      'Requires accurate play against Black’s ...d5 or ...Nf6 counters.',
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // 1.e4 c5 — Sicilian Defense
  // ─────────────────────────────────────────────────────────────
  {
    id: 'sicilian-najdorf',
    name: 'Sicilian, Najdorf',
    eco: 'B90',
    side: 'b',
    moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6'],
    ideas: [
      '...a6 controls b5 and prepares ...e5 or ...e6 with great flexibility.',
      'The most respected Sicilian; unbalanced, double-edged play.',
      'Black seeks active counterplay on the queenside and centre.',
    ],
  },
  {
    id: 'sicilian-dragon',
    name: 'Sicilian, Dragon',
    eco: 'B70',
    side: 'b',
    moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'g6'],
    ideas: [
      'Fianchetto the bishop to g7 to rake the long diagonal.',
      'Counterattack down the half-open c-file against White’s king.',
      'Sharp opposite-side castling races; know the Yugoslav Attack.',
    ],
  },
  {
    id: 'sicilian-scheveningen',
    name: 'Sicilian, Scheveningen',
    eco: 'B80',
    side: 'b',
    moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'e6'],
    ideas: [
      'Build the flexible "small centre" with pawns on d6 and e6.',
      'Prepare freeing breaks with ...d5 or queenside expansion.',
      'Beware the Keres Attack (g4) — a critical test.',
    ],
  },
  {
    id: 'sicilian-classical',
    name: 'Sicilian, Classical',
    eco: 'B56',
    side: 'b',
    moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'Nc6'],
    ideas: [
      'Develop naturally, pressuring the d4-knight with ...Nc6.',
      'Can lead to Richter-Rauzer or Boleslavsky structures.',
      'A principled, developing approach to the Open Sicilian.',
    ],
  },
  {
    id: 'sicilian-sveshnikov',
    name: 'Sicilian, Sveshnikov',
    eco: 'B33',
    side: 'b',
    moves: ['e4', 'c5', 'Nf3', 'Nc6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'e5'],
    ideas: [
      '...e5 kicks the knight and accepts a backward d-pawn for activity.',
      'Black gets dynamic piece play and the bishop pair.',
      'A theory-heavy, highly respected modern main line.',
    ],
  },
  {
    id: 'sicilian-rossolimo',
    name: 'Sicilian, Rossolimo',
    eco: 'B31',
    side: 'w',
    moves: ['e4', 'c5', 'Nf3', 'Nc6', 'Bb5'],
    ideas: [
      'Pin/pressure the c6-knight and often trade it for structure.',
      'Sidestep massive Open Sicilian theory with clear plans.',
      'Aim for a small but lasting positional edge.',
    ],
  },
  {
    id: 'sicilian-alapin',
    name: 'Sicilian, Alapin',
    eco: 'B22',
    side: 'w',
    moves: ['e4', 'c5', 'c3'],
    ideas: [
      'Prepare d4 to build a broad classical pawn centre.',
      'A low-theory, solid anti-Sicilian with clear ideas.',
      'Meet ...d5 and ...Nf6 with central expansion.',
    ],
  },
  {
    id: 'sicilian-taimanov',
    name: 'Sicilian, Taimanov',
    eco: 'B44',
    side: 'b',
    moves: ['e4', 'c5', 'Nf3', 'e6', 'd4', 'cxd4', 'Nxd4', 'Nc6'],
    ideas: [
      'Flexible development keeping options for ...a6, ...Qc7 and ...Bb4.',
      'Avoid committing the king’s knight or d-pawn too early.',
      'Rich, manoeuvring middlegames with many pawn structures.',
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // 1.e4 e6 — French Defense
  // ─────────────────────────────────────────────────────────────
  {
    id: 'french-winawer',
    name: 'French, Winawer',
    eco: 'C15',
    side: 'b',
    moves: ['e4', 'e6', 'd4', 'd5', 'Nc3', 'Bb4'],
    ideas: [
      'Pin the c3-knight and pressure the e4-pawn.',
      'Trade the bishop for the knight, doubling White’s c-pawns.',
      'Sharp, unbalanced structures with mutual chances.',
    ],
  },
  {
    id: 'french-classical',
    name: 'French, Classical',
    eco: 'C11',
    side: 'b',
    moves: ['e4', 'e6', 'd4', 'd5', 'Nc3', 'Nf6'],
    ideas: [
      'Develop naturally and challenge the centre with ...Nf6.',
      'Prepare the freeing break ...c5 against White’s pawn chain.',
      'Solid and classical French play.',
    ],
  },
  {
    id: 'french-advance',
    name: 'French, Advance',
    eco: 'C02',
    side: 'w',
    moves: ['e4', 'e6', 'd4', 'd5', 'e5'],
    ideas: [
      'Gain space and lock the centre with e5.',
      'Support the d4-pawn and expand on the kingside.',
      'Restrain Black’s light-squared bishop behind its own pawns.',
    ],
  },
  {
    id: 'french-tarrasch',
    name: 'French, Tarrasch',
    eco: 'C03',
    side: 'w',
    moves: ['e4', 'e6', 'd4', 'd5', 'Nd2'],
    ideas: [
      'Nd2 avoids the Winawer pin and keeps c-pawn options.',
      'Flexible development aiming for a small structural edge.',
      'A solid, low-risk way to meet the French.',
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // 1.e4 c6 — Caro-Kann Defense
  // ─────────────────────────────────────────────────────────────
  {
    id: 'caro-kann-classical',
    name: 'Caro-Kann, Classical',
    eco: 'B18',
    side: 'b',
    moves: ['e4', 'c6', 'd4', 'd5', 'Nc3', 'dxe4', 'Nxe4', 'Bf5'],
    ideas: [
      'Develop the light-squared bishop actively before ...e6.',
      'Reach a sound structure with the bishop pair unhindered.',
      'A reliable, solid answer to 1.e4 with few weaknesses.',
    ],
  },
  {
    id: 'caro-kann-advance',
    name: 'Caro-Kann, Advance',
    eco: 'B12',
    side: 'w',
    moves: ['e4', 'c6', 'd4', 'd5', 'e5'],
    ideas: [
      'Seize space with e5 and cramp Black’s position.',
      'Target the light-squared bishop that comes to f5.',
      'Expand on the kingside while holding the centre.',
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // Other 1.e4 defenses
  // ─────────────────────────────────────────────────────────────
  {
    id: 'scandinavian',
    name: 'Scandinavian Defense',
    eco: 'B01',
    side: 'b',
    moves: ['e4', 'd5', 'exd5', 'Qxd5', 'Nc3', 'Qa5'],
    ideas: [
      'Challenge e4 immediately and simplify the centre.',
      'Reroute the queen to a5 (or d6) and develop solidly.',
      'A straightforward, low-theory defence with clear plans.',
    ],
  },
  {
    id: 'pirc-defense',
    name: 'Pirc Defense',
    eco: 'B07',
    side: 'b',
    moves: ['e4', 'd6', 'd4', 'Nf6', 'Nc3', 'g6'],
    ideas: [
      'Let White build a big centre, then strike it with ...e5 or ...c5.',
      'Fianchetto the bishop to g7 for hypermodern pressure.',
      'Flexible and combative, inviting White to overextend.',
    ],
  },
  {
    id: 'modern-defense',
    name: 'Modern Defense',
    eco: 'B06',
    side: 'b',
    moves: ['e4', 'g6', 'd4', 'Bg7'],
    ideas: [
      'Fianchetto first and delay committing the knights.',
      'Counterattack the centre from a distance with pawn breaks.',
      'Ultra-flexible; can transpose to many pawn structures.',
    ],
  },
  {
    id: 'alekhine-defense',
    name: 'Alekhine Defense',
    eco: 'B02',
    side: 'b',
    moves: ['e4', 'Nf6'],
    ideas: [
      'Provoke White’s pawns forward, then attack the chain.',
      'Hypermodern: cede the centre to undermine it later.',
      'Unbalanced play that takes White out of comfort zones.',
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // 1.d4 d5 — Queen's Pawn Games
  // ─────────────────────────────────────────────────────────────
  {
    id: 'qgd',
    name: "Queen's Gambit Declined",
    eco: 'D30',
    side: 'w',
    moves: ['d4', 'd5', 'c4', 'e6'],
    ideas: [
      'Pressure d5 with c4 and fight for the centre.',
      'Aim for the classic minority attack on the queenside.',
      'One of the soundest, most classical openings in chess.',
    ],
  },
  {
    id: 'qga',
    name: "Queen's Gambit Accepted",
    eco: 'D20',
    side: 'b',
    moves: ['d4', 'd5', 'c4', 'dxc4'],
    ideas: [
      'Take on c4 and plan to give it back for free development.',
      'Free the light-squared bishop and strike with ...c5 or ...e5.',
      'Active, open piece play instead of a cramped defence.',
    ],
  },
  {
    id: 'slav-defense',
    name: 'Slav Defense',
    eco: 'D10',
    side: 'b',
    moves: ['d4', 'd5', 'c4', 'c6'],
    ideas: [
      'Support d5 with the c-pawn, keeping the c8-bishop free.',
      'Solid structure without locking in the light-squared bishop.',
      'A dependable mainline answer to the Queen’s Gambit.',
    ],
  },
  {
    id: 'semi-slav',
    name: 'Semi-Slav Defense',
    eco: 'D43',
    side: 'b',
    moves: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'c6', 'Nf3', 'Nf6'],
    ideas: [
      'Combine ...e6 and ...c6 for a rock-solid centre.',
      'Prepare the freeing ...c5 or ...e5 breaks and ...dxc4.',
      'Rich, complex play (Meran and Botvinnik systems).',
    ],
  },
  {
    id: 'london-system',
    name: 'London System',
    eco: 'D02',
    side: 'w',
    moves: ['d4', 'd5', 'Nf3', 'Nf6', 'Bf4'],
    ideas: [
      'Develop the bishop outside the pawn chain to f4.',
      'A solid, low-theory setup you can play against almost anything.',
      'Aim for e3, c3, Bd3 and a stable pawn triangle.',
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // 1.d4 Nf6 — Indian Defenses
  // ─────────────────────────────────────────────────────────────
  {
    id: 'nimzo-indian',
    name: 'Nimzo-Indian Defense',
    eco: 'E20',
    side: 'b',
    moves: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4'],
    ideas: [
      'Pin the c3-knight to fight for control of e4.',
      'Trade the bishop to damage White’s pawn structure.',
      'One of Black’s most respected, flexible defences.',
    ],
  },
  {
    id: 'queens-indian',
    name: "Queen's Indian Defense",
    eco: 'E12',
    side: 'b',
    moves: ['d4', 'Nf6', 'c4', 'e6', 'Nf3', 'b6'],
    ideas: [
      'Fianchetto the bishop to b7 to contest the e4-square.',
      'Solid, harmonious development with long-term pressure.',
      'A natural companion to the Nimzo-Indian.',
    ],
  },
  {
    id: 'bogo-indian',
    name: 'Bogo-Indian Defense',
    eco: 'E11',
    side: 'b',
    moves: ['d4', 'Nf6', 'c4', 'e6', 'Nf3', 'Bb4+'],
    ideas: [
      'Check on b4 to trade or provoke a concession.',
      'A solid, simplifying alternative to the Nimzo-Indian.',
      'Steer toward calm, easy-to-handle positions.',
    ],
  },
  {
    id: 'kings-indian',
    name: "King's Indian Defense",
    eco: 'E60',
    side: 'b',
    moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'Bg7', 'e4', 'd6'],
    ideas: [
      'Allow White a big centre, then strike back with ...e5 or ...c5.',
      'Launch a kingside pawn storm while White plays on the queenside.',
      'Dynamic, double-edged fighting chess.',
    ],
  },
  {
    id: 'grunfeld',
    name: 'Grünfeld Defense',
    eco: 'D80',
    side: 'b',
    moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'd5'],
    ideas: [
      'Challenge the centre immediately with ...d5.',
      'Hypermodern: pressure White’s broad centre from the flanks.',
      'The g7-bishop and ...c5 breaks target d4 relentlessly.',
    ],
  },
  {
    id: 'benoni',
    name: 'Modern Benoni',
    eco: 'A60',
    side: 'b',
    moves: ['d4', 'Nf6', 'c4', 'c5', 'd5', 'e6'],
    ideas: [
      'Accept a queenside pawn majority and dynamic imbalance.',
      'Use the half-open e-file and the ...b5 break for counterplay.',
      'Sharp, unbalanced positions favouring the active side.',
    ],
  },
  {
    id: 'benko-gambit',
    name: 'Benko Gambit',
    eco: 'A57',
    side: 'b',
    moves: ['d4', 'Nf6', 'c4', 'c5', 'd5', 'b5'],
    ideas: [
      'Sacrifice the b-pawn for lasting queenside pressure.',
      'Open the a- and b-files for the rooks and bishop.',
      'Long-term positional compensation rather than tactics.',
    ],
  },
  {
    id: 'catalan',
    name: 'Catalan Opening',
    eco: 'E00',
    side: 'w',
    moves: ['d4', 'Nf6', 'c4', 'e6', 'g3'],
    ideas: [
      'Fianchetto to g2 to pressure the long light-square diagonal.',
      'Combine central control with quiet positional squeezing.',
      'Recover the c4-pawn later while keeping a lasting edge.',
    ],
  },
  {
    id: 'trompowsky',
    name: 'Trompowsky Attack',
    eco: 'A45',
    side: 'w',
    moves: ['d4', 'Nf6', 'Bg5'],
    ideas: [
      'Pin (or trade) the f6-knight before Black sets up.',
      'A low-theory way to sidestep the main Indian defences.',
      'Often doubles Black’s pawns or gains the bishop pair.',
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // 1.d4 f5 — Dutch Defense
  // ─────────────────────────────────────────────────────────────
  {
    id: 'dutch-defense',
    name: 'Dutch Defense',
    eco: 'A80',
    side: 'b',
    moves: ['d4', 'f5'],
    ideas: [
      'Fight for the e4-square and kingside attacking chances.',
      'Choose between Stonewall, Leningrad and Classical setups.',
      'An ambitious, imbalancing reply to 1.d4.',
    ],
  },
  {
    id: 'dutch-leningrad',
    name: 'Dutch, Leningrad',
    eco: 'A87',
    side: 'b',
    moves: ['d4', 'f5', 'g3', 'Nf6', 'Bg2', 'g6'],
    ideas: [
      'Combine the Dutch ...f5 with a King’s-Indian fianchetto.',
      'Prepare the central ...e5 break behind the g7-bishop.',
      'Dynamic, attacking play aimed at White’s kingside.',
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // Flank openings — English / Réti / KIA
  // ─────────────────────────────────────────────────────────────
  {
    id: 'english-symmetrical',
    name: 'English, Symmetrical',
    eco: 'A30',
    side: 'w',
    moves: ['c4', 'c5'],
    ideas: [
      'Contest the centre from the flank with c4.',
      'Flexible: can transpose to many d4 or Réti structures.',
      'Rich manoeuvring battles over the d5- and d4-squares.',
    ],
  },
  {
    id: 'english-reversed-sicilian',
    name: 'English, Reversed Sicilian',
    eco: 'A20',
    side: 'w',
    moves: ['c4', 'e5'],
    ideas: [
      'Play a Sicilian a tempo up with colours reversed.',
      'Target the d5-square and expand on the queenside.',
      'Positional, strategically rich middlegames.',
    ],
  },
  {
    id: 'reti-opening',
    name: 'Réti Opening',
    eco: 'A09',
    side: 'w',
    moves: ['Nf3', 'd5', 'c4'],
    ideas: [
      'Attack Black’s centre from the flank, hypermodern style.',
      'Fianchetto and pressure d5 rather than occupying the centre.',
      'Highly flexible, transposing to many systems.',
    ],
  },
  {
    id: 'kings-indian-attack',
    name: "King's Indian Attack",
    eco: 'A07',
    side: 'w',
    moves: ['Nf3', 'd5', 'g3'],
    ideas: [
      'A universal fianchetto setup you can play versus almost anything.',
      'Build with Bg2, O-O, d3, Nbd2 and a later e4 break.',
      'Low-theory system with clear, repeatable plans.',
    ],
  },
];
