import React, { useState, useEffect, useRef } from "react";
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
import {
  getActiveBotGame,
  saveActiveBotGame,
  deleteActiveBotGame,
} from "../services/activeBotGame.service";
import { socket } from "../services/socket.service";
import openings from "../data/openings";
import {
  DEFAULT_BOT_DIFFICULTY_KEY,
  getBotDifficulty,
} from "../utils/botDifficulty";

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
  const total = baseInSeconds + incrementInSeconds * 40;
  if (total < 180) return "bullet";
  if (total < 600) return "blitz";
  return "rapid";
};

const Play = () => {
  const { user, setUser, loading: authLoading } = useAuth();

  const [guestUser, setGuestUser] = useState(null);
  const activeUser = user || guestUser;
  const isLoggedIn = !!user;

  const [game, setGame] = useState(new Chess());
  const [moves, setMoves] = useState([]);
  const [playerColor, setPlayerColor] = useState("white");
  const [boardOrientation, setBoardOrientation] = useState("white");

  const [botColorChoice, setBotColorChoice] = useState("white");
  const [botDifficulty, setBotDifficulty] = useState(
    DEFAULT_BOT_DIFFICULTY_KEY,
  );
  const [boardKey, setBoardKey] = useState(0);
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
  const [pendingBotGame, setPendingBotGame] = useState(null);

  const [isEngineOwner, setIsEngineOwner] = useState(true);
  const [pendingReconnect, setPendingReconnect] = useState(false);
  const [pendingSessionReconnect, setPendingSessionReconnect] = useState(false);
  const sessionReconnectRetryRef = useRef(false);
  const [hasSessionRestorePending, setHasSessionRestorePending] =
    useState(false);

  const [incomingDrawOffer, setIncomingDrawOffer] = useState(false);
  const [drawOfferPending, setDrawOfferPending] = useState(false);

  const [whitePlayerName, setWhitePlayerName] = useState("White");
  const [blackPlayerName, setBlackPlayerName] = useState("Black");
  const [whitePlayerRating, setWhitePlayerRating] = useState(1200);
  const [blackPlayerRating, setBlackPlayerRating] = useState(1200);
  const [whitePlayerId, setWhitePlayerId] = useState(null);
  const [blackPlayerId, setBlackPlayerId] = useState(null);

  const [whiteRatingChange, setWhiteRatingChange] = useState(null);
  const [blackRatingChange, setBlackRatingChange] = useState(null);

  const [disconnectCountdown, setDisconnectCountdown] = useState(null);
  const [disconnectedColor, setDisconnectedColor] = useState(null);
  const [disconnectIsAbort, setDisconnectIsAbort] = useState(false);
  const [whiteAbortCountdown, setWhiteAbortCountdown] = useState(null);
  const [blackAbortCountdown, setBlackAbortCountdown] = useState(null);

  const [isRated, setIsRated] = useState(true);

  const [multiplayerWhiteTime, setMultiplayerWhiteTime] = useState(
    timeControl.base * 1000,
  );
  const [multiplayerBlackTime, setMultiplayerBlackTime] = useState(
    timeControl.base * 1000,
  );

  const hasSavedGameRef = useRef(false);

  useEffect(() => {
    if (!gameStarted) {
      setMultiplayerWhiteTime(timeControl.base * 1000);
      setMultiplayerBlackTime(timeControl.base * 1000);
    }
  }, [timeControl.base]);

  const gameType = calculateGameType(timeControl.base, timeControl.increment);

  const latestGameStateRef = useRef({});
  useEffect(() => {
    latestGameStateRef.current = {
      game,
      moves,
      gameMode,
      playerColor,
      multiplayerWhiteTime,
      multiplayerBlackTime,
      user,
      roomId,
      whitePlayerId,
      blackPlayerId,
      whitePlayerName,
      blackPlayerName,
      timeControl,
      gameType,
      isRated,
      botDifficulty,
    };
  });

  const { whiteTime, blackTime, resetClock } = useChessClock(
    game,
    moves,
    gameStarted && gameMode !== "bot",
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
  } = useCapturedPieces(game.fen());

  const flipBoard = () => {
    setBoardOrientation((prev) => (prev === "white" ? "black" : "white"));
  };

  const whiteFlagged =
    gameMode === "multiplayer" ? multiplayerWhiteTime === 0 : whiteTime === 0;
  const blackFlagged =
    gameMode === "multiplayer" ? multiplayerBlackTime === 0 : blackTime === 0;

  const isGameOver =
    game.isGameOver() || whiteFlagged || blackFlagged || !!endgame.type;

  const isMyTurn =
    !isGameOver &&
    gameStarted &&
    (playerColor === "white" ? game.turn() === "w" : game.turn() === "b");

  const isOpponentTurn =
    !isGameOver &&
    gameStarted &&
    (playerColor === "white" ? game.turn() === "b" : game.turn() === "w");

  // ── Player Card <-> board orientation mapping ───────────────────────────────
  const bottomCardColor =
    gameMode === "multiplayer" ? playerColor : boardOrientation;
  const topCardColor =
    gameMode === "multiplayer"
      ? playerColor === "white"
        ? "black"
        : "white"
      : boardOrientation === "white"
        ? "black"
        : "white";

  const whiteAbortStatusText = whiteAbortCountdown
    ? `Auto aborting in ${whiteAbortCountdown}s`
    : undefined;
  const blackAbortStatusText = blackAbortCountdown
    ? `Auto aborting in ${blackAbortCountdown}s`
    : undefined;

  const myAbortStatusText =
    playerColor === "white" ? whiteAbortStatusText : blackAbortStatusText;
  const opponentAbortStatusText =
    playerColor === "white" ? blackAbortStatusText : whiteAbortStatusText;

  const myStatusText =
    myAbortStatusText ||
    (disconnectCountdown &&
    disconnectedColor === (playerColor === "white" ? "w" : "b")
      ? disconnectIsAbort
        ? `Auto aborting in ${disconnectCountdown}s`
        : `Auto resignation in ${disconnectCountdown}s`
      : undefined);

  const opponentStatusText =
    opponentAbortStatusText ||
    (disconnectCountdown &&
    disconnectedColor === (playerColor === "white" ? "b" : "w")
      ? disconnectIsAbort
        ? `Auto aborting in ${disconnectCountdown}s`
        : `Auto resignation in ${disconnectCountdown}s`
      : undefined);

  // ── Clear rating-change indicators when a new game starts ──────────────────

  useEffect(() => {
    if (gameStarted) {
      setWhiteRatingChange(null);
      setBlackRatingChange(null);
      hasSavedGameRef.current = false;
    }
  }, [gameStarted]);

  // ── Hydrate guest from localStorage ────────────────────────────────────────

  useEffect(() => {
    const storedGuest = localStorage.getItem("guestUser");
    if (storedGuest) setGuestUser(JSON.parse(storedGuest));
  }, []);

  // ── Rating display before game starts ──────────────────────────────────────

  useEffect(() => {
    if (!gameStarted && !isGameOver && activeUser) {
      const userRating =
        activeUser.stats?.[gameType]?.rating || activeUser.rating || 1200;
      if (gameMode === "bot") {
        if (playerColor === "white") {
          setWhitePlayerRating(userRating);
          setBlackPlayerRating(1500);
        } else {
          setBlackPlayerRating(userRating);
          setWhitePlayerRating(1500);
        }
      } else if (gameMode === "multiplayer") {
        if (playerColor === "white") {
          setWhitePlayerRating(userRating);
          setBlackPlayerRating(1200);
        } else {
          setBlackPlayerRating(userRating);
          setWhitePlayerRating(1200);
        }
      }
    }
  }, [
    activeUser,
    activeUser?.rating,
    activeUser?.stats?.[gameType]?.rating,
    gameMode,
    gameType,
    playerColor,
    gameStarted,
    isGameOver,
  ]);

  // ── DRAW ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    const handleDrawOfferReceived = ({ initiatedBy }) => {
      const myColorCode = multiplayerColor === "white" ? "w" : "b";
      if (initiatedBy !== myColorCode) {
        setIncomingDrawOffer(true);
      }
    };

    const handleDrawAccepted = ({ whiteSocketId } = {}) => {
      setIncomingDrawOffer(false);
      setDrawOfferPending(false);
      setGameStarted(false);
      setGameResult("🤝 Draw by Mutual Agreement");
      setEndgame({ type: "draw", winner: null });
      chessSounds.playGameEndSound();
      clearStoredMultiplayerSession();
      const { multiplayerWhiteTime: wt, multiplayerBlackTime: bt } =
        latestGameStateRef.current;
      saveGameToDatabase(
        "1/2-1/2",
        "draw",
        wt,
        bt,
        undefined,
        undefined,
        "completed",
        undefined,
        null,
        null,
        null,
        whiteSocketId,
      );
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
  }, [roomId, chessSounds, multiplayerColor]);

  const acceptDrawOffer = () =>
    socket.emit("draw-response", { roomId, accepted: true });
  const declineDrawOffer = () => {
    socket.emit("draw-response", { roomId, accepted: false });
    setIncomingDrawOffer(false);
  };

  // ── RESIGN ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    const handlePlayerResigned = ({ winner, whiteSocketId }) => {
      setGameStarted(false);
      const winnerName = winner === "white" ? "White" : "Black";
      setGameResult(`🏆 ${winnerName} Wins by Resignation`);
      setEndgame({
        type: "resignation",
        winner: winner === "white" ? "w" : "b",
      });
      chessSounds.playGameEndSound();
      clearStoredMultiplayerSession();
      const result = winner === "white" ? "1-0" : "0-1";
      const { multiplayerWhiteTime: wt, multiplayerBlackTime: bt } =
        latestGameStateRef.current;
      saveGameToDatabase(
        result,
        "resignation",
        wt,
        bt,
        undefined,
        undefined,
        "completed",
        undefined,
        null,
        null,
        null,
        whiteSocketId,
      );
    };
    socket.on("player-resigned", handlePlayerResigned);
    return () => socket.off("player-resigned", handlePlayerResigned);
  }, []);

  // ── DISCONNECT COUNTDOWN ───────────────────────────────────────────────────

  useEffect(() => {
    const handleDisconnectCountdown = ({
      disconnectedColor,
      remainingSeconds,
      isAbort,
    }) => {
      setDisconnectedColor(disconnectedColor);
      setDisconnectCountdown(remainingSeconds);
      setDisconnectIsAbort(isAbort);
    };
    socket.on("disconnect-countdown", handleDisconnectCountdown);
    return () => socket.off("disconnect-countdown", handleDisconnectCountdown);
  }, []);

  useEffect(() => {
    const handleAbortCountdown = ({ playerColor, remainingSeconds }) => {
      if (playerColor === "w") setWhiteAbortCountdown(remainingSeconds);
      if (playerColor === "b") setBlackAbortCountdown(remainingSeconds);
    };
    socket.on("abort-countdown", handleAbortCountdown);
    return () => socket.off("abort-countdown", handleAbortCountdown);
  }, []);

  // ── Shared restore helper (used by both reconnect paths) ───────────────────

  const applyRoomState = (roomState) => {
    if (!roomState) return;

    // Clear previous game's UI state
    setGameResult("");
    setEndgame({ type: null, winner: null });

    setIncomingDrawOffer(false);
    setDrawOfferPending(false);

    setDisconnectCountdown(null);
    setDisconnectedColor(null);
    setDisconnectIsAbort(false);

    setWhiteAbortCountdown(null);
    setBlackAbortCountdown(null);
    setLastMove(null);

    if (typeof roomState.isRated === "boolean") {
      setIsRated(roomState.isRated);
    }

    const restoredGame = new Chess(roomState.fen || new Chess().fen());
    setGame(restoredGame);
    setBoardKey((prev) => prev + 1);
    setMoves(roomState.moves || []);
    setMultiplayerWhiteTime(
      roomState.whiteTimeRemaining ?? timeControl.base * 1000,
    );
    setMultiplayerBlackTime(
      roomState.blackTimeRemaining ?? timeControl.base * 1000,
    );
    setTimeControl(roomState.timeControl || timeControl);
    setWhitePlayerName(roomState.whiteName || "White");
    setBlackPlayerName(roomState.blackName || "Black");
    setWhitePlayerRating(roomState.whiteRating || 1200);
    setBlackPlayerRating(roomState.blackRating || 1200);
    setWhitePlayerId(roomState.whitePlayerId || null);
    setBlackPlayerId(roomState.blackPlayerId || null);
    setGameMode("multiplayer");
    setRoomId(roomState.roomId || "");
    setGameStarted(!roomState.gameOver);

    if (roomState.playerColor) {
      setMultiplayerColor(roomState.playerColor);
      setPlayerColor(roomState.playerColor);
      setBoardOrientation(roomState.playerColor);

      localStorage.setItem("multiplayerRoomId", roomState.roomId);
      localStorage.setItem("multiplayerColor", roomState.playerColor);
    }

    if (!roomState.gameOver) {
      try {
        chessSounds.playGameStartSound();
      } catch (error) {
        console.warn("Autoplay blocked until user interacts with document.");
      }
    } else if (roomState.termination === "abandonment") {
      const winnerText = roomState.winner === "w" ? "White" : "Black";
      setGameResult(`🏆 ${winnerText} Wins by Abandonment`);
      setEndgame({ type: "abandonment", winner: roomState.winner });
    } else if (roomState.termination === "abort") {
      setGameResult("❌ Game Aborted");
      setEndgame({ type: "abort", winner: null });
    }
  };

  const attemptRestoreSessionGame = async () => {
    if (!user || !socket) return false;

    if (!socket.connected) {
      socket.connect();
    }

    const result = await new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve({ status: "not-found" });
      }, 5000);

      socket.emit("reconnect-by-session", (response) => {
        clearTimeout(timeout);
        resolve(response || { status: "not-found" });
      });
    });

    if (result.status === "found" && result.roomState) {
      applyRoomState(result.roomState);
      setPendingSessionReconnect(false);
      setPendingReconnect(false);
      setHasSessionRestorePending(false);
      sessionReconnectRetryRef.current = false;
      return true;
    }

    return false;
  };

  // ── Standalone Bot Game Check on Mount ──────────────────────────────────────
  useEffect(() => {
    // Only check if user is logged in, no game is active, and it's bot mode
    if (
      !user ||
      gameStarted ||
      pendingReconnect ||
      pendingSessionReconnect ||
      endgame.type
    )
      return;

    const checkActiveBotGame = async () => {
      try {
        const data = await getActiveBotGame();
        setPendingBotGame(data?.activeGame || null);
      } catch (error) {
        console.error("Failed to fetch active bot game:", error);
      }
    };

    checkActiveBotGame();
  }, [
    user,
    gameStarted,
    pendingReconnect,
    pendingSessionReconnect,
    endgame.type,
  ]);

  // ── RECONNECT: player-reconnected / room-restored / room-restore-failed ────

  useEffect(() => {
    const handlePlayerReconnected = () => {
      setDisconnectCountdown(null);
      setDisconnectedColor(null);
      setDisconnectIsAbort(false);
    };

    const handleRoomRestored = (roomState) => {
      applyRoomState(roomState);
      setPendingReconnect(false);
      setPendingSessionReconnect(false);
      setHasSessionRestorePending(false);
    };

    const handleRestoreFailed = () => {
      setPendingReconnect(false);
    };

    socket.on("player-reconnected", handlePlayerReconnected);
    socket.on("room-restored", handleRoomRestored);
    socket.on("room-restore-failed", handleRestoreFailed);
    return () => {
      socket.off("player-reconnected", handlePlayerReconnected);
      socket.off("room-restored", handleRoomRestored);
      socket.off("room-restore-failed", handleRestoreFailed);
    };
  }, []);

  // ── RECONNECT: session-game-found / session-game-not-found ─────────────────

  useEffect(() => {
    const handleSessionGameFound = (roomState) => {
      sessionReconnectRetryRef.current = false;
      applyRoomState(roomState);
      setPendingSessionReconnect(false);
      setPendingReconnect(false);
      setHasSessionRestorePending(false);
    };

    const handleSessionGameNotFound = () => {
      if (pendingSessionReconnect && !sessionReconnectRetryRef.current) {
        sessionReconnectRetryRef.current = true;
        socket.disconnect();
        socket.connect();
        return;
      }
      setPendingSessionReconnect(false);
      setHasSessionRestorePending(false);
    };

    socket.on("session-game-found", handleSessionGameFound);
    socket.on("session-game-not-found", handleSessionGameNotFound);
    return () => {
      socket.off("session-game-found", handleSessionGameFound);
      socket.off("session-game-not-found", handleSessionGameNotFound);
    };
  }, []);

  // ── CLOCK ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    const handleClockUpdate = ({ whiteTimeRemaining, blackTimeRemaining }) => {
      setMultiplayerWhiteTime(whiteTimeRemaining);
      setMultiplayerBlackTime(blackTimeRemaining);
    };
    socket.on("clock-update", handleClockUpdate);
    return () => socket.off("clock-update", handleClockUpdate);
  }, []);

  // ── ABANDONED ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const handlePlayerAbandoned = ({ winner }) => {
      setGameStarted(false);
      const winnerText = winner === "w" ? "White" : "Black";
      const result = winner === "w" ? "1-0" : "0-1";
      setGameResult(`🏆 ${winnerText} Wins by Abandonment`);
      setEndgame({ type: "abandonment", winner });
      setDisconnectCountdown(null);
      setDisconnectedColor(null);
      setDisconnectIsAbort(false);
      clearStoredMultiplayerSession();
      chessSounds.playGameEndSound();
      const { multiplayerWhiteTime: wt, multiplayerBlackTime: bt } =
        latestGameStateRef.current;
      saveGameToDatabase(
        result,
        "abandonment",
        wt,
        bt,
        undefined,
        undefined,
        "abandoned",
      );
    };
    socket.on("player-abandoned", handlePlayerAbandoned);
    return () => socket.off("player-abandoned", handlePlayerAbandoned);
  }, [multiplayerWhiteTime, multiplayerBlackTime]);

  // ── ABORTED ───────────────────────────────────────────────────────────────

  useEffect(() => {
    const handleGameAborted = () => {
      setGameStarted(false);
      clearStoredMultiplayerSession();
      setGameResult("❌ Game Aborted");
      setEndgame({ type: "abort", winner: null });
      setDisconnectCountdown(null);
      setDisconnectedColor(null);
      setDisconnectIsAbort(false);
      setWhiteAbortCountdown(null);
      setBlackAbortCountdown(null);
      chessSounds.playGameEndSound();
    };
    socket.on("game-aborted", handleGameAborted);
    return () => socket.off("game-aborted", handleGameAborted);
  }, []);

  // ── TIMEOUT ───────────────────────────────────────────────────────────────

  useEffect(() => {
    const handleTimeout = ({ winner }) => {
      setGameStarted(false);
      const { multiplayerWhiteTime: wt, multiplayerBlackTime: bt } =
        latestGameStateRef.current;
      if (winner === "w") {
        setGameResult("🏆 White Wins on Time");
        setEndgame({ type: "time", winner: "w" });
        clearStoredMultiplayerSession();
        saveGameToDatabase("1-0", "timeout", wt, 0);
      } else {
        setGameResult("🏆 Black Wins on Time");
        setEndgame({ type: "time", winner: "b" });
        clearStoredMultiplayerSession();
        saveGameToDatabase("0-1", "timeout", 0, bt);
      }
      chessSounds.playGameEndSound();
    };
    socket.on("timeout", handleTimeout);
    return () => socket.off("timeout", handleTimeout);
  }, []);

  // ── Session clearing ───────────────────────────────────────────────────────

  const clearStoredMultiplayerSession = () => {
    localStorage.removeItem("multiplayerRoomId");
    localStorage.removeItem("multiplayerColor");
    setRoomId("");
    setMultiplayerColor(null);
    setPendingReconnect(false);
    setPendingSessionReconnect(false);
  };

  // ── SOCKET AUTH HANDSHAKE SYNCHRONIZATION ──────────────────────────────────

  useEffect(() => {
    if (authLoading) return;

    const storedRoomId = localStorage.getItem("multiplayerRoomId");
    const storedColor = localStorage.getItem("multiplayerColor");

    if (storedRoomId && storedColor) {
      setRoomId(storedRoomId);
      setMultiplayerColor(storedColor);
      setPendingReconnect(true);
      setPendingSessionReconnect(false);
      setGameMode("multiplayer");
    } else if (user) {
      setPendingSessionReconnect(true);
      setPendingReconnect(false);
    }
  }, [authLoading, user]);

  // ── RECONNECT INIT: read localStorage on mount ─────────────────────────────

  useEffect(() => {
    const storedRoomId = localStorage.getItem("multiplayerRoomId");
    const storedColor = localStorage.getItem("multiplayerColor");
    if (storedRoomId && storedColor) {
      setRoomId(storedRoomId);
      setMultiplayerColor(storedColor);
      setPendingReconnect(true);
      setGameMode("multiplayer");
    }
  }, []);

  // ── RECONNECT FIRE: localStorage path (same device, guests + logged-in) ────

  useEffect(() => {
    const handleSocketConnect = () => {
      if (!roomId || !multiplayerColor || !pendingReconnect) return;
      socket.emit("reconnect-room", { roomId, playerColor: multiplayerColor });
    };
    socket.on("connect", handleSocketConnect);
    if (socket.connected) handleSocketConnect();
    return () => socket.off("connect", handleSocketConnect);
  }, [roomId, multiplayerColor, pendingReconnect]);

  // ── RECONNECT FIRE: session path (cross-device, logged-in only) ────────────

  useEffect(() => {
    if (!pendingSessionReconnect) return;

    const handleSocketConnect = () => {
      if (pendingReconnect) return;
      socket.emit("reconnect-by-session");
    };

    socket.on("connect", handleSocketConnect);
    if (socket.connected) handleSocketConnect();
    return () => socket.off("connect", handleSocketConnect);
  }, [pendingSessionReconnect, pendingReconnect]);

  useEffect(() => {
    if (!authLoading && user) {
      setPendingSessionReconnect(true);
    }
  }, [authLoading, user]);

  // ── Keep localStorage in sync while a multiplayer game is live ─────────────

  useEffect(() => {
    if (gameMode !== "multiplayer" || !roomId) return;
    localStorage.setItem("multiplayerRoomId", roomId);
    localStorage.setItem("multiplayerColor", multiplayerColor);
  }, [roomId, multiplayerColor, gameMode]);

  // ── Sync playerColor / boardOrientation when multiplayerColor is set ────────

  useEffect(() => {
    if (multiplayerColor) {
      setPlayerColor(multiplayerColor);
      setBoardOrientation(multiplayerColor);
    }
  }, [multiplayerColor]);

  // ── Reset abort & disconnect counters when the game stops running
  useEffect(() => {
    if (!gameStarted) {
      setWhiteAbortCountdown(null);
      setBlackAbortCountdown(null);
      setDisconnectCountdown(null);
      setDisconnectedColor(null);
      setDisconnectIsAbort(false);
    }
  }, [gameStarted]);

  // ── Apply rating-change payload to the UI ───────────────────────────────────

  const applyRatingChanges = (ratingChanges) => {
    if (!ratingChanges) return;

    const { whitePlayerId: currentWhitePlayerId, gameType: currentGameType } =
      latestGameStateRef.current;

    setWhitePlayerRating(ratingChanges.white.rating.after);
    setBlackPlayerRating(ratingChanges.black.rating.after);
    setWhiteRatingChange(ratingChanges.white.rating.diff);
    setBlackRatingChange(ratingChanges.black.rating.diff);

    setUser((prevUser) => {
      if (!prevUser) return prevUser;
      const userId = prevUser._id || prevUser.id;
      if (!userId) return prevUser;

      const isWhite = currentWhitePlayerId
        ? String(currentWhitePlayerId) === String(userId)
        : false;
      const isBlack = !isWhite;

      const newRating = isWhite
        ? ratingChanges.white.rating.after
        : ratingChanges.black.rating.after;

      const newRd = isWhite
        ? ratingChanges.white.rd.after
        : ratingChanges.black.rd.after;

      if (!isWhite && !isBlack) return prevUser;

      return {
        ...prevUser,
        stats: {
          ...prevUser.stats,
          [currentGameType]: {
            ...prevUser.stats?.[currentGameType],
            rating: newRating,
            rd: newRd,
          },
        },
      };
    });
  };

  // ── Database save ──────────────────────────────────────────────────────────

  const saveGameToDatabase = async (
    result,
    termination,
    finalWhiteTime,
    finalBlackTime,
    overrideOpponentType,
    overrideOpponentName,
    status = "completed",
    _unusedRatedArg,
    finalPgnOverride = null,
    finalMovesOverride = null,
    finalFenOverride = null,
    eventWhiteSocketId = null,
  ) => {
    const {
      game: currentGame,
      moves: currentMoves,
      gameMode: currentGameMode,
      playerColor: currentPlayerColor,
      user: currentUser,
      roomId: currentRoomId,
      whitePlayerId: currentWhitePlayerId,
      blackPlayerId: currentBlackPlayerId,
      whitePlayerName: currentWhitePlayerName,
      blackPlayerName: currentBlackPlayerName,
      timeControl: currentTimeControl,
      gameType: currentGameType,
      isRated: currentIsRated,
      botDifficulty: currentBotDifficulty,
    } = latestGameStateRef.current;

    if (!currentUser) return;

    const isMultiplayer = currentGameMode === "multiplayer";

    if (hasSavedGameRef.current) return;
    hasSavedGameRef.current = true;

    // Only white client should persist multiplayer games to avoid duplicates
    if (isMultiplayer) {
      if (currentPlayerColor !== "white") return;
      if (eventWhiteSocketId && socket.id !== eventWhiteSocketId) return;
    }

    try {
      const finalMovesArray =
        finalMovesOverride || currentMoves || currentGame.history();
      const cleanGameInstance = new Chess();
      const fenHistory = [cleanGameInstance.fen()];
      finalMovesArray.forEach((move) => {
        try {
          cleanGameInstance.move(move);
          fenHistory.push(cleanGameInstance.fen());
        } catch (e) {
          console.error("Error structural replaying move logic:", move, e);
        }
      });

      const finalPgn = finalPgnOverride || cleanGameInstance.pgn();
      const finalFen = finalFenOverride || cleanGameInstance.fen();

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

      const currentUserId = currentUser._id || currentUser.id;
      const finalOpponentType =
        overrideOpponentType || (isMultiplayer ? "human" : "bot");
      const finalOpponentName =
        overrideOpponentName ||
        (isMultiplayer
          ? currentPlayerColor === "white"
            ? currentBlackPlayerName
            : currentWhitePlayerName
          : "Stockfish Bot");

      const botId = "000000000000000000000000";

      const response = await createGame({
        whitePlayer: isMultiplayer
          ? currentWhitePlayerId
          : currentPlayerColor === "white"
            ? currentUserId
            : botId,
        blackPlayer: isMultiplayer
          ? currentBlackPlayerId
          : currentPlayerColor === "black"
            ? currentUserId
            : botId,

        pgn: finalPgn,
        fen: finalFen,
        moves: finalMovesArray,
        result,
        opening: openingData,
        ...(isMultiplayer && {
          timeControl: {
            base: currentTimeControl.base,
            increment: currentTimeControl.increment,
          },
          gameType: currentGameType,
          whiteTimeRemaining: Math.max(0, Math.round(finalWhiteTime / 1000)),
          blackTimeRemaining: Math.max(0, Math.round(finalBlackTime / 1000)),
        }),
        opponentType: finalOpponentType,
        opponentName: finalOpponentName,
        rated: isMultiplayer ? Boolean(currentIsRated) : false,
        termination,
        status,
        roomId: isMultiplayer ? currentRoomId : undefined,
        ...(finalOpponentType === "bot" && {
          botDifficulty: (() => {
            const tier = getBotDifficulty(currentBotDifficulty);
            return { key: tier.key, label: tier.label, elo: tier.elo };
          })(),
        }),
      });

      if (response?.ratingChanges) {
        applyRatingChanges(response.ratingChanges);

        if (isMultiplayer) {
          socket.emit("rating-update", {
            roomId: currentRoomId,
            ratingChanges: response.ratingChanges,
          });
        }
      }

      if (!isMultiplayer) {
        deleteActiveBotGame().catch((error) => {
          console.error("Failed to clear active bot game:", error);
        });
      }
    } catch (error) {
      console.error(
        "Database tracking persist save transaction failed:",
        error,
      );
    }
  };

  // ── Bot game end reporting (de-duplicated across open tabs) ────────────────

  const reportBotGameOver = (
    result,
    termination,
    winner,
    whiteT,
    blackT,
    finalMovesOverride,
    finalFenOverride,
  ) => {
    const {
      user: currentUser,
      game: currentGame,
      moves: currentMoves,
    } = latestGameStateRef.current;

    const resolvedMoves = finalMovesOverride || currentMoves;
    const resolvedFen = finalFenOverride || currentGame.fen();

    setPendingBotGame(null);
    deleteActiveBotGame().catch((error) => {
      console.error("Failed to clear active bot game:", error);
    });

    if (!currentUser || !socket.connected) {
      saveGameToDatabase(
        result,
        termination,
        whiteT,
        blackT,
        undefined,
        undefined,
        "completed",
        undefined,
        null,
        resolvedMoves,
        resolvedFen,
      );
      return;
    }

    let settled = false;
    const fallbackTimer = setTimeout(() => {
      if (settled) return;
      settled = true;
      saveGameToDatabase(
        result,
        termination,
        whiteT,
        blackT,
        undefined,
        undefined,
        "completed",
        undefined,
        null,
        resolvedMoves,
        resolvedFen,
      );
    }, 3000);

    socket.emit(
      "bot:game-over",
      {
        termination,
        winner,
        fen: resolvedFen,
        moves: resolvedMoves,
      },
      (ack) => {
        if (settled) return;
        settled = true;
        clearTimeout(fallbackTimer);
        if (!ack || ack.shouldPersist !== false) {
          saveGameToDatabase(
            result,
            termination,
            whiteT,
            blackT,
            undefined,
            undefined,
            "completed",
            undefined,
            null,
            resolvedMoves,
            resolvedFen
          );
        }
      },
    );
  };

  // ── Autosave the in-progress bot game (restorable on refresh / elsewhere) ──

  useEffect(() => {
    if (gameMode !== "bot") return;
    if (!gameStarted) return;
    if (isGameOver) return;
    if (!user) return;

    saveActiveBotGame({
      fen: game.fen(),
      moves,
      playerColor,
      difficulty: botDifficulty,
    }).catch((error) => {
      console.error("Failed to autosave bot game:", error);
    });
  }, [
    game,
    moves,
    gameMode,
    gameStarted,
    isGameOver,
    playerColor,
    user,
    botDifficulty,
  ]);

  // ── Game-over detection (local) ────────────────────────────────────────────

  useEffect(() => {
    if (endgame.type) return;
    if (gameMode === "multiplayer") return;
    if (!gameStarted) return;

    if (whiteFlagged) {
      setGameResult("🏆 Black Wins on Time");
      setEndgame({ type: "time", winner: "b" });
      setGameStarted(false);
      if (gameMode === "multiplayer") socket.emit("game-over", { roomId });
      reportBotGameOver("0-1", "timeout", "b", 0, blackTime);
    } else if (blackFlagged) {
      setGameResult("🏆 White Wins on Time");
      setEndgame({ type: "time", winner: "w" });
      setGameStarted(false);
      if (gameMode === "multiplayer") socket.emit("game-over", { roomId });
      reportBotGameOver("1-0", "timeout", "w", whiteTime, 0);
    } else if (game.isCheckmate()) {
      const winnerColor = game.turn() === "w" ? "b" : "w";
      const winnerName = winnerColor === "w" ? "White" : "Black";
      setGameResult(`🏆 ${winnerName} Wins by Checkmate`);
      setEndgame({ type: "checkmate", winner: winnerColor });
      setGameStarted(false);
      if (gameMode === "multiplayer") socket.emit("game-over", { roomId });
      reportBotGameOver(
        winnerColor === "w" ? "1-0" : "0-1",
        "checkmate",
        winnerColor,
        whiteTime,
        blackTime,
        moves,
        game.fen()
      );
    } else if (game.isStalemate()) {
      setGameResult("🤝 Draw by Stalemate");
      setEndgame({ type: "draw", winner: null });
      setGameStarted(false);
      if (gameMode === "multiplayer") socket.emit("game-over", { roomId });
      reportBotGameOver("1/2-1/2", "stalemate", null, whiteTime, blackTime);
    } else if (game.isInsufficientMaterial()) {
      setGameResult("🤝 Draw by Insufficient Material");
      setEndgame({ type: "draw", winner: null });
      setGameStarted(false);
      if (gameMode === "multiplayer") socket.emit("game-over", { roomId });
      reportBotGameOver(
        "1/2-1/2",
        "insufficient-material",
        null,
        whiteTime,
        blackTime,
      );
    } else if (game.isThreefoldRepetition()) {
      setGameResult("🤝 Draw by Repetition");
      setEndgame({ type: "draw", winner: null });
      setGameStarted(false);
      if (gameMode === "multiplayer") socket.emit("game-over", { roomId });
      reportBotGameOver(
        "1/2-1/2",
        "threefold-repetition",
        null,
        whiteTime,
        blackTime,
      );
    } else if (game.isDraw()) {
      setGameResult("🤝 Draw");
      setEndgame({ type: "draw", winner: null });
      setGameStarted(false);
      if (gameMode === "multiplayer") socket.emit("game-over", { roomId });
      reportBotGameOver("1/2-1/2", "draw", null, whiteTime, blackTime);
    } else if (moves.length === 0) {
      setGameResult("");
      setEndgame({ type: null, winner: null });
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

  // ── Game actions ───────────────────────────────────────────────────────────

  const handleGameAction = (actionType) => {
    if (isGameOver) return;
    if (!gameStarted) return;

    if (actionType === "abort") {
      if (gameMode === "multiplayer") {
        socket.emit("abort-game", {
          roomId,
          winner: multiplayerColor === "white" ? "b" : "w",
        });
        return;
      }
      setGameResult("❌ Game Aborted");
      setEndgame({ type: "abort", winner: null });
    } else if (actionType === "resign") {
      const winner = playerColor === "white" ? "Black" : "White";
      const winnerColor = playerColor === "white" ? "b" : "w";

      setGameResult(`🏆 ${winner} Wins by Resignation`);
      setEndgame({ type: "resignation", winner: winnerColor });
      setGameStarted(false);

      if (gameMode === "multiplayer") {
        socket.emit("resign", { roomId });
        return;
      }

      reportBotGameOver(
        winnerColor === "w" ? "1-0" : "0-1",
        "resignation",
        winnerColor,
        whiteTime,
        blackTime,
      );
    } else if (actionType === "draw") {
      if (gameMode === "multiplayer") {
        setDrawOfferPending(true);
        socket.emit("draw-offer", { roomId });
        return;
      }
      setGameResult("🤝 Draw by Mutual Agreement");
      setEndgame({ type: "draw", winner: null });
      reportBotGameOver("1/2-1/2", "draw", null, whiteTime, blackTime);
    }

    chessSounds.playGameEndSound();
  };

  // ── Auth loading gate ──────────────────────────────────────────────────────

  const handleLocalGameOver = ({ termination, winner, pgn, moves, fen }) => {
    if (gameMode !== "multiplayer") return;
    setGameStarted(false);

    if (termination === "checkmate") {
      const winnerName = winner === "w" ? "White" : "Black";
      setGameResult(`🏆 ${winnerName} Wins by Checkmate`);
      setEndgame({ type: "checkmate", winner });
    } else if (termination === "stalemate") {
      setGameResult("🤝 Draw by Stalemate");
      setEndgame({ type: "stalemate", winner: null });
    } else if (termination === "insufficient-material") {
      setGameResult("🤝 Draw by Insufficient Material");
      setEndgame({ type: "insufficient-material", winner: null });
    } else if (termination === "threefold-repetition") {
      setGameResult("🤝 Draw by Repetition");
      setEndgame({ type: "threefold-repetition", winner: null });
    } else {
      setGameResult("🤝 Draw");
      setEndgame({ type: "draw", winner: null });
    }

    chessSounds.playGameEndSound();
    clearStoredMultiplayerSession();
    // Inform server and other client about the game end (server will broadcast)
    socket.emit("game-ended", { roomId, termination, winner, pgn, moves, fen });
  };

  // ── SERVER-BROADCASTED GAME END ─────────────────────────────────────────
  useEffect(() => {
    const handleGameEnded = ({
      termination,
      winner,
      pgn,
      moves,
      fen,
      whiteSocketId,
    }) => {
      setGameStarted(false);
      if (termination === "checkmate") {
        const winnerName = winner === "w" ? "White" : "Black";
        setGameResult(`🏆 ${winnerName} Wins by Checkmate`);
        setEndgame({ type: "checkmate", winner });
      } else if (termination === "stalemate") {
        setGameResult("🤝 Draw by Stalemate");
        setEndgame({ type: "stalemate", winner: null });
      } else if (termination === "insufficient-material") {
        setGameResult("🤝 Draw by Insufficient Material");
        setEndgame({ type: "insufficient-material", winner: null });
      } else if (termination === "threefold-repetition") {
        setGameResult("🤝 Draw by Repetition");
        setEndgame({ type: "threefold-repetition", winner: null });
      } else if (termination === "abandonment") {
        const winnerText = winner === "w" ? "White" : "Black";
        setGameResult(`🏆 ${winnerText} Wins by Abandonment`);
        setEndgame({ type: "abandonment", winner });
      } else if (termination === "resignation") {
        const winnerText = winner === "w" ? "White" : "Black";
        setGameResult(`🏆 ${winnerText} Wins by Resignation`);
        setEndgame({ type: "resignation", winner });
      } else if (termination === "timeout") {
        const winnerText = winner === "w" ? "White" : "Black";
        setGameResult(`🏆 ${winnerText} Wins on Time`);
        setEndgame({ type: "time", winner });
      } else if (termination === "abort") {
        setGameResult("❌ Game Aborted");
        setEndgame({ type: "abort", winner: null });
      } else {
        setGameResult("🤝 Draw");
        setEndgame({ type: "draw", winner: null });
      }

      clearStoredMultiplayerSession();
      chessSounds.playGameEndSound();

      const result =
        winner === "w" ? "1-0" : winner === "b" ? "0-1" : "1/2-1/2";
      const { multiplayerWhiteTime: wt, multiplayerBlackTime: bt } =
        latestGameStateRef.current;
      saveGameToDatabase(
        result,
        termination,
        wt,
        bt,
        undefined,
        undefined,
        "completed",
        undefined,
        pgn || null,
        moves || null,
        fen || null,
        whiteSocketId,
      );
    };

    socket.on("game-ended", handleGameEnded);
    return () => socket.off("game-ended", handleGameEnded);
  }, [multiplayerWhiteTime, multiplayerBlackTime, playerColor, chessSounds]);

  // ── Rating update relay (multiplayer opponent) ──────────────────────────────

  useEffect(() => {
    const handleRatingUpdate = (ratingChanges) => {
      applyRatingChanges(ratingChanges);
    };
    socket.on("rating-update", handleRatingUpdate);
    return () => socket.off("rating-update", handleRatingUpdate);
  }, []);

  // ── BOT GAME SYNC (multi-browser) ───────────────────────────────────────

  useEffect(() => {
    const handleBotSyncState = (state) => {
      if (!state) return;
      const restoredGame = new Chess(state.fen || new Chess().fen());
      setGame(restoredGame);
      setBoardKey((prev) => prev + 1);
      setMoves(state.moves || []);
      setLastMove(null);
      if (state.playerColor) {
        setPlayerColor(state.playerColor);
        setBoardOrientation(state.playerColor);
        setBotColorChoice(state.playerColor);
      }
      setGameMode("bot");
      setGameStarted(!!state.gameStarted);
      setEndgame({ type: null, winner: null });
      setGameResult("");
      setPendingBotGame(null);
    };

    const handleBotNewGame = (state) => {
      resetClock();
      resetCapturedPieces();
      setGame(new Chess(state?.fen || new Chess().fen()));
      setBoardKey((prev) => prev + 1);
      setMoves([]);
      setLastMove(null);
      if (state?.playerColor) {
        setPlayerColor(state.playerColor);
        setBoardOrientation(state.playerColor);
        setBotColorChoice(state.playerColor);
      }
      setGameMode("bot");
      setEndgame({ type: null, winner: null });
      setGameResult("");
      setPendingBotGame(null);
      setGameStarted(true);
      hasSavedGameRef.current = false;

      try {
        chessSounds.playGameStartSound();
      } catch (error) {
        console.warn("Autoplay blocked until user interacts with document.");
      }
    };

    const handleEngineOwner = ({ isOwner } = {}) => {
      setIsEngineOwner(!!isOwner);
    };

    const handleBotGameEnded = ({
      termination,
      winner,
      fen,
      moves: finalMoves,
    } = {}) => {
      if (typeof fen === "string") {
        setGame(new Chess(fen));
        setBoardKey((prev) => prev + 1);
      }
      if (Array.isArray(finalMoves)) setMoves(finalMoves);
      setGameStarted(false);

      if (termination === "checkmate") {
        const winnerName = winner === "w" ? "White" : "Black";
        setGameResult(`🏆 ${winnerName} Wins by Checkmate`);
        setEndgame({ type: "checkmate", winner });
      } else if (termination === "resignation") {
        const winnerName = winner === "w" ? "White" : "Black";
        setGameResult(`🏆 ${winnerName} Wins by Resignation`);
        setEndgame({ type: "resignation", winner });
      } else if (termination === "timeout") {
        const winnerName = winner === "w" ? "White" : "Black";
        setGameResult(`🏆 ${winnerName} Wins on Time`);
        setEndgame({ type: "time", winner });
      } else if (termination === "stalemate") {
        setGameResult("🤝 Draw by Stalemate");
        setEndgame({ type: "draw", winner: null });
      } else if (termination === "insufficient-material") {
        setGameResult("🤝 Draw by Insufficient Material");
        setEndgame({ type: "draw", winner: null });
      } else if (termination === "threefold-repetition") {
        setGameResult("🤝 Draw by Repetition");
        setEndgame({ type: "draw", winner: null });
      } else {
        setGameResult("🤝 Draw");
        setEndgame({ type: "draw", winner: null });
      }

      chessSounds.playGameEndSound();
    };

    socket.on("bot:sync-state", handleBotSyncState);
    socket.on("bot:new-game", handleBotNewGame);
    socket.on("bot:engine-owner", handleEngineOwner);
    socket.on("bot:game-ended", handleBotGameEnded);

    return () => {
      socket.off("bot:sync-state", handleBotSyncState);
      socket.off("bot:new-game", handleBotNewGame);
      socket.off("bot:engine-owner", handleEngineOwner);
      socket.off("bot:game-ended", handleBotGameEnded);
    };
  }, [chessSounds]);

  // Re-announce this tab to the shared bot session whenever the socket
  // (re)connects mid-game (refresh, brief network drop) — mirrors the
  // multiplayer "reconnect-room" behaviour above.
  useEffect(() => {
    if (gameMode !== "bot" || !gameStarted || !user) return;

    const handleReconnect = () => {
      const {
        game: currentGame,
        moves: currentMoves,
        playerColor: currentPlayerColor,
      } = latestGameStateRef.current;

      socket.emit("bot:continue", {
        fen: currentGame.fen(),
        moves: currentMoves,
        playerColor: currentPlayerColor,
      });
    };

    socket.on("connect", handleReconnect);
    return () => socket.off("connect", handleReconnect);
  }, [gameMode, gameStarted, user]);

  // Bot-games handling

  const handleContinueBotGame = () => {
    const activeGame = pendingBotGame;
    if (!activeGame) return;

    const restoredGame = new Chess(activeGame.fen || new Chess().fen());
    setGame(restoredGame);
    setBoardKey((prev) => prev + 1);
    setMoves(activeGame.moves || []);
    setLastMove(null);
    setPlayerColor(activeGame.playerColor);
    setBoardOrientation(activeGame.playerColor);
    setBotColorChoice(activeGame.playerColor);
    setBotDifficulty(activeGame.difficulty || DEFAULT_BOT_DIFFICULTY_KEY);
    setGameMode("bot");
    setEndgame({ type: null, winner: null });
    setGameResult("");
    setGameStarted(true);
    setPendingBotGame(null);

    if (socket.connected) {
      socket.emit("bot:continue", {
        fen: activeGame.fen,
        moves: activeGame.moves || [],
        playerColor: activeGame.playerColor,
      });
    }

    try {
      chessSounds.playGameStartSound();
    } catch (error) {
      console.warn("Autoplay blocked until user interacts with document.");
    }
  };

  // ── Handler to erase pending game & start a brand new game ───────────────
  const handleStartNewBotGame = async () => {
    try {
      // Delete from DB
      await deleteActiveBotGame();
      setPendingBotGame(null);

      const resolvedColor =
        botColorChoice === "random"
          ? Math.random() < 0.5
            ? "white"
            : "black"
          : botColorChoice;

      if (user && socket.connected) {
        socket.emit("bot:new-game", { playerColor: resolvedColor });
        return;
      }

      // Fallback for guests / a dropped socket: reset locally only.
      setPlayerColor(resolvedColor);
      setBoardOrientation(resolvedColor);
      resetClock();
      setGame(new Chess());
      setMoves([]);
      resetCapturedPieces();
      setGameMode("bot");
      setEndgame({ type: null, winner: null });
      setGameResult("");
      setGameStarted(true);

      try {
        chessSounds.playGameStartSound();
      } catch (error) {
        console.warn("Autoplay blocked until user interacts with document.");
      }
    } catch (err) {
      console.error("Failed to start new bot game:", err);
    }
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

  // ── Render ─────────────────────────────────────────────────────────────────

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
                ? gameStarted || isGameOver
                  ? topCardColor === "white"
                    ? whitePlayerName
                    : blackPlayerName
                  : "Searching for Opponent..."
                : `${getBotDifficulty(botDifficulty).label} Bot (${topCardColor === "white" ? "White" : "Black"})`
            }
            rating={
              gameMode === "multiplayer"
                ? topCardColor === "white"
                  ? whitePlayerRating
                  : blackPlayerRating
                : getBotDifficulty(botDifficulty).elo
            }
            ratingChange={
              topCardColor === "white" ? whiteRatingChange : blackRatingChange
            }
            isOnline={true}
            color={topCardColor}
            showClock={gameMode === "multiplayer"}
            time={
              topCardColor === "white" ? displayWhiteTime : displayBlackTime
            }
            isActive={
              !isGameOver &&
              gameStarted &&
              (topCardColor === "white"
                ? game.turn() === "w"
                : game.turn() === "b")
            }
            capturedPieces={
              topCardColor === "white" ? groupedBlackPieces : groupedWhitePieces
            }
            advantage={
              topCardColor === "white" ? whiteAdvantage : blackAdvantage
            }
            statusText={opponentStatusText}
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
              key={boardKey}
              game={game}
              setGame={setGame}
              moves={moves}
              setMoves={setMoves}
              boardOrientation={boardOrientation}
              addCapturedPiece={addCapturedPiece}
              lastMove={lastMove}
              setLastMove={setLastMove}
              endgame={endgame}
              gameMode={gameMode}
              gameStarted={gameStarted}
              playerColor={playerColor}
              roomId={roomId}
              multiplayerColor={multiplayerColor}
              setMultiplayerWhiteTime={setMultiplayerWhiteTime}
              setMultiplayerBlackTime={setMultiplayerBlackTime}
              onLocalGameOver={handleLocalGameOver}
              isEngineOwner={isEngineOwner}
              botDifficulty={botDifficulty}
            />
          </div>

          <PlayerCard
            name={
              gameMode === "multiplayer" && gameStarted
                ? bottomCardColor === "white"
                  ? whitePlayerName
                  : blackPlayerName
                : activeUser
                  ? activeUser.username || activeUser.name || "You"
                  : "You"
            }
            rating={
              !gameStarted && activeUser
                ? activeUser.stats?.[gameType]?.rating ||
                  activeUser.rating ||
                  1200
                : bottomCardColor === "white"
                  ? whitePlayerRating
                  : blackPlayerRating
            }
            ratingChange={
              bottomCardColor === "white"
                ? whiteRatingChange
                : blackRatingChange
            }
            isOnline={true}
            color={bottomCardColor}
            showClock={gameMode === "multiplayer"}
            time={
              bottomCardColor === "white" ? displayWhiteTime : displayBlackTime
            }
            isActive={
              !isGameOver &&
              gameStarted &&
              (bottomCardColor === "white"
                ? game.turn() === "w"
                : game.turn() === "b")
            }
            capturedPieces={
              bottomCardColor === "white"
                ? groupedBlackPieces
                : groupedWhitePieces
            }
            advantage={
              bottomCardColor === "white" ? whiteAdvantage : blackAdvantage
            }
            statusText={myStatusText}
          />
        </div>

        <div className="bg-zinc-900 rounded-2xl border border-white/10 p-6 shadow-xl h-202">
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
            onNewGameRequest={attemptRestoreSessionGame}
            timeControl={timeControl}
            setTimeControl={setTimeControl}
            onGameAction={handleGameAction}
            setEndgame={setEndgame}
            gameMode={gameMode}
            setGameMode={setGameMode}
            playerColor={playerColor}
            setPlayerColor={setPlayerColor}
            setBoardOrientation={setBoardOrientation}
            botColorChoice={botColorChoice}
            setBotColorChoice={setBotColorChoice}
            botDifficulty={botDifficulty}
            setBotDifficulty={setBotDifficulty}
            openMultiplayerLobby={() => setShowMultiplayerLobby(true)}
            incomingDrawOffer={incomingDrawOffer}
            drawOfferPending={drawOfferPending}
            acceptDrawOffer={acceptDrawOffer}
            declineDrawOffer={declineDrawOffer}
            isRated={isRated}
            setIsRated={setIsRated}
            pendingBotGame={pendingBotGame}
            handleContinueBotGame={handleContinueBotGame}
            handleStartNewBotGame={handleStartNewBotGame}
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
            isRated={isRated}
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
              isRated: roomIsRated,
            }) => {
              if (typeof roomIsRated === "boolean") {
                setIsRated(roomIsRated);
              }
              resetClock();
              setGame(new Chess());
              setMoves([]);
              setLastMove(null);
              resetCapturedPieces();
              setEndgame({ type: null, winner: null });
              setGameResult("");

              setIncomingDrawOffer(false);
              setDrawOfferPending(false);

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
              setBoardKey((prev) => prev + 1);
              setShowMultiplayerLobby(false);

              try {
                chessSounds.playGameStartSound();
              } catch (err) {
                console.warn(
                  "Autoplay blocked until user interact with document.",
                );
              }

              localStorage.setItem("multiplayerRoomId", roomId);
              localStorage.setItem("multiplayerColor", color);
            }}
          />
        </div>
      )}
    </div>
  );
};

export default Play;