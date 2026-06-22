import React, { useState, useEffect } from "react";
import { Chess } from "chess.js";
import { Trophy, Scale, XCircle } from "lucide-react";

import ChessBoard from "../components/ChessBoard";
import GameSidebar from "../components/GameSidebar";
import PlayerCard from "../components/PlayerCard";
import MultiplayerTester from "../components/MultiplayerTester";

import useChessClock from "../hooks/useChessClock";
import useCapturedPieces from "../hooks/useCapturedPieces";
import { generateGuestUser } from "../utils/guestUtil";
import { useAuth } from "../context/authContext";
import useChessSounds from "../hooks/useChessSounds";

import { createGame } from "../services/game.service";
import { socket } from "../services/socket.service";
import openings from "../data/openings";

const getBannerConfig = (resultString) => {
  if (resultString.includes("Wins")) {
    return {
      icon: <Trophy className="w-6 h-6 text-yellow-300 drop-shadow-md" />,
      bg: "bg-gradient-to-r from-emerald-600 to-teal-600",
      border: "border-emerald-400/40",
      shadow: "shadow-emerald-900/50",
    };
  }
  if (resultString.includes("Draw")) {
    return {
      icon: <Scale className="w-6 h-6 text-blue-200 drop-shadow-md" />,
      bg: "bg-gradient-to-r from-slate-700 to-slate-600",
      border: "border-slate-400/40",
      shadow: "shadow-slate-900/50",
    };
  }
  if (resultString.includes("Aborted")) {
    return {
      icon: <XCircle className="w-6 h-6 text-red-100 drop-shadow-md" />,
      bg: "bg-gradient-to-r from-red-600 to-rose-600",
      border: "border-red-400/40",
      shadow: "shadow-red-900/50",
    };
  }

  return {
    icon: <Trophy className="w-6 h-6 text-zinc-200" />,
    bg: "bg-zinc-800",
    border: "border-zinc-600",
    shadow: "shadow-black/50",
  };
};

const calculateGameType = (baseInSeconds, incrementInSeconds) => {
  const totalEstimatedTime = baseInSeconds + incrementInSeconds * 40;
  if (totalEstimatedTime < 180) return "bullet";
  if (totalEstimatedTime < 600) return "blitz";
  return "rapid";
};

const Play = () => {
  const { user, loading: authLoading } = useAuth();

  const [guestUser, setGuestUser] = useState(null);
  const activeUser = user || guestUser;
  const isLoggedIn = !!user;

  const [game, setGame] = useState(new Chess());
  const [moves, setMoves] = useState([]);
  const [playerColor, setPlayerColor] = useState("white");
  const [boardOrientation, setBoardOrientation] = useState("white");
  const [gameStarted, setGameStarted] = useState(false);
  const [lastMove, setLastMove] = useState(null);
  const [gameResult, setGameResult] = useState("");
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [endgame, setEndgame] = useState({ type: null, winner: null });
  const [gameMode, setGameMode] = useState("bot");
  const [showMultiplayerLobby, setShowMultiplayerLobby] = useState(false);
  const [timeControl, setTimeControl] = useState({ base: 600, increment: 0 });

  const [roomId, setRoomId] = useState("");
  const [multiplayerColor, setMultiplayerColor] = useState(null);

  const [incomingDrawOffer, setIncomingDrawOffer] = useState(false);
  const [drawOfferPending, setDrawOfferPending] = useState(false);

  const [whitePlayerName, setWhitePlayerName] = useState("White");
  const [blackPlayerName, setBlackPlayerName] = useState("Black");
  const [whitePlayerRating, setWhitePlayerRating] = useState(1200);
  const [blackPlayerRating, setBlackPlayerRating] = useState(1200);
  const [whitePlayerId, setWhitePlayerId] = useState(null);
  const [blackPlayerId, setBlackPlayerId] = useState(null);

  const [multiplayerWhiteTime, setMultiplayerWhiteTime] = useState(
    timeControl.base * 1000,
  );
  const [multiplayerBlackTime, setMultiplayerBlackTime] = useState(
    timeControl.base * 1000,
  );

  useEffect(() => {
    if (!gameStarted) {
      setMultiplayerWhiteTime(timeControl.base * 1000);
      setMultiplayerBlackTime(timeControl.base * 1000);
    }
  }, [timeControl.base]);

  const gameType = calculateGameType(timeControl.base, timeControl.increment);

  const { whiteTime, blackTime, resetClock } = useChessClock(
    game,
    moves,
    gameStarted,
    timeControl.base,
    timeControl.increment,
  );

  const displayWhiteTime =
    gameMode === "multiplayer" ? multiplayerWhiteTime : whiteTime;

  const displayBlackTime =
    gameMode === "multiplayer" ? multiplayerBlackTime : blackTime;

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

  const whiteFlagged =
    gameMode === "multiplayer" ? multiplayerWhiteTime === 0 : whiteTime === 0;

  const blackFlagged =
    gameMode === "multiplayer" ? multiplayerBlackTime === 0 : blackTime === 0;

  const isGameOver =
    game.isGameOver() || whiteFlagged || blackFlagged || !!endgame.type;

  useEffect(() => {
    const storedGuest = localStorage.getItem("guestUser");
    if (storedGuest) {
      setGuestUser(JSON.parse(storedGuest));
    }
  }, []);

  useEffect(() => {
    if (activeUser && gameMode === "bot") {
      const userRating =
        activeUser.stats?.[gameType]?.rating || activeUser.rating || 1200;

      if (playerColor === "white") {
        setWhitePlayerRating(userRating);
        setBlackPlayerRating(1500);
      } else {
        setBlackPlayerRating(userRating);
        setWhitePlayerRating(1500);
      }
    }
  }, [activeUser, gameMode, gameType, playerColor]);

  /**
   * DRAW CONDITION
   */

  useEffect(() => {
    const handleDrawOfferReceived = () => {
      setIncomingDrawOffer(true);
    };

    const handleDrawAccepted = () => {
      setIncomingDrawOffer(false);
      setDrawOfferPending(false);

      setGameStarted(false);

      setGameResult("🤝 Draw by Mutual Agreement");

      setEndgame({
        type: "draw",
        winner: null,
      });

      chessSounds.playGameEndSound();
    };

    const handleDrawDeclined = () => {
      setIncomingDrawOffer(false);
      setDrawOfferPending(false);
    };

    socket.on("draw-offer-received", handleDrawOfferReceived);
    socket.on("draw-accepted", handleDrawAccepted);
    socket.on("draw-declined", handleDrawDeclined);

    return () => {
      socket.off("draw-offer-received", handleDrawOfferReceived);
      socket.off("draw-accepted", handleDrawAccepted);
      socket.off("draw-declined", handleDrawDeclined);
    };
  }, []);

  const acceptDrawOffer = () => {
    socket.emit("draw-response", {
      roomId,
      accepted: true,
    });
  };

  const declineDrawOffer = () => {
    socket.emit("draw-response", {
      roomId,
      accepted: false,
    });

    setIncomingDrawOffer(false);
  };

  /**
   * RESIGN CONDITION
   */

  useEffect(() => {
    const handlePlayerResigned = ({ winner }) => {
      setGameStarted(false);

      const winnerName = winner === "white" ? "White" : "Black";

      setGameResult(`🏆 ${winnerName} Wins by Resignation`);

      setEndgame({
        type: "resignation",
        winner: winner === "white" ? "w" : "b",
      });

      chessSounds.playGameEndSound();
    };

    socket.on("player-resigned", handlePlayerResigned);

    return () => {
      socket.off("player-resigned", handlePlayerResigned);
    };
  }, []);

  /**
   * ABORT CONDITION
   */

  useEffect(() => {
    const handleGameAborted = () => {
      setGameStarted(false);

      setGameResult("❌ Game Aborted");

      setEndgame({
        type: "abort",
        winner: null,
      });

      chessSounds.playGameEndSound();
    };

    socket.on("game-aborted", handleGameAborted);

    return () => {
      socket.off("game-aborted", handleGameAborted);
    };
  }, []);

  /**
   * TIMEOUT CONDITION
   */

  useEffect(() => {
    const handleTimeout = ({ winner }) => {
      setGameStarted(false);

      if (winner === "w") {
        setGameResult("🏆 White Wins on Time");
        setEndgame({
          type: "time",
          winner: "w",
        });
      } else {
        setGameResult("🏆 Black Wins on Time");
        setEndgame({
          type: "time",
          winner: "b",
        });
      }

      chessSounds.playGameEndSound();
    };

    socket.on("timeout", handleTimeout);

    return () => {
      socket.off("timeout", handleTimeout);
    };
  }, []);

  /**
   * DISCONNECT CONDITION
   */

  useEffect(() => {
    const handlePlayerDisconnected = ({ winner }) => {
      setGameStarted(false);

      const winnerText = winner === "w" ? "White" : "Black";

      setGameResult(`🏆 ${winnerText} Wins by Abandonment`);

      setEndgame({
        type: "abandonment",
        winner,
      });

      chessSounds.playGameEndSound();
    };

    socket.on("player-disconnected", handlePlayerDisconnected);

    return () => {
      socket.off("player-disconnected", handlePlayerDisconnected);
    };
  }, []);

  const saveGameToDatabase = async (
    result,
    termination,
    finalWhiteTime,
    finalBlackTime,
    overrideOpponentType,
    overrideOpponentName,
  ) => {
    if (!user) return;

    try {
      const cleanGameInstance = new Chess();
      const fenHistory = [cleanGameInstance.fen()];

      moves.forEach((move) => {
        try {
          cleanGameInstance.move(move);
          fenHistory.push(cleanGameInstance.fen());
        } catch (e) {
          console.error("Error structural replaying move logic:", move, e);
        }
      });

      const finalPgn = cleanGameInstance.pgn();
      const finalFen = cleanGameInstance.fen();
      const finalMovesArray = cleanGameInstance.history();

      let openingData = { name: "Custom Variation / Open Game", eco: "A00" };
      for (let i = fenHistory.length - 1; i >= 0; i--) {
        const currentFen = fenHistory[i];
        if (openings[currentFen]) {
          openingData = {
            name: openings[currentFen].name,
            eco: openings[currentFen].eco || "A00",
          };
          break;
        }
        const strippedFen = currentFen.split(" ").slice(0, 4).join(" ");
        const matchingKey = Object.keys(openings).find((key) =>
          key.startsWith(strippedFen),
        );
        if (matchingKey) {
          openingData = {
            name: openings[matchingKey].name,
            eco: openings[matchingKey].eco || "A00",
          };
          break;
        }
      }

      const currentUserId = user._id || user.id;
      const isMultiplayer = gameMode === "multiplayer";

      const finalOpponentType =
        overrideOpponentType || (isMultiplayer ? "human" : "bot");
      const finalOpponentName =
        overrideOpponentName ||
        (isMultiplayer
          ? playerColor === "white"
            ? blackPlayerName
            : whitePlayerName
          : "Stockfish Bot");

      const formattedWhiteTime = Math.max(0, Math.round(finalWhiteTime / 1000));
      const formattedBlackTime = Math.max(0, Math.round(finalBlackTime / 1000));

      await createGame({
        whitePlayer: gameMode === "multiplayer" ? whitePlayerId : currentUserId,
        blackPlayer: gameMode === "multiplayer" ? blackPlayerId : currentUserId,
        pgn: finalPgn,
        fen: finalFen,
        moves: finalMovesArray,
        result,
        opening: openingData,
        timeControl: {
          base: timeControl.base,
          increment: timeControl.increment,
        },
        gameType,
        whiteTimeRemaining: formattedWhiteTime,
        blackTimeRemaining: formattedBlackTime,
        opponentType: finalOpponentType,
        opponentName: finalOpponentName,
        rated: true,
        termination,
        status: "completed",
      });
    } catch (error) {
      console.error(
        "Database tracking persist save transaction failed:",
        error,
      );
    }
  };

  useEffect(() => {
    if (endgame.type) return;

    if (whiteFlagged) {
      setGameResult("🏆 Black Wins on Time");
      setEndgame({ type: "time", winner: "b" });
      setGameStarted(false);
      if (gameMode === "multiplayer") {
        socket.emit("game-over", { roomId });
      }
      saveGameToDatabase("0-1", "timeout", 0, blackTime);
    } else if (blackFlagged) {
      setGameResult("🏆 White Wins on Time");
      setEndgame({ type: "time", winner: "w" });
      setGameStarted(false);
      if (gameMode === "multiplayer") {
        socket.emit("game-over", { roomId });
      }
      saveGameToDatabase("1-0", "timeout", whiteTime, 0);
    } else if (game.isCheckmate()) {
      const winnerColor = game.turn() === "w" ? "b" : "w";
      const winnerName = winnerColor === "w" ? "White" : "Black";
      setGameResult(`🏆 ${winnerName} Wins by Checkmate`);
      setEndgame({ type: "checkmate", winner: winnerColor });
      setGameStarted(false);
      if (gameMode === "multiplayer") {
        socket.emit("game-over", { roomId });
      }
      const result = winnerColor === "w" ? "1-0" : "0-1";
      saveGameToDatabase(result, "checkmate", whiteTime, blackTime);
    } else if (game.isStalemate()) {
      setGameResult("🤝 Draw by Stalemate");
      setEndgame({ type: "draw", winner: null });
      setGameStarted(false);
      if (gameMode === "multiplayer") {
        socket.emit("game-over", { roomId });
      }
      saveGameToDatabase("1/2-1/2", "stalemate", whiteTime, blackTime);
    } else if (game.isInsufficientMaterial()) {
      setGameResult("🤝 Draw by Insufficient Material");
      setEndgame({ type: "draw", winner: null });
      setGameStarted(false);
      if (gameMode === "multiplayer") {
        socket.emit("game-over", { roomId });
      }
      saveGameToDatabase(
        "1/2-1/2",
        "insufficient-material",
        whiteTime,
        blackTime,
      );
    } else if (game.isThreefoldRepetition()) {
      setGameResult("🤝 Draw by Repetition");
      setEndgame({ type: "draw", winner: null });
      setGameStarted(false);
      if (gameMode === "multiplayer") {
        socket.emit("game-over", { roomId });
      }
      saveGameToDatabase(
        "1/2-1/2",
        "threefold-repetition",
        whiteTime,
        blackTime,
      );
    } else if (game.isDraw()) {
      setGameResult("🤝 Draw");
      setEndgame({ type: "draw", winner: null });
      setGameStarted(false);
      if (gameMode === "multiplayer") {
        socket.emit("game-over", { roomId });
      }
      saveGameToDatabase("1/2-1/2", "draw", whiteTime, blackTime);
    } else {
      if (moves.length === 0) {
        setGameResult("");
        setEndgame({ type: null, winner: null });
      }
    }
  }, [
    game,
    whiteFlagged,
    blackFlagged,
    moves.length,
    endgame.type,
    whiteTime,
    blackTime,
  ]);

  const handleGameAction = (actionType) => {
    if (isGameOver) return;

    if (actionType === "abort") {
      if (gameMode === "multiplayer") {
        const winner = multiplayerColor === "white" ? "b" : "w";
        socket.emit("abort-game", {
          roomId,
          winner,
        });
        return;
      }

      setGameResult("❌ Game Aborted");
      setEndgame({ type: "abort", winner: null });
    } else if (actionType === "resign") {
      const winner = game.turn() === "w" ? "Black" : "White";
      const winnerColor = game.turn() === "w" ? "b" : "w";
      setGameResult(`🏆 ${winner} Wins by Resignation`);
      setEndgame({ type: "resignation", winner: winnerColor });
      setGameStarted(false);
      if (gameMode === "multiplayer") {
        socket.emit("resign", {
          roomId,
        });
        return;
      }

      const result = winnerColor === "w" ? "1-0" : "0-1";
      saveGameToDatabase(result, "resignation", whiteTime, blackTime);
    } else if (actionType === "draw") {
      if (gameMode === "multiplayer") {
        setDrawOfferPending(true);
        socket.emit("draw-offer", {
          roomId,
        });
        return;
      }

      setGameResult("🤝 Draw by Mutual Agreement");
      setEndgame({ type: "draw", winner: null });

      saveGameToDatabase("1/2-1/2", "draw", whiteTime, blackTime);
    }

    chessSounds.playGameEndSound();
  };

  useEffect(() => {
    if (multiplayerColor) {
      setPlayerColor(multiplayerColor);
      setBoardOrientation(multiplayerColor);
    }
  }, [multiplayerColor]);

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
        <div className="flex flex-col gap-4 max-w-137.5">
          <PlayerCard
            name={
              gameMode === "multiplayer"
                ? playerColor === "white"
                  ? blackPlayerName
                  : whitePlayerName
                : "Opponent (Bot)"
            }
            rating={
              playerColor === "white" ? blackPlayerRating : whitePlayerRating
            }
            isOnline={true}
            color={playerColor === "white" ? "black" : "white"}
            time={playerColor === "white" ? displayBlackTime : displayWhiteTime}
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

          {gameResult &&
            (() => {
              const { icon, bg, border, shadow } = getBannerConfig(gameResult);
              const cleanText = gameResult.replace(/[🏆🤝❌]/g, "").trim();

              return (
                <div
                  className={`flex items-center justify-center gap-3 p-4 rounded-xl text-lg font-bold text-white shadow-2xl ${bg} ${border} ${shadow} border backdrop-blur-sm transition-all duration-500 ease-out`}
                >
                  <div className="shrink-0 animate-[bounce_1s_ease-in-out_1]">
                    {icon}
                  </div>
                  <span className="tracking-wide drop-shadow-sm">
                    {cleanText}
                  </span>
                </div>
              );
            })()}

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
              gameMode={gameMode}
              roomId={roomId}
              multiplayerColor={multiplayerColor}
              setMultiplayerWhiteTime={setMultiplayerWhiteTime}
              setMultiplayerBlackTime={setMultiplayerBlackTime}
            />
          </div>

          <PlayerCard
            name={
              gameMode === "multiplayer"
                ? playerColor === "white"
                  ? whitePlayerName
                  : blackPlayerName
                : activeUser
                  ? activeUser.username || activeUser.name || "You"
                  : "You"
            }
            rating={
              playerColor === "white" ? whitePlayerRating : blackPlayerRating
            }
            isOnline={true}
            color={playerColor}
            time={playerColor === "white" ? displayWhiteTime : displayBlackTime}
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
            gameMode={gameMode}
            setGameMode={setGameMode}
            openMultiplayerLobby={() => setShowMultiplayerLobby(true)}
            incomingDrawOffer={incomingDrawOffer}
            drawOfferPending={drawOfferPending}
            acceptDrawOffer={acceptDrawOffer}
            declineDrawOffer={declineDrawOffer}
          />
        </div>
      </div>

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
                className="w-full py-3.5 bg-purple-600 hover:bg-purple-500 text-sm font-semibold transition rounded-xl shadow-lg cursor-pointer"
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
                className="w-full py-3.5 bg-zinc-800 hover:bg-zinc-750 text-sm font-semibold transition rounded-xl text-zinc-300 border border-white/10 cursor-pointer"
              >
                Play as Guest
              </button>
              <button
                onClick={() => setShowAuthModal(false)}
                className="mt-2 text-zinc-500 hover:text-zinc-400 text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showMultiplayerLobby && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50">
          <MultiplayerTester
            activeUser={activeUser}
            timeControl={timeControl}
            onClose={() => setShowMultiplayerLobby(false)}
            setMultiplayerBlackTime={setMultiplayerBlackTime}
            setMultiplayerWhiteTime={setMultiplayerWhiteTime}
            onGameStarted={({
              roomId,
              color,
              whiteName,
              blackName,
              whiteRating,
              blackRating,
              whiteId,
              blackId,
              timeControl,
              whiteTimeRemaining,
              blackTimeRemaining,
            }) => {
              resetClock();
              setGame(new Chess());
              setMoves([]);
              resetCapturedPieces();
              setEndgame({ type: null, winner: null });
              setGameResult("");

              setWhitePlayerName(whiteName);
              setBlackPlayerName(blackName);
              setWhitePlayerRating(whiteRating);
              setBlackPlayerRating(blackRating);
              setWhitePlayerId(whiteId);
              setBlackPlayerId(blackId);
              setTimeControl(timeControl);
              setMultiplayerWhiteTime(whiteTimeRemaining);
              setMultiplayerBlackTime(blackTimeRemaining);

              setRoomId(roomId);
              setMultiplayerColor(color);
              setGameMode("multiplayer");
              setGameStarted(true);
              setShowMultiplayerLobby(false);
            }}
          />
        </div>
      )}
    </div>
  );
};

export default Play;
