// Derives captured-piece groups (and material advantage) directly from a
// FEN's board field, by comparing the piece counts still on the board
// against the standard starting counts.
//
// Unlike `useCapturedPieces`'s `addCapturedPiece`-based accumulation (which
// relies on capture events being reported in play order), this works for
// any position in isolation - which is what's needed on the Analysis and
// Game Review boards, where the user can jump to any move or variation in
// any order.
//
// Naming mirrors the existing `useCapturedPieces` hook: "groupedWhitePieces"
// are the captured *white* pieces (shown on black's card), and
// "groupedBlackPieces" are the captured *black* pieces (shown on white's
// card).

const START_COUNTS = { p: 8, n: 2, b: 2, r: 2, q: 1 };
const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const PIECE_ORDER = ["q", "r", "b", "n", "p"];

export function getCapturedGroupsFromFen(
  fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
) {
  const boardLayout = (fen || "").split(" ")[0] || "";

  const counts = {
    w: { p: 0, n: 0, b: 0, r: 0, q: 0 },
    b: { p: 0, n: 0, b: 0, r: 0, q: 0 },
  };

  for (const char of boardLayout) {
    const lower = char.toLowerCase();
    if (!(lower in START_COUNTS)) continue;

    const color = char === char.toUpperCase() ? "w" : "b";
    counts[color][lower]++;
  }

  const groupedWhitePieces = [];
  const groupedBlackPieces = [];

  PIECE_ORDER.forEach((type) => {
    const missingWhite = START_COUNTS[type] - counts.w[type];
    if (missingWhite > 0) {
      groupedWhitePieces.push({
        piece: { type, color: "w" },
        count: missingWhite,
      });
    }

    const missingBlack = START_COUNTS[type] - counts.b[type];
    if (missingBlack > 0) {
      groupedBlackPieces.push({
        piece: { type, color: "b" },
        count: missingBlack,
      });
    }
  });

  const whiteScore = PIECE_ORDER.reduce(
    (sum, type) => sum + PIECE_VALUES[type] * counts.w[type],
    0,
  );
  const blackScore = PIECE_ORDER.reduce(
    (sum, type) => sum + PIECE_VALUES[type] * counts.b[type],
    0,
  );

  const whiteAdvantage = Math.max(whiteScore - blackScore, 0);
  const blackAdvantage = Math.max(blackScore - whiteScore, 0);

  return {
    groupedWhitePieces,
    groupedBlackPieces,
    whiteAdvantage,
    blackAdvantage,
  };
}