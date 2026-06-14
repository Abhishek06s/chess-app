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
  prevEvalBefore,
  prevEvalAfter
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
  const prevEvalBeforeNum = prevEvalBefore ? Number(prevEvalBefore) : 0;
  const prevEvalAfterNum = prevEvalAfter ? Number(prevEvalAfter) : 0;

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

  const isCrushingBefore =
    side === "white" ? prevEvalBeforeNum >= 5.5 : prevEvalBeforeNum <= -5.5;

  const topMoveExpectedPoints = evalToExpectedPoints(evalAfter, side);

  let bestAlternativeExpectedPoints = 0;
  const altEvals = [];

  let topEngineLines = [];
  try {
    const multiPvOutput = await getAnalysis(fenBefore, 15, analyzePosition, {
      multiPV: 4,
    });
    topEngineLines = Array.isArray(multiPvOutput)
      ? multiPvOutput
      : multiPvOutput.lines || [multiPvOutput];
  } catch (e) {}

  if (topEngineLines.length > 0) {
    for (const line of topEngineLines) {
      const engineMove = String(line.bestMoveRaw || line.move || "")
        .toLowerCase()
        .trim();

      if (engineMove === calculatedPlayerMove || !engineMove) continue;

      const altEP = evalToExpectedPoints(line.evaluation, side);
      bestAlternativeExpectedPoints = Math.max(
        bestAlternativeExpectedPoints,
        altEP,
      );

      let altEvalNum = Number(line.evaluation);
      if (typeof line.evaluation === "string") {
        if (
          line.evaluation.startsWith("M") &&
          !line.evaluation.startsWith("M-")
        )
          altEvalNum = 999;
        if (
          line.evaluation.startsWith("-M") ||
          line.evaluation.startsWith("M-")
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

  if(winEquityGap <= 0.15 && isCrushingBefore){
    return false;
  }

  const isWinningSurge =
    (side === "white")
      ? prevEvalAfterNum - prevEvalBeforeNum >= 0.5 
      : prevEvalBeforeNum - prevEvalAfterNum >= 0.5;

  if (
    topEngineLines.length <= 1 ||
    winEquityGap >= 0.2 ||
    isOnlyMoveKeepingAdvantage ||
    isWinningSurge
  ) {

  const isTightOnlyMove = winEquityGap >= 0.2;

  if(move.lan === "f5d3"){
  console.log({
    isOnlyMoveKeepingAdvantage, isTightOnlyMove, isWinningSurge
  });}

    if (isWinningSurge || isTightOnlyMove || isOnlyMoveKeepingAdvantage) {
      seenGreatPositions.add(greatPositionKey);
      return true;
    }
  }

  if(move.lan === "d6d5"){
  console.log({
    isTopMove, isForced, isBookMove, isRecapture,
    isObviousEscape, isForcedTacticalChoice, isForcedKingEscape,
    winEquityGap
  });
  }


  return false;
}
