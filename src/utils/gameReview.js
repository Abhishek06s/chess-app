import { Chess } from "chess.js";
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
    const isWhiteWinningMate = evalScore.startsWith("M") && !evalScore.startsWith("M-");
    const isBlackWinningMate = evalScore.startsWith("-M") || evalScore.startsWith("M-");
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
  isSacrifice,
  isGreatMoveCandidate,
  isForced,
}) {
  if (isBookMove) return { classification: "Book", accuracyLoss: 0 };
  if (isForced) return { classification: "Forced", accuracyLoss: 0 };

  if (typeof evalAfter === "string") {
    const isWhiteDeliveringMate = side === "white" && evalAfter.startsWith("M") && !evalAfter.startsWith("M-");
    const isBlackDeliveringMate = side === "black" && (evalAfter.startsWith("-M") || evalAfter.startsWith("M-"));
    if (isWhiteDeliveringMate || isBlackDeliveringMate) {
      return { classification: "Best", accuracyLoss: 0 };
    }
  }

  const beforeEP = evalToExpectedPoints(evalBefore, side);
  const afterEP = evalToExpectedPoints(evalAfter, side);
  const loss = Math.max(0, beforeEP - afterEP);

  const numericBefore = typeof evalBefore === "string" ? (evalBefore.includes("-") ? -99 : 99) : Number(evalBefore);
  
  // --- DEFINITION: BRILLIANT (!!) ---
  const isAlreadyWinningBefore = side === "white" ? numericBefore > 3.0 : numericBefore < -3.0;
  if (isTopMove && isSacrifice && !isAlreadyWinningBefore && afterEP >= 0.40 && loss <= 0.02) {
    return { classification: "Brilliant", accuracyLoss: loss };
  }

  // --- DEFINITION: GREAT (!) ---
  if (isTopMove && isGreatMoveCandidate && loss <= 0.02) {
    return { classification: "Great", accuracyLoss: loss };
  }

  if (wasOpponentError && loss > 0.15) return { classification: "Miss", accuracyLoss: loss };
  if (loss <= 0.01) return { classification: "Best", accuracyLoss: loss };
  if (loss <= 0.03) return { classification: "Excellent", accuracyLoss: loss };
  if (loss <= 0.07) return { classification: "Good", accuracyLoss: loss };
  if (loss <= 0.15) return { classification: "Inaccuracy", accuracyLoss: loss };
  if (loss <= 0.30) return { classification: "Mistake", accuracyLoss: loss };
  return { classification: "Blunder", accuracyLoss: loss };
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
    const side = move.color === "w" ? "white" : "black";

    const fenBefore = replay.fen();
    const cleanFenBefore = cleanFenForBook(fenBefore);

    const legalMovesCount = replay.moves().length;
    const isForced = legalMovesCount === 1;

    const materialBefore = getMaterialCount(replay);
    
    // CRITICAL: Bumped base depth from 12 to 16 to find brilliant sacrificing lines
    const engineBefore = await getAnalysis(fenBefore, 16, analyzePosition);

    let isBookMove = false;
    if (openingBook && i < 30) {
      const pgnArray = [];
      for (let j = 0; j <= i; j++) {
        if (j % 2 === 0) pgnArray.push(`${Math.floor(j / 2) + 1}.`);
        pgnArray.push(moves[j].san);
      }
      const standardPgnString = pgnArray.join(" ");
      const rawMovesString = moves.slice(0, i + 1).map(m => m.san).join(" ");

      if (
        openingBook[standardPgnString] || 
        openingBook[rawMovesString] || 
        openingBook[cleanFenBefore]
      ) {
        isBookMove = true;
      }
    }

    replay.move(move);
    const fenAfter = replay.fen();
    const materialAfter = getMaterialCount(replay);
    const engineAfter = await getAnalysis(fenAfter, 16, analyzePosition);

    const calculatedPlayerMove = `${move.from}${move.to}${move.promotion || ""}`.toLowerCase().trim();
    const rawEngineMove = String(engineBefore.bestMoveRaw || engineBefore.bestMove || "").toLowerCase().trim();
    const isTopMove = rawEngineMove.includes(calculatedPlayerMove) || calculatedPlayerMove.includes(rawEngineMove);

    let isSacrifice = false;
    if (side === "white" && materialAfter.whiteMaterial < materialBefore.whiteMaterial) {
      isSacrifice = true;
    } else if (side === "black" && materialAfter.blackMaterial < materialBefore.blackMaterial) {
      isSacrifice = true;
    }

    let isRecapture = false;
    if (i > 0 && move.captured) {
      const prevMove = moves[i - 1];
      if (prevMove.captured && prevMove.to === move.to) {
        isRecapture = true;
      }
    }

    // --- GREAT MOVE PIPELINE VALIDATION ---
    let isGreatMoveCandidate = false;
    if (isTopMove && !isForced && !isBookMove && !isRecapture) {
      
      const evalBeforeNum = Number(engineBefore.evaluation);
      const evalAfterNum = Number(engineAfter.evaluation);

      if (!Number.isNaN(evalBeforeNum) && !Number.isNaN(evalAfterNum)) {
        const positionalSurge = side === "white" 
          ? (evalAfterNum - evalBeforeNum) 
          : (evalBeforeNum - evalAfterNum);

        const whiteMaterialDelta = materialAfter.whiteMaterial - materialBefore.whiteMaterial;
        const blackMaterialDelta = materialAfter.blackMaterial - materialBefore.blackMaterial;
        const materialGained = side === "white" ? Math.abs(blackMaterialDelta) : Math.abs(whiteMaterialDelta);

        const topMoveExpectedPoints = evalToExpectedPoints(engineAfter.evaluation, side);
        let passesProportionalIsolationCheck = false;

        if (engineBefore.alternativeMoveLoss !== undefined) {
          const expectedLossOfAlternative = Number(engineBefore.alternativeMoveLoss);
          const alternativeExpectedPoints = topMoveExpectedPoints - expectedLossOfAlternative;
          
          if (alternativeExpectedPoints < (topMoveExpectedPoints * 0.20)) {
            passesProportionalIsolationCheck = true;
          }
        } else {
          // Single-line fallback: checks if you find a major advantage shift (Qh3)
          // or if you hold a balanced game safely together without collapsing
          const isSharpTurningPoint = positionalSurge >= 1.0;
          const isPreciseBalanceHold = Math.abs(evalBeforeNum) <= 1.2 && Math.abs(evalAfterNum) <= 1.0;
          
          if (isSharpTurningPoint || isPreciseBalanceHold) {
            passesProportionalIsolationCheck = true;
          }
        }

        if (passesProportionalIsolationCheck) {
          const isPositionalAdvantageGreat = !move.captured && !replay.isCheckmate() && positionalSurge >= 1.0;
          const isProtectedCaptureGreat = move.captured && materialGained === 0 && positionalSurge >= 0.5;
          const isBalancedBefore = Math.abs(evalBeforeNum) <= 1.5;
          const isSavedAfter = side === "white" ? evalAfterNum >= -0.5 : evalAfterNum <= 0.5;
          const isGameLifeline = isBalancedBefore && isSavedAfter;

          // Exclude already completely crushing position states (stops endgame flood bugs)
          if ((isPositionalAdvantageGreat || isProtectedCaptureGreat || isGameLifeline) && Math.abs(evalBeforeNum) <= 3.0) {
            isGreatMoveCandidate = true;
          }
        }
      }
    }

    let wasOpponentError = false;
    if (i > 0) {
      const prevMove = review[i - 1];
      wasOpponentError = ["Inaccuracy", "Mistake", "Blunder", "Miss"].includes(prevMove.classification);
    }

    let moveData = classifyMove({
      evalBefore: engineBefore.evaluation,
      evalAfter: engineAfter.evaluation,
      side,
      isTopMove,
      isBookMove,
      wasOpponentError,
      isSacrifice,
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
      evalAfter: replay.isCheckmate() ? (side === "white" ? "M0" : "-M0") : engineAfter.evaluation,
      bestMove: engineBefore.bestMove,
      accuracyLoss: moveData.accuracyLoss,
      classification: moveData.classification,
    });
  }

  for (const move of review) {
    if (["Inaccuracy", "Mistake", "Miss", "Blunder"].includes(move.classification)) {
      const deeper = await getAnalysis(move.fenBefore, 18, analyzePosition);
      move.bestMove = deeper.bestMove;
    }
  }

  return review;
}