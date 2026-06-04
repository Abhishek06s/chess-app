import React from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import useChessSounds from "../hooks/useChessSounds";

const ChessBoard = ({
  game,
  setGame,
  setMoves,
  boardOrientation,
  addCapturedPiece,
  lastMove,
  setLastMove,
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

        if (result) {
          if (gameCopy.isGameOver()) {
            playGameEndSound();
          }
          else if (gameCopy.isCheck()) {
            playCheckSound();
          }
          else if (result.captured) {
            playCaptureSound();
          }
          else if (result.flags.includes("p")) {
            playPromoteSound();
          }
          else if (result.flags.includes("k") || result.flags.includes("q")) {
            playCastleSound();
          }
          else {
            playMoveSound();
          }
        }

        return true;
      }
    } catch {
      return false;
    }

    return false;
  }

  function onDrop(sourceSquare, targetSquare, piece) {
    const isPawn = piece && piece[1] === "p";
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

  function getSquareStyles(square) {
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

  return (
    <div className="w-full max-w-175">
      <Chessboard
        position={game.fen()}
        boardOrientation={boardOrientation}
        onPieceDrop={onDrop}
        onPromotionPieceSelect={handlePromotionSelect}
        showPromotionDialog={true}
        customSquareStyles={getSquareStyles()}
      />
    </div>
  );
};

export default ChessBoard;
