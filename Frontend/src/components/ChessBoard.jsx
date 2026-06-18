import React, { forwardRef, useMemo } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import useChessSounds from "../hooks/useChessSounds";
import { Crown, Flag, Timer } from "lucide-react";

const ChessBoard = ({
  game,
  setGame,
  setMoves,
  boardOrientation,
  addCapturedPiece,
  lastMove,
  setLastMove,
  endgame,
}) => {
  const {
    playMoveSound,
    playCaptureSound,
    playCheckSound,
    playCastleSound,
    playPromoteSound,
    playGameEndSound,
  } = useChessSounds();

  function makeMove(move) {
    const gameCopy = new Chess(game.fen());

    try {
      const capturedPiece = game.get(move.to);
      const result = gameCopy.move(move);

      if (result) {
        setGame(gameCopy);
        setMoves((prevMoves) => [...prevMoves, result.san]);

        setLastMove({
          from: move.from,
          to: move.to,
        });

        if (capturedPiece) {
          addCapturedPiece(capturedPiece);
        }

        if (gameCopy.isGameOver()) {
          playGameEndSound();
        } else if (gameCopy.isCheck()) {
          playCheckSound();
        } else if (result.captured) {
          playCaptureSound();
        } else if (result.flags.includes("p")) {
          playPromoteSound();
        } else if (result.flags.includes("k") || result.flags.includes("q")) {
          playCastleSound();
        } else {
          playMoveSound();
        }

        return true;
      }
    } catch {
      return false;
    }

    return false;
  }

  function onDrop(sourceSquare, targetSquare, piece) {
    const isPawn = piece && piece[1].toLowerCase() === "p";
    const isPromotionRank = targetSquare[1] === "8" || targetSquare[1] === "1";

    if (isPawn && isPromotionRank) {
      return true;
    }

    return makeMove({
      from: sourceSquare,
      to: targetSquare,
    });
  }

  function handlePromotionSelect(piece, promoteFromSquare, promoteToSquare) {
    if (!piece) return false;
    const promotionPieceLetter = piece[1].toLowerCase();

    return makeMove({
      from: promoteFromSquare,
      to: promoteToSquare,
      promotion: promotionPieceLetter,
    });
  }

  function getSquareStyles() {
    return {
      ...(lastMove?.from && {
        [lastMove.from]: {
          backgroundColor: "rgba(255,255,0,0.4)",
        },
      }),
      ...(lastMove?.to && {
        [lastMove.to]: {
          backgroundColor: "rgba(255,255,0,0.4)",
        },
      }),
    };
  }

  const findKingSquare = (game, color) => {
    const board = game.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (piece && piece.type === "k" && piece.color === color) {
          return `${String.fromCharCode(97 + c)}${8 - r}`;
        }
      }
    }
    return null;
  };

  const whiteKingSquare = findKingSquare(game, "w");
  const blackKingSquare = findKingSquare(game, "b");

  let winningSquare = null;
  let losingSquare = null;

  if (endgame && endgame.type) {
    if (endgame.winner === "w") {
      winningSquare = whiteKingSquare;
      losingSquare = blackKingSquare;
    } else if (endgame.winner === "b") {
      winningSquare = blackKingSquare;
      losingSquare = whiteKingSquare;
    }
  }

  // Memoize the custom square component to prevent 64 unmounts per move
  const CustomSquare = useMemo(() => {
    return forwardRef(({ children, square, style, squareColor,...rest }, ref) => {
      return (
        <div ref={ref} style={{ ...style, position: "relative" }} {...rest}>
          {/* Render the actual square tile contents and piece */}
          {children}

          {/* WINNING KING DECORATION */}
          {square === winningSquare && (
            <div className="absolute top-0 right-0 z-100 pointer-events-none text-2xl drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] animate-pop-snap">
              <Crown className="w-5 h-5 text-green-600 fill-green-400/80 stroke-2" />
            </div>
          )}

          {/* LOSING KING DECORATION */}
          {square === losingSquare && (
            <div className="absolute top-0 right-0 z-100 pointer-events-none drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)]">
              {endgame.type === "resignation" && (
                <Flag className="w-5 h-5 text-zinc-300 fill-white/90 stroke-2 animate-pop-snap" />
              )}
              {endgame.type === "time" && <Timer className="w-5 h-5 text-red-700 fill-red-300 animate-pop-snap stroke-2" />}
              {endgame.type === "checkmate" && (
                <div className="w-6 h-6 rounded-full bg-rose-600 border-2 border-white flex items-center justify-center font-bold text-xs text-white shadow-lg animate-pop-snap">
                  ♔
                </div>
              )}
            </div>
          )}
        </div>
      );
    });
  }, [winningSquare, losingSquare, endgame?.type]);


  return (
    <div className="w-full max-w-175">
      <Chessboard
        position={game.fen()}
        boardOrientation={boardOrientation}
        onPieceDrop={onDrop}
        onPromotionPieceSelect={handlePromotionSelect}
        showPromotionDialog={true}
        customSquareStyles={getSquareStyles()}
        customSquare={CustomSquare}
      />
    </div>
  );
};

export default ChessBoard;
