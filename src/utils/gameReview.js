import { Chess } from "chess.js";

function calculateCPL(evalBefore, evalAfter, side) {
  let before = Number(evalBefore);
  let after = Number(evalAfter);

  if (Number.isNaN(before) || Number.isNaN(after)) {
    return 0;
  }

  if (side === "black") {
    before *= -1;
    after *= -1;
  }

  return Math.max(0, Math.round((before - after) * 100));
}

function classifyMove(cpl) {
  if (cpl <= 10) return "Best";
  if (cpl <= 30) return "Excellent";
  if (cpl <= 60) return "Good";
  if (cpl <= 100) return "Inaccuracy";
  if (cpl <= 250) return "Mistake";

  return "Blunder";
}

export async function generateGameReview(pgn, analyzePosition) {
  const game = new Chess();

  try {
    game.loadPgn(pgn);
  } 
  catch (err) {
    throw new Error("Invalid PGN");
  }

  const moves = game.history({ verbose: true });
  const review = [];
  const replay = new Chess();

  for (let i = 0; i < moves.length; i++) {
    const move = moves[i];
    const fenBefore = replay.fen();
    const engineBefore = await analyzePosition(fenBefore);

    replay.move(move);

    const fenAfter = replay.fen();
    const engineAfter = await analyzePosition(fenAfter);

    const side = i % 2 === 0 ? "white" : "black";

    const cpl = calculateCPL(
      engineBefore.evaluation,
      engineAfter.evaluation,
      side,
    );

    review.push({
      moveNumber: Math.floor(i / 2) + 1,
      side,
      san: move.san,
      fenBefore,
      fenAfter,
      evalBefore: engineBefore.evaluation,
      evalAfter: engineAfter.evaluation,
      bestMove: engineBefore.bestMove,
      cpl,
      classification: classifyMove(cpl),
    });
  }

  return review;
}