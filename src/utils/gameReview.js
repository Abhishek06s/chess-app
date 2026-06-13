import { Chess } from "chess.js";

import {
  isGreatMove,
  getOpponentAttacks,
  seenGreatPositions,
} from "./greatMoveDetector";
import { isBrilliantMove } from "./brilliantMoveDetector";

import openingBook from "../data/openings";

const analysisCache = new Map();

async function getAnalysis(fen, depth, analyzePosition) {
  const key = `${fen}-${depth}`;
  if (analysisCache.has(key)) return analysisCache.get(key);
  const result = await analyzePosition(fen, depth);
  analysisCache.set(key, result);
  return result;
}

function evalToExpectedPoints(evalScore, side) {
  if (typeof evalScore === "string") {
    const isWhiteWinningMate =
      evalScore.startsWith("M") && !evalScore.startsWith("M-");
    const isBlackWinningMate =
      evalScore.startsWith("-M") || evalScore.startsWith("M-");
    if (side === "white") return isWhiteWinningMate ? 1.0 : 0.0;
    return isBlackWinningMate ? 1.0 : 0.0;
  }
  const cp = Number(evalScore) * 100;
  if (Number.isNaN(cp)) return 0.5;
  const whiteWinProb = 1 / (1 + Math.exp(-0.00368208 * cp));
  return side === "white" ? whiteWinProb : 1 - whiteWinProb;
}

function getMaterialCount(chessInstance) {
  const values = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  let whiteMaterial = 0;
  let blackMaterial = 0;
  chessInstance.board().forEach((row) => {
    row.forEach((piece) => {
      if (piece) {
        if (piece.color === "w") whiteMaterial += values[piece.type];
        else blackMaterial += values[piece.type];
      }
    });
  });
  return { whiteMaterial, blackMaterial };
}

function cleanFenForBook(fen) {
  return fen.split(" ").slice(0, 4).join(" ");
}

export function classifyMove({
  evalBefore,
  evalAfter,
  side,
  isTopMove,
  isBookMove,
  wasOpponentError,
  opponentErrorGain,
  isGreatMoveCandidate,
  isBrilliant,
  isForced,
}) {
  if (isBookMove) return { classification: "Book", accuracyLoss: 0 };
  if (isBrilliant) return { classification: "Brilliant", accuracyLoss: 0 };
  if (isForced) return { classification: "Forced", accuracyLoss: 0 };

  const beforeEP = evalToExpectedPoints(evalBefore, side);
  const afterEP = evalToExpectedPoints(evalAfter, side);
  const loss = Math.max(0, beforeEP - afterEP);

  if (isTopMove && isGreatMoveCandidate && loss <= 0.02) {
    return { classification: "Great", accuracyLoss: loss };
  }

  if (wasOpponentError && loss > 0.09 && loss <= opponentErrorGain)
    return { classification: "Miss", accuracyLoss: loss };
  if (isTopMove || loss <= 0.003)
    return { classification: "Best", accuracyLoss: loss };
  if (loss <= 0.01) return { classification: "Excellent", accuracyLoss: loss };
  if (loss <= 0.03) return { classification: "Good", accuracyLoss: loss };
  if (loss <= 0.08) return { classification: "Inaccuracy", accuracyLoss: loss };
  if (loss <= 0.25) return { classification: "Mistake", accuracyLoss: loss };
  return { classification: "Blunder", accuracyLoss: loss };
}

export async function generateGameReview(pgn, analyzePosition, onProgress) {
  analysisCache.clear();
  seenGreatPositions.clear();

  const game = new Chess();

  try {
    game.loadPgn(pgn);
  } catch (err) {
    throw new Error("Invalid PGN");
  }

  const moves = game.history({ verbose: true });
  const review = [];
  const replay = new Chess();

  const totalSteps = moves.length + 1;
  let prevEngineBefore = null;
  let prevEngineAfter = null;

  for (let i = 0; i < moves.length; i++) {
    if (typeof onProgress === "function") {
      onProgress(Math.round((i / totalSteps) * 95));
    }

    const move = moves[i];
    const side = move.color === "w" ? "white" : "black";

    const fenBefore = replay.fen();
    const legalMovesCount = replay.moves().length;
    const isForced = legalMovesCount === 1;

    const engineBefore = await getAnalysis(fenBefore, 13, analyzePosition);

    replay.move(move);
    const fenAfter = replay.fen();
    let isBookMove = false;
    if (openingBook) {
      const currentFullFen = replay.fen();
      if (openingBook[currentFullFen]) {
        isBookMove = true;
      }
    }

    let isRecapture = false;
    if (i > 0 && move.captured) {
      const prevMove = moves[i - 1];
      if (prevMove.captured && prevMove.to === move.to) {
        isRecapture = true;
      }
    }

    const engineAfter = await getAnalysis(fenAfter, 13, analyzePosition);

    const calculatedPlayerMove = `${move.from}${move.to}${move.promotion || ""}`
      .toLowerCase()
      .trim();
    const rawEngineMove = String(
      engineBefore.bestMoveRaw || engineBefore.bestMove || "",
    )
      .toLowerCase()
      .trim();

    const isTopMove =
      rawEngineMove.includes(calculatedPlayerMove) ||
      calculatedPlayerMove.includes(rawEngineMove);

    let myPreviousMoveCategory = undefined;
    let opponentEvalDrop = undefined;

    if (i >= 2) {
      myPreviousMoveCategory = review[i - 2].classification;

      const oppLastMove = review[i - 1];

      let oppEvalBefore = Number(oppLastMove.evalBefore);

      let oppEvalAfter = Number(engineBefore.evaluation);

      if (!isNaN(oppEvalBefore) && !isNaN(oppEvalAfter)) {
        opponentEvalDrop =
          side === "white"
            ? oppEvalAfter - oppEvalBefore
            : oppEvalBefore - oppEvalAfter;
      }
    }

    const isGreatMoveCandidate = await isGreatMove({
      fenBefore,
      move,
      side,
      evalBefore: engineBefore.evaluation,
      evalAfter: engineAfter.evaluation,
      isTopMove,
      isForced,
      isBookMove,
      isRecapture,
      analyzePosition,
      getAnalysis,
      evalToExpectedPoints,
      getOpponentAttacks,
      seenGreatPositions,
      cleanFenForBook,
    });

    const isBrilliant = await isBrilliantMove({
      fenBefore,
      fenAfter,
      move,
      side,
      evalBefore: engineBefore.evaluation,
      evalAfter: engineAfter.evaluation,
      isTopMove,
      isGreatMoveCandidate,
      analyzePosition,
      getAnalysis,
      myPreviousMoveCategory,
      opponentEvalDrop,
      prevEvalBefore: prevEngineBefore ? prevEngineBefore.evaluation : null,
      prevEvalAfter: prevEngineAfter ? prevEngineAfter.evaluation : null,
    });

    let wasOpponentError = false;
    let opponentErrorGain = 0;
    if (i > 0) {
      const prevMove = review[i - 1];
      wasOpponentError = ["Inaccuracy", "Mistake", "Blunder", "Miss"].includes(
        prevMove.classification,
      );

      if (wasOpponentError) {
        const yourEPBeforeOpponentMove = evalToExpectedPoints(
          prevMove.evalBefore,
          side,
        );
        const yourEPAfterOpponentMove = evalToExpectedPoints(
          engineBefore.evaluation,
          side,
        );
        opponentErrorGain = Math.max(
          0,
          yourEPAfterOpponentMove - yourEPBeforeOpponentMove,
        );
      }
    }

    let moveData = classifyMove({
      evalBefore: engineBefore.evaluation,
      evalAfter: engineAfter.evaluation,
      side,
      isTopMove,
      isBookMove,
      wasOpponentError,
      opponentErrorGain,
      isBrilliant,
      isGreatMoveCandidate,
      isForced,
    });

    if (replay.isCheckmate()) {
      moveData = { classification: "Best", accuracyLoss: 0 };
    }

    review.push({
      moveNumber: Math.floor(i / 2) + 1,
      side,
      san: move.san,
      fenBefore,
      fenAfter,
      evalBefore: engineBefore.evaluation,
      evalAfter: replay.isCheckmate()
        ? side === "white"
          ? "M0"
          : "-M0"
        : engineAfter.evaluation,
      bestMove: engineBefore.bestMove,
      accuracyLoss: moveData.accuracyLoss,
      classification: moveData.classification,
    });

    prevEngineBefore = engineBefore;
    prevEngineAfter = engineAfter;
  }

  const badMoves = review.filter((move) =>
    ["Inaccuracy", "Mistake", "Miss", "Blunder"].includes(move.classification),
  );

  for (let i = 0; i < badMoves.length; i++) {
    const move = badMoves[i];
    const deeper = await getAnalysis(move.fenBefore, 18, analyzePosition);
    move.bestMove = deeper.bestMove;

    if (typeof onProgress === "function") {
      onProgress(95 + Math.round(((i + 1) / badMoves.length) * 5));
    }
  }

  if (typeof onProgress === "function") {
    onProgress(100);
  }

  return review;
}
