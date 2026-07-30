import { Chess } from "chess.js";
import { useEffect, useRef, useState } from "react";
import {
  Star,
  Circle,
  ZoomIn,
  Flag,
  HelpCircle,
  AlertTriangle,
  Zap,
  Clock,
  Sliders,
  Check,
  X,
  Shuffle,
} from "react-feather";
import { toast } from "react-hot-toast";
import { useNavigate } from "react-router-dom";

import useChessSounds from "../hooks/useChessSounds";
import { TIME_PRESETS } from "../utils/timeControls";
import { BOT_DIFFICULTIES } from "../utils/botDifficulty";

export const BulletIcon = ({ className = "w-4 h-4", ...props }) => {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <g transform="rotate(-45 12 12)">
        <path d="M12 2C9 5.5 8 8 8 11v8a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-8c0-3-1-5.5-4-9z" />
        <line x1="8" y1="14" x2="16" y2="14" />
        <line x1="8" y1="18" x2="16" y2="18" />
      </g>
    </svg>
  );
};

const GameSidebar = ({
  moves,
  game,
  setGame,
  setMoves,
  flipBoard,
  resetClock,
  setGameStarted,
  gameStarted,
  isGameOver,
  whiteFlagged,
  blackFlagged,
  resetCapturedPieces,
  isLoggedIn,
  activeUser,
  onAuthRequired,
  onNewGameRequest,
  timeControl,
  setTimeControl,
  onGameAction,
  setEndgame,
  gameMode,
  setGameMode,
  openMultiplayerLobby,
  incomingDrawOffer,
  drawOfferPending,
  acceptDrawOffer,
  declineDrawOffer,
  isRated,
  setIsRated,
  playerColor,
  setPlayerColor,
  setBoardOrientation,
  botColorChoice,
  setBotColorChoice,
  botDifficulty,
  setBotDifficulty,
  pendingBotGame,
  handleContinueBotGame,
  handleStartNewBotGame,
  assignBotGameRatings,
  whitePlayerName,
  blackPlayerName,
  whitePlayerRating,
  blackPlayerRating,
  completedGameRecord,
}) => {
  const navigate = useNavigate();
  const [showShareMenu, setShowShareMenu] = useState(false);
  const movesContainerRef = useRef(null);

  const [activeCategory, setActiveCategory] = useState("rapid");
  const [customMinutes, setCustomMinutes] = useState("10");
  const [customBaseSeconds, setCustomBaseSeconds] = useState("30");
  const [customBaseUnit, setCustomBaseUnit] = useState("minutes"); // "minutes" | "seconds"
  const [customIncrement, setCustomIncrement] = useState("5");

  const gameStartSound = useChessSounds().playGameStartSound;

  const getChessComCategory = (baseInSecs, incInSecs) => {
    const totalMins = baseInSecs / 60 + (40 * incInSecs) / 60;
    if (totalMins < 3) return "Bullet";
    if (totalMins < 10) return "Blitz";
    return "Rapid";
  };

  const currentFormatLabel =
    timeControl.base < 60
      ? `${timeControl.base}s+${timeControl.increment}`
      : `${Math.floor(timeControl.base / 60)}+${timeControl.increment}`;
  const currentCategoryPool = getChessComCategory(
    timeControl.base,
    timeControl.increment,
  );

  const previewMins = Math.max(1, parseInt(customMinutes, 10) || 1);
  const previewBaseSecondsValue = Math.min(
    59,
    Math.max(10, parseInt(customBaseSeconds, 10) || 10),
  );
  const previewBaseTotalSeconds =
    customBaseUnit === "seconds"
      ? previewBaseSecondsValue
      : previewMins * 60;
  const previewInc = Math.max(0, parseInt(customIncrement, 10) || 0);
  const previewCategoryPool = getChessComCategory(
    previewBaseTotalSeconds,
    previewInc,
  );

  // Reconstructs a Chess instance from the recorded moves and stamps it with
  // the player names/ratings so the resulting PGN carries proper headers
  // (otherwise White/Black/Elo tags are missing and show up as "?").
  const buildGameWithHeaders = () => {
    const tempGame = new Chess();
    moves.forEach((move) => tempGame.move(move));

    const headerEntries = [
      ["White", whitePlayerName || "White"],
      ["Black", blackPlayerName || "Black"],
    ];
    if (whitePlayerRating != null) {
      headerEntries.push(["WhiteElo", String(whitePlayerRating)]);
    }
    if (blackPlayerRating != null) {
      headerEntries.push(["BlackElo", String(blackPlayerRating)]);
    }
    tempGame.header(...headerEntries.flat());

    return tempGame;
  };

  const openAnalysis = () => {
    if (completedGameRecord?.pgn) {
      navigate("/analysis", {
        state: {
          moves,
          pgn: completedGameRecord.pgn,
          fen: completedGameRecord.fen,
          gameId: completedGameRecord.id,
        },
      });
      return;
    }

    // Fallback for cases where the DB save hasn't resolved yet (or failed):
    // reconstruct locally, still stamping the known names/ratings so the
    // headers aren't blank.
    const tempGame = buildGameWithHeaders();
    navigate("/analysis", {
      state: { moves, pgn: tempGame.pgn(), fen: tempGame.fen() },
    });
  };

  const handleCopy = async (type) => {
    if (type === "pgn" && completedGameRecord?.pgn) {
      await navigator.clipboard.writeText(completedGameRecord.pgn);
      toast.success("PGN copied!");
      setShowShareMenu(false);
      return;
    }
    if (type === "fen" && completedGameRecord?.fen) {
      await navigator.clipboard.writeText(completedGameRecord.fen);
      toast.success("FEN copied!");
      setShowShareMenu(false);
      return;
    }

    const tempGame = buildGameWithHeaders();
    const value = type === "pgn" ? tempGame.pgn() : tempGame.fen();
    await navigator.clipboard.writeText(value);
    toast.success(`${type.toUpperCase()} copied!`);
    setShowShareMenu(false);
  };

  useEffect(() => {
    if (movesContainerRef.current) {
      movesContainerRef.current.scrollTop =
        movesContainerRef.current.scrollHeight;
    }
  }, [moves]);

  let statusText = "";
  let statusClass = "";

  if (gameStarted) {
    statusText = "Game Active";
    statusClass = "text-emerald-400 bg-emerald-500/10 border-white/10";

    if (whiteFlagged || blackFlagged || game.isGameOver()) {
      statusText = "Match Finished";
      statusClass = "text-rose-400 bg-rose-500/10 border-white/10 font-medium";
    } else if (game.isCheck()) {
      statusText = "Check!";
      statusClass =
        "text-amber-400 bg-amber-500/10 border-white/10 animate-pulse";
    }
  }

  const handleNewGame = async () => {
    if (!isLoggedIn && !activeUser?.isGuest) {
      onAuthRequired();
      return;
    }

    if (onNewGameRequest && isLoggedIn) {
      const restored = await onNewGameRequest();
      if (restored) {
        return;
      }
    }

    if (gameMode === "multiplayer") {
      openMultiplayerLobby();
      return;
    }

    // Logged-in users: always go through the same synced start used for "New Game"
    if (isLoggedIn && handleStartNewBotGame) {
      await handleStartNewBotGame();
      return;
    }

    const resolvedColor =
      botColorChoice === "random"
        ? Math.random() < 0.5
          ? "white"
          : "black"
        : botColorChoice;
    setPlayerColor(resolvedColor);
    setBoardOrientation(resolvedColor);
    assignBotGameRatings?.(resolvedColor);

    resetClock();
    setGame(new Chess());
    setMoves([]);
    resetCapturedPieces();
    setGameStarted(true);
    setEndgame({ type: null, winner: null });
    gameStartSound();
  };

  const handleSelectBotColor = (choice) => {
    setBotColorChoice(choice);

    if (choice !== "random") {
      setPlayerColor(choice);
      setBoardOrientation(choice);
    }
  };

  const applyCustomTime = () => {
    setTimeControl({ base: previewBaseTotalSeconds, increment: previewInc });
    const baseLabel =
      customBaseUnit === "seconds"
        ? `${previewBaseSecondsValue}s`
        : `${previewMins} min`;
    toast.success(
      `Custom setup applied: ${baseLabel} | ${previewInc}s (${previewCategoryPool})`,
    );
  };

  const showAnalysisButton =
    isLoggedIn && (isGameOver || !gameStarted) && moves.length > 0;
  const showFlipBoardButton = !gameStarted || isGameOver;
  const isMatchRunning = gameStarted && !isGameOver;

  const movePairs = [];
  for (let i = 0; i < moves.length; i += 2) {
    movePairs.push({ white: moves[i], black: moves[i + 1] || "" });
  }

  return (
    <div className="flex flex-col h-full justify-between overflow-hidden">
      {/* Top Section */}
      <div className="shrink-0">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold tracking-wide text-zinc-400">
            Match Setup
          </h2>
          <div className="flex items-center gap-2">
            {showAnalysisButton && (
              <button
                onClick={openAnalysis}
                className="bg-zinc-800 hover:bg-zinc-750 border border-white/10 p-2.5 rounded-xl transition shadow cursor-pointer"
                title="Analysis Deck"
              >
                <ZoomIn size={18} className="text-zinc-200" />
              </button>
            )}

            {moves.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowShareMenu(!showShareMenu)}
                  className="w-20 py-2.5 px-4 text-xs font-semibold rounded-xl bg-purple-600 hover:bg-purple-500 transition shadow flex items-center justify-center gap-1 cursor-pointer"
                >
                  Share
                </button>
                {showShareMenu && (
                  <div className="absolute right-0 mt-2 w-36 bg-zinc-800 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-20">
                    <button
                      onClick={() => handleCopy("pgn")}
                      className="w-full text-left text-xs px-4 py-2.5 hover:bg-zinc-700 transition text-zinc-200 cursor-pointer"
                    >
                      Copy PGN
                    </button>
                    <button
                      onClick={() => handleCopy("fen")}
                      className="w-full text-left text-xs px-4 py-2.5 hover:bg-zinc-700 transition text-zinc-200 cursor-pointer"
                    >
                      Copy FEN
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Configuration Setup Module: Visible only when match is idle */}
        {!isMatchRunning && (
          <div className="space-y-4 mb-5">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setGameMode("bot")}
                className={`rounded px-2 py-1 cursor-pointer ${gameMode === "bot" ? "bg-blue-300" : "bg-orange-300"}`}
              >
                <span className="text-gray-800 font-semibold">Bot</span>
              </button>

              <button
                onClick={() => setGameMode("multiplayer")}
                className={`rounded px-2 py-1 cursor-pointer ${gameMode === "multiplayer" ? "bg-blue-300" : "bg-orange-300"}`}
              >
                <span className="text-gray-800 font-semibold">Multiplayer</span>
              </button>
            </div>

            {/* Rated / Unrated Toggle */}
            {gameMode === "multiplayer" && (
              <div className="flex items-center justify-between bg-zinc-950/50 border border-white/5 rounded-xl px-4 py-3">
                <span className="text-xs font-semibold text-zinc-400">
                  Game Type
                </span>
                <button
                  onClick={() => setIsRated((prev) => !prev)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                    isRated
                      ? "bg-amber-500/10 border-amber-500/40 text-amber-400"
                      : "bg-zinc-800 border-white/10 text-zinc-400"
                  }`}
                >
                  {isRated ? (
                    <>
                      <Star size={14} fill="currentColor" /> Rated
                    </>
                  ) : (
                    <>
                      <Circle size={14} /> Unrated
                    </>
                  )}
                </button>
              </div>
            )}

            <div className="flex items-center gap-2 w-full">
              {pendingBotGame && gameMode === "bot" ? (
                /* Display side-by-side when a pending game is detected */
                <>
                  <button
                    onClick={handleContinueBotGame}
                    className="flex-1 py-3.5 px-3 text-xs font-bold bg-purple-600 hover:bg-purple-500 transition rounded-xl shadow-md cursor-pointer text-white truncate"
                  >
                    Continue Game
                  </button>
                  <button
                    onClick={handleStartNewBotGame}
                    className="flex-1 py-3.5 px-3 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 transition rounded-xl shadow-md cursor-pointer text-white truncate"
                  >
                    New Game
                  </button>
                </>
              ) : (
                /* Standard Single New Game Button */
                <button
                  onClick={handleNewGame}
                  className="flex-1 py-3.5 px-5 text-base font-bold bg-emerald-600 hover:bg-emerald-500 transition rounded-xl shadow-md cursor-pointer"
                >
                  New Game
                </button>
              )}

              {gameMode === "multiplayer" ? (
                /* Dynamic Status Pill detailing standard Chess.com classification split */
                <div className="bg-zinc-800 border border-white/10 px-3 py-2 rounded-xl font-mono text-center shadow-md select-none flex flex-col justify-center min-w-28">
                  <span className="text-sm font-bold text-purple-400">
                    ⏱️ {currentFormatLabel}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mt-0.5">
                    {currentCategoryPool}
                  </span>
                </div>
              ) : (
                /* Bot mode has no time control — show the chosen side instead */
                <div className="bg-zinc-800 border border-white/10 px-3 py-2 rounded-xl font-mono text-center shadow-md select-none flex flex-col justify-center items-center min-w-28">
                  {botColorChoice === "random" ? (
                    <div className="w-4 h-4 rounded-full bg-gradient-to-r from-white to-zinc-900 border border-zinc-500 flex items-center justify-center">
                      <Shuffle size={10} className="text-purple-400" />
                    </div>
                  ) : (
                    <span
                      className={`w-4 h-4 rounded-full ${
                        botColorChoice === "white"
                          ? "bg-white border border-zinc-600"
                          : "bg-black border border-white"
                      }`}
                    />
                  )}
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mt-1">
                    {botColorChoice === "random"
                      ? "Random"
                      : botColorChoice === "white"
                        ? "Playing White"
                        : "Playing Black"}
                  </span>
                </div>
              )}
            </div>

            {gameMode === "bot" && (
              /* Bot Mode: choose the engine's difficulty for the next game.
                 (Continuing a pending game keeps whatever difficulty it was
                 originally started with, restored from the saved record.) */
              <div className="space-y-2">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 pl-1">
                  Bot Difficulty
                </h3>
                <div className="grid grid-cols-3 grid-rows-2 gap-2">
                  {BOT_DIFFICULTIES.map((tier) => (
                    <button
                      key={tier.key}
                      type="button"
                      onClick={() => setBotDifficulty(tier.key)}
                      className={`flex flex-col items-center justify-center gap-0.5 py-2.5 px-1 rounded-xl border transition cursor-pointer text-xs font-semibold ${
                        botDifficulty === tier.key
                          ? "bg-purple-600/10 border-purple-500 text-purple-400"
                          : "bg-zinc-800/40 border-white/5 hover:bg-zinc-800 text-zinc-300"
                      }`}
                    >
                      <span>{tier.label}</span>
                      <span className="text-[10px] font-mono text-zinc-500">
                        {tier.elo} Elo
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {gameMode === "bot" ? (
              /* Bot Mode: choose which side the human plays */
              <div className="space-y-2">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 pl-1">
                  Choose Your Side
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleSelectBotColor("white")}
                    className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border transition cursor-pointer text-xs font-semibold ${
                      botColorChoice === "white"
                        ? "bg-purple-600/10 border-purple-500 text-purple-400"
                        : "bg-zinc-800/40 border-white/5 hover:bg-zinc-800 text-zinc-300"
                    }`}
                  >
                    <span className="w-4 h-4 rounded-full bg-white border border-zinc-600" />
                    White
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectBotColor("black")}
                    className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border transition cursor-pointer text-xs font-semibold ${
                      botColorChoice === "black"
                        ? "bg-purple-600/10 border-purple-500 text-purple-400"
                        : "bg-zinc-800/40 border-white/5 hover:bg-zinc-800 text-zinc-300"
                    }`}
                  >
                    <span className="w-4 h-4 rounded-full bg-black border border-white" />
                    Black
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectBotColor("random")}
                    className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border transition cursor-pointer text-xs font-semibold ${
                      botColorChoice === "random"
                        ? "bg-purple-600/10 border-purple-500 text-purple-400"
                        : "bg-zinc-800/40 border-white/5 hover:bg-zinc-800 text-zinc-300"
                    }`}
                  >
                    <Shuffle size={16} />
                    Random
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Time Category Selector Tabs */}
                <div className="grid grid-cols-4 gap-1 bg-zinc-950 p-1 rounded-xl border border-white/5">
                  {["bullet", "blitz", "rapid", "custom"].map((cat) => {
                    const isActive = activeCategory === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setActiveCategory(cat)}
                        className={`py-2 text-xs font-semibold rounded-lg capitalize transition cursor-pointer flex items-center justify-center gap-1 ${
                          isActive
                            ? "bg-purple-600 text-white shadow"
                            : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                        }`}
                      >
                        {cat === "bullet" && <BulletIcon size={13} />}
                        {cat === "blitz" && <Zap size={13} />}
                        {cat === "rapid" && <Clock size={13} />}
                        {cat === "custom" && <Sliders size={13} />}
                        <span className="hidden sm:inline">{cat}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Sub-Panel: Standard Presets vs Custom Inputs Selector */}
                {activeCategory !== "custom" ? (
                  <div className="grid grid-cols-2 gap-2 max-h-28 overflow-y-auto pr-1 custom-scrollbar">
                    {TIME_PRESETS[activeCategory]?.map((preset) => {
                      const isSelected =
                        timeControl.base === preset.base &&
                        timeControl.increment === preset.increment;
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() =>
                            setTimeControl({
                              base: preset.base,
                              increment: preset.increment,
                            })
                          }
                          className={`py-2 px-3 text-xs font-medium rounded-xl border transition cursor-pointer text-center truncate ${
                            isSelected
                              ? "bg-purple-600/10 border-purple-500 text-purple-400 font-bold"
                              : "bg-zinc-800/40 border-white/5 hover:bg-zinc-800 text-zinc-300"
                          }`}
                        >
                          {preset.label.split(" ")[0]}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-3 bg-zinc-950/40 border border-white/5 rounded-xl space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-[10px] uppercase font-bold tracking-wider text-zinc-500">
                            Base
                          </label>
                          <div className="flex gap-0.5 bg-zinc-900 border border-white/10 rounded-md p-0.5">
                            <button
                              type="button"
                              onClick={() => setCustomBaseUnit("minutes")}
                              className={`px-1.5 py-0.5 text-[9px] font-bold uppercase rounded cursor-pointer transition ${
                                customBaseUnit === "minutes"
                                  ? "bg-purple-600 text-white"
                                  : "text-zinc-500 hover:text-zinc-300"
                              }`}
                            >
                              Min
                            </button>
                            <button
                              type="button"
                              onClick={() => setCustomBaseUnit("seconds")}
                              className={`px-1.5 py-0.5 text-[9px] font-bold uppercase rounded cursor-pointer transition ${
                                customBaseUnit === "seconds"
                                  ? "bg-purple-600 text-white"
                                  : "text-zinc-500 hover:text-zinc-300"
                              }`}
                            >
                              Sec
                            </button>
                          </div>
                        </div>
                        {customBaseUnit === "minutes" ? (
                          <input
                            type="number"
                            min="1"
                            max="180"
                            value={customMinutes}
                            onChange={(e) => setCustomMinutes(e.target.value)}
                            className="w-full bg-zinc-900 border border-white/10 rounded-lg p-2 text-xs text-center text-white focus:outline-none focus:border-purple-500 font-mono"
                          />
                        ) : (
                          <input
                            type="number"
                            min="10"
                            max="59"
                            value={customBaseSeconds}
                            onChange={(e) =>
                              setCustomBaseSeconds(e.target.value)
                            }
                            className="w-full bg-zinc-900 border border-white/10 rounded-lg p-2 text-xs text-center text-white focus:outline-none focus:border-purple-500 font-mono"
                          />
                        )}
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-bold tracking-wider text-zinc-500 mb-1">
                          Increment (Secs)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="60"
                          value={customIncrement}
                          onChange={(e) => setCustomIncrement(e.target.value)}
                          className="w-full bg-zinc-900 border border-white/10 rounded-lg p-2 text-xs text-center text-white focus:outline-none focus:border-purple-500 font-mono"
                        />
                      </div>
                    </div>

                    {/* Interactive Dynamic Category Indicator message inside the action button */}
                    <button
                      type="button"
                      onClick={applyCustomTime}
                      className="w-full py-2 bg-zinc-800 hover:bg-purple-600 hover:text-white transition rounded-lg text-xs font-bold text-zinc-300 border border-white/5 cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
                    >
                      <span>Apply Parameters</span>
                      <span className="text-[10px] bg-black/30 text-purple-400 font-semibold px-1.5 py-0.5 rounded uppercase border border-white/5 group-hover:text-white">
                        {previewCategoryPool}
                      </span>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Dashboard Frame Status Bar */}
        {(showFlipBoardButton || statusText) && (
          <div className="bg-zinc-950/40 border border-white/10 rounded-xl p-4 mb-4 flex items-center justify-between gap-4 shadow-inner">
            {showFlipBoardButton ? (
              <button
                onClick={flipBoard}
                className="bg-blue-600 hover:bg-blue-500 text-xs font-semibold px-4 py-2.5 rounded-lg transition border border-white/5 shadow-md cursor-pointer"
              >
                Flip Board
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <div
                  className={`w-2.5 h-2.5 rounded-full ${game.turn() === "w" ? "bg-white" : "bg-black border border-zinc-600"}`}
                />
                <span className="text-xs font-semibold text-zinc-400">
                  {game.turn() === "w" ? "White's turn" : "Black's turn"}
                </span>
              </div>
            )}

            {statusText && (
              <div
                className={`text-xs font-bold px-2.5 py-1.5 rounded-md border ${statusClass}`}
              >
                {statusText}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Center Stack: Move Log List History */}
      <div className="flex-1 flex flex-col min-h-40 mb-4">
        <h3 className="font-semibold text-zinc-500 text-xs uppercase tracking-wider mb-2 pl-1">
          Moves Played
        </h3>
        <div
          ref={movesContainerRef}
          className="bg-zinc-950/60 border border-white/10 rounded-xl p-2 max-h-100 overflow-y-auto space-y-0.5 flex-1 shadow-inner custom-scrollbar"
        >
          {moves.length === 0 ? (
            <div className="h-full flex items-center justify-center p-4">
              <p className="text-zinc-600 text-xs italic">
                No notation items logged yet
              </p>
            </div>
          ) : (
            movePairs.map((pair, index) => (
              <div
                key={index}
                className="px-3 py-2 rounded-md flex justify-between items-center font-mono text-xs border-b border-zinc-900/40 last:border-0 hover:bg-zinc-800/30 transition"
              >
                <span className="text-zinc-600 font-bold w-8">
                  {index + 1}.
                </span>
                <span className="flex-1 text-left text-zinc-200 font-semibold">
                  {pair.white}
                </span>
                <span className="flex-1 text-left text-zinc-400">
                  {pair.black}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Bottom Section Action Bar: Appears exclusively when game is running */}
      {isMatchRunning && (
        <div className="bg-zinc-950/40 border border-white/10 rounded-xl p-3 space-y-3 shadow-md">
          <div className="flex items-center justify-between px-2 py-1 text-xs font-semibold text-zinc-500 tracking-wide uppercase border-b border-white/5">
            <span className="flex items-center gap-1.5">
              {gameMode === "multiplayer" ? "Live Pool Tier" : "Playing vs Bot"}
              {gameMode === "bot" && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded normal-case">
                  {BOT_DIFFICULTIES.find((tier) => tier.key === botDifficulty)
                    ?.label || "Medium"}
                </span>
              )}
            </span>
            <div className="flex items-center gap-2">
              {gameMode === "multiplayer" && (
                <span
                  className={`text-[12px] font-bold px-2 py-0.5 rounded border w-25 mr-10 ${
                    isRated
                      ? "text-amber-400 bg-amber-500/10 border-amber-500/30"
                      : "text-zinc-400 bg-zinc-800/80 border-white/10"
                  }`}
                >
                  {isRated ? (
                    <div className="flex gap-2">
                      <div>
                        <Star size={14} fill="currentColor" />{" "}
                      </div>
                      <div>Rated</div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <div>
                        <Circle size={14} />
                      </div>
                      <div>Unrated</div>
                    </div>
                  )}
                </span>
              )}
              {gameMode === "multiplayer" ? (
                <span className="text-purple-400 font-mono tracking-normal bg-zinc-800/80 px-2 py-0.5 rounded border border-white/5 text-[11px] uppercase font-bold">
                  {currentCategoryPool} ({currentFormatLabel})
                </span>
              ) : (
                <span className="text-purple-400 font-mono tracking-normal bg-zinc-800/80 px-2 py-0.5 rounded border border-white/5 text-[11px] uppercase font-bold">
                  You: {playerColor === "white" ? "White" : "Black"}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {/* Abort — multiplayer only, before move 2 */}
            {gameMode === "multiplayer" && moves.length < 2 ? (
              <button
                onClick={() => onGameAction("abort")}
                className="flex flex-col items-center gap-1 py-3 px-2 bg-zinc-800 hover:bg-zinc-750 transition border border-white/10 rounded-xl text-xs font-semibold text-zinc-300 shadow-sm cursor-pointer"
                title="Abort Match"
              >
                <AlertTriangle size={16} className="text-amber-400" />
                <span>Abort</span>
              </button>
            ) : (
              <div className="flex flex-col items-center justify-center py-3 px-2 bg-zinc-900/40 border border-white/5 rounded-xl text-xs text-zinc-600 font-medium select-none">
                <span>No Abort</span>
              </div>
            )}

            {/* Draw — multiplayer only */}
            {gameMode === "multiplayer" && moves.length > 1 ? (
              <button
                onClick={() => onGameAction("draw")}
                className="flex flex-col items-center gap-1 py-3 px-2 bg-zinc-800 hover:bg-zinc-750 transition border border-white/10 rounded-xl text-xs font-semibold text-zinc-300 shadow-sm cursor-pointer"
                title="Offer Draw"
              >
                <HelpCircle size={16} className="text-sky-400" />
                <span>Offer Draw</span>
              </button>
            ) : (
              <div className="flex flex-col items-center justify-center py-3 px-2 bg-zinc-900/40 border border-white/5 rounded-xl text-xs text-zinc-600 font-medium select-none">
                <span>No Draw</span>
              </div>
            )}

            {gameMode === "multiplayer" && moves.length < 2 ? (
              <div className="flex flex-col items-center justify-center py-3 px-2 bg-zinc-900/40 border border-white/5 rounded-xl text-xs text-zinc-600 font-medium select-none">
                <Flag size={16} className="text-zinc-700 mb-1" />
                <span>Resign</span>
              </div>
            ) : (
              <button
                onClick={() => onGameAction("resign")}
                className="flex flex-col items-center gap-1 py-3 px-2 bg-rose-950/40 hover:bg-rose-900/40 transition border border-rose-500/20 rounded-xl text-xs font-semibold text-rose-400 shadow-sm cursor-pointer"
                title="Resign Match"
              >
                <Flag size={16} className="text-rose-500" />
                <span>Resign</span>
              </button>
            )}
          </div>

          {/* Incoming Draw Offer Alert Box */}
          {incomingDrawOffer && (
            <div className="mt-3 p-3 bg-sky-950/30 border border-sky-500/30 rounded-xl space-y-2.5 animate-fade-in shadow-lg">
              <div className="flex items-center gap-2 text-sky-400">
                <HelpCircle size={15} className="animate-pulse" />
                <span className="text-[11px] font-bold uppercase tracking-wider">
                  Draw Offer Received
                </span>
              </div>
              <p className="text-xs text-zinc-300 leading-normal">
                Your opponent is offering a mutual draw. Accepting will conclude
                this game immediately.
              </p>
              <div className="grid grid-cols-2 gap-2 pt-0.5">
                <button
                  onClick={acceptDrawOffer}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow-md active:scale-98 cursor-pointer"
                >
                  <Check size={14} strokeWidth={2.5} />
                  Accept
                </button>
                <button
                  onClick={declineDrawOffer}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 bg-zinc-800 hover:bg-zinc-750 text-zinc-300 border border-white/5 rounded-lg text-xs font-bold transition-all active:scale-98 cursor-pointer"
                >
                  <X size={14} strokeWidth={2.5} />
                  Decline
                </button>
              </div>
            </div>
          )}

          {/* Pending Draw Offer (Sent State) */}
          {drawOfferPending && !incomingDrawOffer && (
            <div className="mt-3 p-3 bg-zinc-900/80 border border-white/5 rounded-xl flex items-center justify-center gap-2.5 shadow-inner">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
              </span>
              <span className="text-[11px] text-zinc-400 font-medium tracking-wide">
                Draw offer sent. Waiting for opponent...
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GameSidebar;