import { Chess } from "chess.js";

const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

export async function isBrilliantMove({
  fenBefore,
  fenAfter,
  move,
  side,
  evalBefore,
  evalAfter,
  isTopMove,
  isGreatMoveCandidate,
  analyzePosition,
  getAnalysis,
  myPreviousMoveCategory,
  opponentEvalDrop,
  prevEvalBefore,
  prevEvalAfter,
}) {
  const evalBeforeNum = Number(evalBefore);
  let evalAfterNum = Number(evalAfter);
  const prevEvalBeforeNum = prevEvalBefore ? Number(prevEvalBefore) : 0;
  const prevEvalAfterNum = prevEvalAfter ? Number(prevEvalAfter) : 0;

  let parsedEvalBefore = evalBeforeNum;
  if (typeof evalBefore === "string") {
    if (evalBefore.startsWith("M") && !evalBefore.startsWith("M-"))
      parsedEvalBefore = 999;
    if (evalBefore.startsWith("-M") || evalBefore.startsWith("M-"))
      parsedEvalBefore = -999;
  }
  let parsedEvalAfter = evalAfterNum;
  if (typeof evalAfter === "string") {
    if (evalAfter.startsWith("M") && !evalAfter.startsWith("M-"))
      parsedEvalAfter = 999;
    if (evalAfter.startsWith("-M") || evalAfter.startsWith("M-"))
      parsedEvalAfter = -999;
  }

  if (fenBefore) {
    const chessBefore = new Chess(fenBefore);
    if (chessBefore.inCheck()) return false;
  }

  if (String(evalAfter).includes("M")) {
    const isGettingMated =
      side === "white"
        ? String(evalAfter).startsWith("-M") ||
          String(evalAfter).startsWith("M-")
        : String(evalAfter).startsWith("M") &&
          !String(evalAfter).startsWith("M-");
    if (isGettingMated) return false;
  } else if (!isNaN(parsedEvalBefore) && !isNaN(parsedEvalAfter)) {
    const evalLoss =
      side === "white"
        ? parsedEvalBefore - parsedEvalAfter
        : parsedEvalAfter - parsedEvalBefore;
    if (evalLoss > 1.0) return false;
  }

  const isWhite = side === "white";

  if (!isNaN(parsedEvalBefore) && !isNaN(parsedEvalAfter)) {
    const isLosingHeavily = isWhite
      ? parsedEvalBefore <= -4.0
      : parsedEvalBefore >= 4.0;
    if (isLosingHeavily) {
      const recoveredEnough = isWhite
        ? parsedEvalAfter >= -1.3
        : parsedEvalAfter <= 1.3;
      if (!recoveredEnough) return false;
    }

    const isLosingMildly = isWhite
      ? parsedEvalBefore <= -1.0 && parsedEvalBefore > -4.0
      : parsedEvalBefore >= 1.0 && parsedEvalBefore < 4.0;
    if (isLosingMildly) {
      const recoveredEnough = isWhite
        ? parsedEvalAfter > -1.0
        : parsedEvalAfter < 1.0;
      if (!recoveredEnough) return false;
    }
  }

  const chessAfter = new Chess(fenAfter);
  const ourColor = side === "white" ? "w" : "b";
  const enemyColor = side === "white" ? "b" : "w";

  let materialGained = 0;
  if (move.captured) materialGained = PIECE_VALUES[move.captured] || 0;
  if (move.promotion) materialGained += (PIECE_VALUES[move.promotion] || 0) - 1;

  let tokensAfter = chessAfter.fen().split(" ");
  tokensAfter[1] = enemyColor;
  tokensAfter[3] = "-";

  let enemyMovesAfter = [];
  try {
    const testAfter = new Chess(tokensAfter.join(" "));
    enemyMovesAfter = testAfter.moves({ verbose: true });
  } catch (e) {}

  let maxHangingLoss = 0;
  let hangingSquare = null;
  const board = chessAfter.board();

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece && piece.color === ourColor) {
        const pieceValue = PIECE_VALUES[piece.type] || 0;
        if (pieceValue >= 3) {
          const square = ["a", "b", "c", "d", "e", "f", "g", "h"][c] + (8 - r);
          const attacksOnSquare = enemyMovesAfter.filter(
            (m) => m.to === square,
          );

          if (attacksOnSquare.length > 0) {
            const attackedByLesser = attacksOnSquare.some(
              (m) =>
                m.piece !== "k" && (PIECE_VALUES[m.piece] || 0) < pieceValue,
            );
            let isUndefended = false;
            if (!attackedByLesser) {
              const defTestChess = new Chess();
              defTestChess.clear();
              for (let row = 0; row < 8; row++) {
                for (let col = 0; col < 8; col++) {
                  const p = board[row][col];
                  if (p) {
                    const sq =
                      ["a", "b", "c", "d", "e", "f", "g", "h"][col] + (8 - row);
                    if (p.color === ourColor || p.type === "k") {
                      defTestChess.put({ type: p.type, color: p.color }, sq);
                    }
                  }
                }
              }
              defTestChess.put({ type: piece.type, color: enemyColor }, square);
              let defTokens = defTestChess.fen().split(" ");
              defTokens[1] = ourColor;
              defTokens[3] = "-";

              try {
                defTestChess.load(defTokens.join(" "));
                const ourResponses = defTestChess.moves({ verbose: true });
                const isDefended = ourResponses.some((m) => m.to === square);
                isUndefended = !isDefended;
              } catch (e) {
                isUndefended = true;
              }
            }

            if (attackedByLesser || isUndefended) {
              if (pieceValue > maxHangingLoss) {
                maxHangingLoss = pieceValue;
                hangingSquare = square;
              }
            }
          }
        }
      }
    }
  }

  // --- ENDGAME DEAD DRAW GUARD ---
  if (!isNaN(parsedEvalBefore) && !isNaN(parsedEvalAfter)) {
    if (Math.abs(parsedEvalBefore) <= 0.1 && Math.abs(parsedEvalAfter) <= 0.1) {
      const tempChess = new Chess(fenAfter);
      const currentBoard = tempChess.board();
      let totalPieces = 0;

      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          if (currentBoard[r][c]) totalPieces++;
        }
      }

      if (totalPieces <= 6) return false;
    }
  }

  // --- FAKE SACRIFICE AFTER A BLUNDER GUARD ---
  if (
    myPreviousMoveCategory &&
    opponentEvalDrop !== undefined &&
    !isNaN(parsedEvalAfter)
  ) {
    const badMoves = ["mistake", "miss", "blunder"];

    if (
      badMoves.includes(myPreviousMoveCategory.toLowerCase()) &&
      opponentEvalDrop <= 0.5
    ) {
      const isStillWorse =
        side === "white" ? parsedEvalAfter < -0.3 : parsedEvalAfter > 0.3;

      if (isStillWorse) {
        return false;
      }
    }
  }

  let isSacrifice = maxHangingLoss > materialGained;
  if (!isSacrifice) return false;

  if (
    isSacrifice &&
    hangingSquare &&
    !isNaN(parsedEvalBefore) &&
    !isNaN(parsedEvalAfter)
  ) {
    const evalGain = isWhite
      ? prevEvalAfterNum - prevEvalBeforeNum
      : prevEvalBeforeNum - prevEvalAfterNum;

    if (evalGain <= 1.2) {
      const sandboxChess = new Chess(fenAfter);
      const enemyCaptureMoves = sandboxChess
        .moves({ verbose: true })
        .filter((m) => m.to === hangingSquare);

      if (enemyCaptureMoves.length > 0) {
        enemyCaptureMoves.sort(
          (a, b) => (PIECE_VALUES[a.piece] || 0) - (PIECE_VALUES[b.piece] || 0),
        );
        const opponentCapture = enemyCaptureMoves[0];

        sandboxChess.move(opponentCapture);

        const ourRecaptures = sandboxChess
          .moves({ verbose: true })
          .filter((m) => m.captured);

        let canWinMaterialBack = false;
        for (const recapture of ourRecaptures) {
          const recapturedValue = PIECE_VALUES[recapture.captured] || 0;
          if (recapturedValue >= maxHangingLoss) {
            canWinMaterialBack = true;
            break;
          }
        }

        if (canWinMaterialBack) {
          return false;
        }
      }
    }
  }

  if (isSacrifice && isGreatMoveCandidate) {
    return true;
  }

  if (!isNaN(parsedEvalBefore)) {
    const isCrushing = isWhite
      ? parsedEvalBefore >= 3.0
      : parsedEvalBefore <= -3.0;
    if (isCrushing && !isTopMove) return false;

    const isOverwhelming = isWhite
      ? parsedEvalBefore > 5.5
      : parsedEvalBefore < -5.5;

    const getMateDistance = (evalStr) => {
      if (typeof evalStr !== "string" || !evalStr.includes("M")) return null;
      const dist = parseInt(evalStr.replace(/[^\d]/g, ""), 10);
      return isNaN(dist) ? null : dist;
    };

    if (isOverwhelming && analyzePosition && getAnalysis && fenBefore) {
      const sandboxChess = new Chess(fenBefore);
      const calculatedPlayerMove =
        `${move.from}${move.to}${move.promotion || ""}`.toLowerCase().trim();

      const alternativeMovesList = sandboxChess
        .moves({ verbose: true })
        .filter(
          (m) =>
            `${m.from}${m.to}${m.promotion || ""}`.toLowerCase().trim() !==
            calculatedPlayerMove,
        );

      if (alternativeMovesList.length > 0) {
        const sampleSize = Math.min(alternativeMovesList.length, 3);
        let hasSafeAlternative = false;
        let hasFasterMate = false;

        const playerMateDistance = getMateDistance(evalAfter);

        for (let i = 0; i < sampleSize; i++) {
          const altMove = alternativeMovesList[i];
          const tempChess = new Chess(fenBefore);
          tempChess.move(altMove);

          const altOutput = await getAnalysis(
            tempChess.fen(),
            13,
            analyzePosition,
          );

          const altMateDistance = getMateDistance(altOutput.evaluation);

          if (playerMateDistance !== null) {
            const isOurMate = isWhite
              ? typeof altOutput.evaluation === "string" &&
                altOutput.evaluation.startsWith("M") &&
                !altOutput.evaluation.startsWith("M-")
              : typeof altOutput.evaluation === "string" &&
                (altOutput.evaluation.startsWith("-M") ||
                  altOutput.evaluation.startsWith("M-"));

            if (
              isOurMate &&
              altMateDistance !== null &&
              altMateDistance < playerMateDistance
            ) {
              hasFasterMate = true;
              break;
            }
          }

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

          if (!isNaN(altEvalNum)) {
            const evalDrop = isWhite
              ? parsedEvalBefore - altEvalNum
              : altEvalNum - parsedEvalBefore;

            if (evalDrop <= 2.5) {
              hasSafeAlternative = true;
              break;
            }
          }
        }

        if (
          hasFasterMate ||
          (playerMateDistance === null && hasSafeAlternative)
        ) {
          return false;
        }
      }
    }
  }

  return true;
}
