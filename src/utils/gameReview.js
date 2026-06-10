import { Chess } from "chess.js";

/**
 * Classifies a chess move based on Chess.com criteria using Centipawn Loss (CPL)
 * @param {number|string} evalBefore - Evaluation before the move (number or string like "M3")
 * @param {number|string} evalAfter - Evaluation after the move (number or string like "M3")
 * @param {string} side - "white" or "black"
 * @param {boolean} isTopMove - True if this was Stockfish's top recommended choice
 * @param {boolean} isOnlyMove - True if this was the only legal or non-blundering move
 * @param {boolean} isBookMove - True if found in an opening database
 * @returns {Object} { classification: string, cpl: number }
 */

const analysisCache = new Map();

async function getAnalysis(fen, depth, analyzePosition) {
  const key = `${fen}-${depth}`;
  if (analysisCache.has(key)) {
    return analysisCache.get(key);
  }
  const result = await analyzePosition(fen, depth);
  analysisCache.set(key, result);
  return result;
}

function calculateCPL(evalBefore, evalAfter, side) {
  if (
    typeof evalBefore === "string" || 
    typeof evalAfter === "string" || 
    Math.abs(Number(evalBefore)) === 9999 || 
    Math.abs(Number(evalAfter)) === 9999
  ) {
    return 0; 
  }

  const before = Number(evalBefore);
  const after = Number(evalAfter);

  if (Number.isNaN(before) || Number.isNaN(after)) return 0;

  const loss = side === "white" ? before - after : after - before;
  return Math.max(0, Math.round(loss * 100));
}

export function classifyMove({ evalBefore, evalAfter, side, isTopMove, isOnlyMove, isBookMove }) {
  if (isBookMove) {
    return { classification: "Book", cpl: 0 };
  }

  const standardizeEval = (val, sideToMove) => {
    if (typeof val === "string") {
      const isMateMinus = val.includes("-");
      const baseValue = 9999;
      if (sideToMove === "white") {
        return isMateMinus ? -baseValue : baseValue;
      } else {
        return isMateMinus ? baseValue : -baseValue;
      }
    }
    return Number(val);
  };

  const scoreBefore = standardizeEval(evalBefore, side);
  const scoreAfter = standardizeEval(evalAfter, side);

  const cpl = side === "white" ? scoreBefore - scoreAfter : scoreAfter - scoreBefore;

  if (isTopMove) {
    if (isOnlyMove && Math.abs(cpl) <= 0.1 && Math.abs(scoreAfter) > 2.5) {
      return { classification: "Great", cpl: Math.max(0, cpl) };
    }
    return { classification: "Best", cpl: Math.max(0, cpl) };
  }

  if (cpl <= 0.10) {
    return { classification: "Best", cpl: Math.max(0, cpl) };
  }
  if (cpl <= 0.30) {
    return { classification: "Excellent", cpl };
  }
  if (cpl <= 0.60) {
    return { classification: "Good", cpl };
  }
  if (cpl <= 1.20) {
    return { classification: "Inaccuracy", cpl };
  }
  if (cpl <= 2.50) {
    if (Math.abs(scoreBefore) > 3.0 && Math.abs(scoreAfter) <= 1.0) {
      return { classification: "Miss", cpl };
    }
    return { classification: "Mistake", cpl };
  }
  
  return { classification: "Blunder", cpl };
}

export async function generateGameReview(pgn, analyzePosition) {
  analysisCache.clear();
  const game = new Chess();

  try {
    game.loadPgn(pgn);
  } catch (err) {
    throw new Error("Invalid PGN");
  }

  const moves = game.history({ verbose: true });
  const review = [];
  const replay = new Chess();

  for (let i = 0; i < moves.length; i++) {
    const move = moves[i];
    const fenBefore = replay.fen();
    const engineBefore = await getAnalysis(fenBefore, 13, analyzePosition);

    replay.move(move);
    const fenAfter = replay.fen();
    const engineAfter = await getAnalysis(fenAfter, 13, analyzePosition);

    const side = i % 2 === 0 ? "white" : "black";
    const cpl = calculateCPL(engineBefore.evaluation, engineAfter.evaluation, side);

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

  for (const move of review) {
    if (["Inaccuracy", "Mistake", "Blunder"].includes(move.classification)) {
      const deeper = await getAnalysis(move.fenBefore, 18, analyzePosition);
      move.bestMove = deeper.bestMove;
    }
  }

  return review;
}