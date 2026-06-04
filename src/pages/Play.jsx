import React, { useState, useEffect } from "react";
import { Chess } from "chess.js";

import ChessBoard from "../components/ChessBoard";
import GameSidebar from "../components/GameSidebar";
import PlayerCard from "../components/PlayerCard";

import useChessClock from "../hooks/useChessClock";
import useCapturedPieces from "../hooks/useCapturedPieces";
import useMoveNavigation from "../hooks/useMoveNavigation";

const Play = () => {
  const [game, setGame] = useState(new Chess());
  const [moves, setMoves] = useState([]);
  const [playerColor, setPlayerColor] = useState("white");
  const [boardOrientation, setBoardOrientation] = useState("white");
  const [gameStarted, setGameStarted] = useState(false);
  const [lastMove, setLastMove] = useState(null);
  const [gameResult, setGameResult] = useState("");

  const { whiteTime, blackTime, resetClock } = useChessClock(
    game,
    moves,
    gameStarted,
    600,
  );

  const {
    capturedPieces,
    addCapturedPiece,
    resetCapturedPieces,
    whiteAdvantage,
    blackAdvantage,
    groupedWhitePieces,
    groupedBlackPieces,
  } = useCapturedPieces();

  const {
    moveIndex,
    setMoveIndex,
    getPositionAtMove,
    goToFirst,
    goToPrevious,
    goToNext,
    goToLast,
  } = useMoveNavigation(moves);

  const flipBoard = () => {
    setBoardOrientation((prev) => (prev === "white" ? "black" : "white"));
  };

  const whiteFlagged = whiteTime === 0;
  const blackFlagged = blackTime === 0;

  useEffect(() => {
    if (whiteFlagged) {
      setGameResult("🏆 Black Wins on Time");
    } else if (blackFlagged) {
      setGameResult("🏆 White Wins on Time");
    } else if (game.isCheckmate()) {
      const winner = game.turn() === "w" ? "Black" : "White";

      setGameResult(`🏆 ${winner} Wins by Checkmate`);
    } else if (game.isStalemate()) {
      setGameResult("🤝 Draw by Stalemate");
    } else if (game.isInsufficientMaterial()) {
      setGameResult("🤝 Draw by Insufficient Material");
    } else if (game.isThreefoldRepetition()) {
      setGameResult("🤝 Draw by Repetition");
    } else if (game.isDraw()) {
      setGameResult("🤝 Draw");
    } else {
      setGameResult("");
    }
  }, [game, whiteFlagged, blackFlagged]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8">
      <h1 className="text-3xl font-bold mb-6 text-white p-3 bg-linear-to-r from-zinc-900 to-zinc-950 rounded-md">
        Play Chess
      </h1>

      <div className="grid lg:grid-cols-[550px_1fr] gap-50">
        <div>
          <PlayerCard
            name="Opponent"
            rating={1850}
            isOnline={true}
            color={playerColor === "white" ? "black" : "white"}
            time={playerColor === "white" ? blackTime : whiteTime}
            isActive={
              !game.isGameOver() &&
              (playerColor === "white"
                ? game.turn() === "b"
                : game.turn() === "w")
            }
            capturedPieces={
              playerColor === "white" ? groupedWhitePieces : groupedBlackPieces
            }
            advantage={
              playerColor === "white" ? blackAdvantage : whiteAdvantage
            }
          />

          {gameResult && (
            <div className="mb-6 bg-linear-to-r from-green-600 to-green-500 text-white p-4 rounded-xl text-center text-xl font-bold shadow-lg">
              {gameResult}
            </div>
          )}

          <div className="my-4">
            <ChessBoard
              game={game}
              setGame={setGame}
              setMoves={setMoves}
              boardOrientation={boardOrientation}
              addCapturedPiece={addCapturedPiece}
              lastMove={lastMove}
              setLastMove={setLastMove}
            />
          </div>

          <PlayerCard
            name="You"
            rating={1650}
            isOnline={true}
            color={playerColor}
            time={playerColor === "white" ? whiteTime : blackTime}
            isActive={
              !game.isGameOver() &&
              (playerColor === "white"
                ? game.turn() === "w"
                : game.turn() === "b")
            }
            capturedPieces={
              playerColor === "white" ? groupedBlackPieces : groupedWhitePieces
            }
            advantage={
              playerColor === "white" ? whiteAdvantage : blackAdvantage
            }
          />
        </div>

        <div className="bg-zinc-900 rounded-2xl p-6">
          <GameSidebar
            moves={moves}
            game={game}
            setGame={setGame}
            setMoves={setMoves}
            flipBoard={flipBoard}
            resetClock={resetClock}
            setGameStarted={setGameStarted}
            whiteFlagged={whiteFlagged}
            blackFlagged={blackFlagged}
            resetCapturedPieces={resetCapturedPieces}
            moveIndex={moveIndex}
            goToFirst={goToFirst}
            goToPrevious={goToPrevious}
            goToNext={goToNext}
            goToLast={goToLast}
          />
        </div>
      </div>
    </div>
  );
};

export default Play;
