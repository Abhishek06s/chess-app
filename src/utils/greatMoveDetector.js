import { Chess } from "chess.js";

export const seenGreatPositions = new Set();

export function getOpponentAttacks(fen, opponentColor) {
  const sandbox = new Chess(fen);

  if (sandbox.turn() !== opponentColor) {
    const tokens = fen.split(" ");
    tokens[1] = opponentColor;

    if (tokens[3] !== "-") tokens[3] = "-";

    try {
      sandbox.load(tokens.join(" "));
    } catch (e) {
      return [];
    }
  }

  return sandbox.moves({ verbose: true });
}

export async function isGreatMove({
  fenBefore,
  move,
  side,
  evalBefore,
  evalAfter,
  isTopMove,
  isForced,
  isBookMove,
  isRecapture,
  analyzePosition,
  getAnalysis,
  evalToExpectedPoints,
  cleanFenForBook,
}) {
  if (!isTopMove || isForced || isBookMove || isRecapture) {
    return false;
  }

  const calculatedPlayerMove = `${move.from}${move.to}${move.promotion || ""}`
    .toLowerCase()
    .trim();

  const cleanedFen = cleanFenForBook(fenBefore);
  const greatPositionKey = `${cleanedFen}|${calculatedPlayerMove}`;

  if (seenGreatPositions.has(greatPositionKey)) {
    return false;
  }

  let isObviousEscape = false;
  const opponentColor = side === "white" ? "b" : "w";

  const opponentMovesPre = getOpponentAttacks(fenBefore, opponentColor);
  const preMoveAttacked = opponentMovesPre.some((m) => m.to === move.from);

  if (preMoveAttacked) {
    const escapeContext = new Chess(fenBefore);
    const escapeOptions = escapeContext
      .moves({ verbose: true })
      .filter((m) => m.from === move.from);

    if (escapeOptions.length > 1) {
      let safeSquaresCount = 0;

      for (const opt of escapeOptions) {
        const testGame = new Chess(fenBefore);
        testGame.move(opt);

        const oppMoves = testGame.moves({ verbose: true });
        const landingSquareAttacked = oppMoves.some((om) => om.to === opt.to);

        if (!landingSquareAttacked) {
          safeSquaresCount++;
        }
      }

      if (safeSquaresCount === 1) {
        isObviousEscape = true;
      }
    }
  }

  if (isObviousEscape) {
    return false;
  }

  let isForcedTacticalChoice = false;

  if (move.captured) {
    const sandbox = new Chess(fenBefore);
    const candidateCaptures = sandbox
      .moves({ verbose: true })
      .filter(
        (m) =>
          m.to === move.to &&
          m.captured === move.captured &&
          `${m.from}${m.to}${m.promotion || ""}`.toLowerCase() !==
            calculatedPlayerMove,
      );

    if (candidateCaptures.length > 0) {
      isForcedTacticalChoice = true;
    }
  }

  if (isForcedTacticalChoice) {
    return false;
  }

  const positionBefore = new Chess(fenBefore);
  const isForcedKingEscape =
    positionBefore.inCheck() &&
    positionBefore.moves({ verbose: true }).filter((m) => m.piece === "k")
      .length === 1;

  if (isForcedKingEscape) {
    return false;
  }

  const evalBeforeNum = Number(evalBefore);
  const evalAfterNum = Number(evalAfter);

  if (Number.isNaN(evalBeforeNum) || Number.isNaN(evalAfterNum)) {
    return false;
  }

  const isLosingHeavilyBefore =
    side === "white" ? evalBeforeNum < -1.0 : evalBeforeNum > 1.0;
  const isLosingHeavilyAfter =
    side === "white" ? evalAfterNum < -1.0 : evalAfterNum > 1.0;

  if (isLosingHeavilyBefore && isLosingHeavilyAfter) {
    return false;
  }

  const topMoveExpectedPoints = evalToExpectedPoints(evalAfter, side);
  const sandboxChess = new Chess(fenBefore);
  const alternativeMovesList = sandboxChess
    .moves({ verbose: true })
    .filter(
      (m) =>
        `${m.from}${m.to}${m.promotion || ""}`.toLowerCase() !==
        calculatedPlayerMove,
    );

  let bestAlternativeExpectedPoints = 0;
  const altEvals = [];

  if (alternativeMovesList.length > 0) {
    const sampleSize = Math.min(alternativeMovesList.length, 4);

    for (let i = 0; i < sampleSize; i++) {
      const altMove = alternativeMovesList[i];
      const tempChess = new Chess(fenBefore);
      tempChess.move(altMove);

      const altOutput = await getAnalysis(tempChess.fen(), 15, analyzePosition);

      const altEP = evalToExpectedPoints(altOutput.evaluation, side);
      bestAlternativeExpectedPoints = Math.max(
        bestAlternativeExpectedPoints,
        altEP,
      );

      let altEvalNum = Number(altOutput.evaluation);
      if (typeof altOutput.evaluation === "string") {
        if (
          altOutput.evaluation.startsWith("M") &&
          !altOutput.evaluation.startsWith("M-")
        )
          altEvalNum = 999;
        if (
          altOutput.evaluation.startsWith("-M") ||
          altOutput.evaluation.startsWith("M-")
        )
          altEvalNum = -999;
      }

      if (!Number.isNaN(altEvalNum)) {
        altEvals.push(altEvalNum);
      }
    }
  }

  
  let isOnlyMoveKeepingAdvantage = false;

  if (side === "white") {
    const sortedAlts = [...altEvals].sort((a, b) => b - a);
    const keepsEvalAboveThreshold = evalAfterNum >= 0.5;
    const alternativesGiveAdvantageToOpponent =
      sortedAlts.length > 0 && sortedAlts[0] <= -0.01;

    if (keepsEvalAboveThreshold && alternativesGiveAdvantageToOpponent) {
      isOnlyMoveKeepingAdvantage = true;
    }
  } else {
    const sortedAlts = [...altEvals].sort((a, b) => a - b);
    const keepsEvalAboveThreshold = evalAfterNum <= -0.5;
    const alternativesGiveAdvantageToOpponent =
      sortedAlts.length > 0 && sortedAlts[0] >= 0.01;

    if (keepsEvalAboveThreshold && alternativesGiveAdvantageToOpponent) {
      isOnlyMoveKeepingAdvantage = true;
    }
  }

  const winEquityGap = topMoveExpectedPoints - bestAlternativeExpectedPoints;

  if (
    alternativeMovesList.length === 0 ||
    winEquityGap >= 0.22 ||
    isOnlyMoveKeepingAdvantage
  ) {
    const isWinningSurge =
      side === "white"
        ? evalAfterNum - evalBeforeNum >= 0.3
        : evalBeforeNum - evalAfterNum >= 0.3;

    const isTightOnlyMove = winEquityGap >= 0.25;

    if (isWinningSurge || isTightOnlyMove || isOnlyMoveKeepingAdvantage) {
      seenGreatPositions.add(greatPositionKey);
      return true;
    }
  }

  return false;
}
