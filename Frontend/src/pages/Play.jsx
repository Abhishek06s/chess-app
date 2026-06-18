import React, { useState, useEffect } from "react";
import { Chess } from "chess.js";

import ChessBoard from "../components/ChessBoard";
import GameSidebar from "../components/GameSidebar";
import PlayerCard from "../components/PlayerCard";

import useChessClock from "../hooks/useChessClock";
import useCapturedPieces from "../hooks/useCapturedPieces";
import { generateGuestUser } from "../utils/guestUtil";
import { useAuth } from "../context/authContext";
import useChessSounds from "../hooks/useChessSounds";

const Play = () => {
  const { user: authUser, loading: authLoading } = useAuth();

  const [guestUser, setGuestUser] = useState(null);
  const activeUser = authUser || guestUser;
  const isLoggedIn = !!authUser;

  const [game, setGame] = useState(new Chess());
  const [moves, setMoves] = useState([]);
  const [playerColor, setPlayerColor] = useState("white");
  const [boardOrientation, setBoardOrientation] = useState("white");
  const [gameStarted, setGameStarted] = useState(false);
  const [lastMove, setLastMove] = useState(null);
  const [gameResult, setGameResult] = useState("");
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [endgame, setEndgame] = useState({ type: null, winner: null });

  const [timeControl, setTimeControl] = useState({ base: 600, increment: 0 });

  const gameType = "rapid";
  const playerRating = activeUser?.stats?.[gameType]?.rating ?? 1200;

  const { whiteTime, blackTime, resetClock } = useChessClock(
    game,
    moves,
    gameStarted,
    timeControl.base,
    timeControl.increment,
  );

  const chessSounds = useChessSounds();

  const {
    capturedPieces,
    addCapturedPiece,
    resetCapturedPieces,
    whiteAdvantage,
    blackAdvantage,
    groupedWhitePieces,
    groupedBlackPieces,
  } = useCapturedPieces();

  const flipBoard = () => {
    setBoardOrientation((prev) => (prev === "white" ? "black" : "white"));
  };

  const whiteFlagged = whiteTime === 0;
  const blackFlagged = blackTime === 0;
  const isGameOver =
    game.isGameOver() || whiteFlagged || blackFlagged || !!endgame.type;

  useEffect(() => {
    const storedGuest = localStorage.getItem("guestUser");

    if (storedGuest) {
      setGuestUser(JSON.parse(storedGuest));
    }
  }, []);

  useEffect(() => {
    if (whiteFlagged) {
      setGameResult("🏆 Black Wins on Time");
      setEndgame({ type: "time", winner: "b" });
      setGameStarted(false);
    } else if (blackFlagged) {
      setGameResult("🏆 White Wins on Time");
      setEndgame({ type: "time", winner: "w" });
      setGameStarted(false);
    } else if (game.isCheckmate()) {
      const winnerColor = game.turn() === "w" ? "b" : "w";
      const winnerName = winnerColor === "w" ? "White" : "Black";
      setGameResult(`🏆 ${winnerName} Wins by Checkmate`);
      setEndgame({ type: "checkmate", winner: winnerColor });
      setGameStarted(false);
    } else if (game.isStalemate()) {
      setGameResult("🤝 Draw by Stalemate");
      setEndgame({ type: "draw", winner: null });
      setGameStarted(false);
    } else if (game.isInsufficientMaterial()) {
      setGameResult("🤝 Draw by Insufficient Material");
      setEndgame({ type: "draw", winner: null });
      setGameStarted(false);
    } else if (game.isThreefoldRepetition()) {
      setGameResult("🤝 Draw by Repetition");
      setEndgame({ type: "draw", winner: null });
      setGameStarted(false);
    } else if (game.isDraw()) {
      setGameResult("🤝 Draw");
      setEndgame({ type: "draw", winner: null });
      setGameStarted(false);
    } else {
      if (moves.length === 0) {
        setGameResult("");
        setEndgame({ type: null, winner: null });
      }
    }
  }, [game, whiteFlagged, blackFlagged, moves.length]);

  const handleGameAction = (actionType) => {
    setGameStarted(false);
    if (actionType === "abort") {
      setGameResult("❌ Game Aborted");
      setEndgame({ type: "abort", winner: null });
    } else if (actionType === "resign") {
      const winner = game.turn() === "w" ? "Black" : "White";
      const winnerColor = game.turn() === "w" ? "b" : "w";
      setGameResult(`🏆 ${winner} Wins by Resignation`);
      setEndgame({ type: "resignation", winner: winnerColor });
    } else if (actionType === "draw") {
      setGameResult("🤝 Draw by Mutual Agreement");
      setEndgame({ type: "draw", winner: null });
    }
    chessSounds.playGameEndSound();
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-400">
        <div className="animate-pulse tracking-widest uppercase text-xs font-semibold">
          Loading Setup...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white py-8 px-4 md:px-12 lg:px-20 antialiased selection:bg-purple-500/30">
      <h1 className="text-2xl font-bold tracking-tight mb-8 text-white p-4 bg-zinc-900 border border-white/10 rounded-xl shadow-lg flex items-center justify-between">
        <span>Play Chess</span>
        {activeUser?.isGuest && (
          <span className="text-xs bg-amber-500/10 text-amber-400 border border-white/10 px-2.5 py-1 rounded-md font-medium">
            Guest Mode
          </span>
        )}
      </h1>

      <div className="grid lg:grid-cols-[550px_1fr] gap-8 xl:gap-12 items-start">
        {/* Board Container Column */}
        <div className="flex flex-col gap-4 max-w-137.5">
          <PlayerCard
            name="Opponent"
            rating={playerRating + 155}
            isOnline={true}
            color={playerColor === "white" ? "black" : "white"}
            time={playerColor === "white" ? blackTime : whiteTime}
            isActive={
              !isGameOver &&
              gameStarted &&
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
            <div className="bg-linear-to-r from-emerald-600 to-teal-500 text-white p-4 rounded-xl text-center text-lg font-bold shadow-xl border border-white/10">
              {gameResult}
            </div>
          )}

          <div className="my-1 bg-zinc-900 border border-white/10 p-3 rounded-2xl shadow-2xl">
            <ChessBoard
              game={game}
              setGame={setGame}
              setMoves={setMoves}
              boardOrientation={boardOrientation}
              addCapturedPiece={addCapturedPiece}
              lastMove={lastMove}
              setLastMove={setLastMove}
              endgame={endgame}
            />
          </div>

          <PlayerCard
            name={activeUser ? activeUser.username : "You"}
            rating={playerRating}
            isOnline={true}
            color={playerColor}
            time={playerColor === "white" ? whiteTime : blackTime}
            isActive={
              !isGameOver &&
              gameStarted &&
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

        {/* Action Panel Sidebar Column */}
        <div className="bg-zinc-900 rounded-2xl border border-white/10 p-6 shadow-xl h-165">
          <GameSidebar
            moves={moves}
            game={game}
            setGame={setGame}
            setMoves={setMoves}
            flipBoard={flipBoard}
            resetClock={resetClock}
            setGameStarted={setGameStarted}
            gameStarted={gameStarted}
            isGameOver={isGameOver}
            whiteFlagged={whiteFlagged}
            blackFlagged={blackFlagged}
            resetCapturedPieces={resetCapturedPieces}
            isLoggedIn={isLoggedIn}
            activeUser={activeUser}
            onAuthRequired={() => setShowAuthModal(true)}
            timeControl={timeControl}
            setTimeControl={setTimeControl}
            onGameAction={handleGameAction}
            setEndgame={setEndgame}
          />
        </div>
      </div>

      {/* AUTH OVERLAY SCREEN */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center">
            <div className="w-12 h-12 bg-purple-600/10 text-purple-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/10 text-xl font-bold">
              ♟
            </div>
            <h3 className="text-xl font-bold mb-2 text-zinc-100">
              Sign in to Play
            </h3>
            <p className="text-sm text-zinc-400 mb-6 leading-relaxed">
              Log in to lock in your live stats rating, rank up on your profile,
              and analyze configurations.
            </p>
            <div className="flex flex-col gap-2.5">
              <button
                onClick={() => {
                  window.location.href = "/login";
                }}
                className="w-full py-3.5 bg-purple-600 hover:bg-purple-500 text-sm font-semibold transition rounded-xl shadow-lg"
              >
                Sign In / Register
              </button>
              <button
                onClick={() => {
                  const guest = generateGuestUser();
                  setGuestUser(guest);
                  localStorage.setItem("guestUser", JSON.stringify(guest));
                  setShowAuthModal(false);
                }}
                className="w-full py-3.5 bg-zinc-800 hover:bg-zinc-750 text-sm font-semibold transition rounded-xl text-zinc-300 border border-white/10"
              >
                Play as Guest
              </button>
              <button
                onClick={() => setShowAuthModal(false)}
                className="mt-2 text-zinc-500 hover:text-zinc-400 text-xs font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Play;
