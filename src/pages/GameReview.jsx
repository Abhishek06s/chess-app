import { useEffect, useMemo, useState, forwardRef } from "react";
import { useLocation } from "react-router-dom";
import { analyzePosition } from "../services/stockfishService";
import { generateGameReview } from "../utils/gameReview";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import useStockfish from "../hooks/useStockFish";
import useChessSounds from "../hooks/useChessSounds";

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Repeat,
} from "react-feather";

import { Star, Check, ThumbsUp, BookOpen, X, KeyRound } from "lucide-react";

const GameReview = () => {
  const { state } = useLocation();

  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewData, setReviewData] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [boardOrientation, setBoardOrientation] = useState("white");
  const [progress, setProgress] = useState(0);

  const { playMoveSound, playCaptureSound, playCheckSound, playGameEndSound } =
    useChessSounds();

  const triggerMoveSound = (targetNode) => {
    if (!targetNode?.fenBefore) return;

    try {
      const prevGame = new Chess(targetNode.fenBefore);
      const moveResult = prevGame.move(targetNode.san);

      if (moveResult) {
        if (prevGame.isGameOver()) {
          playGameEndSound();
        } else if (prevGame.isCheck()) {
          playCheckSound();
        } else if (moveResult.captured) {
          playCaptureSound();
        } else {
          playMoveSound();
        }
      }
    } catch (e) {
      console.error("Sound playback error:", e);
    }
  };

  const moveIcons = {
    Brilliant: (
      <span className="font-extrabold text-[11px] tracking-tighter leading-none select-none">
        !!
      </span>
    ),
    Great: (
      <span className="font-extrabold text-[11px] leading-none select-none">
        !
      </span>
    ),
    Best: <Star size={12} fill="currentColor" strokeWidth={1} />,
    Excellent: <ThumbsUp size={11} fill="currentColor" />,
    Good: <Check size={14} strokeWidth={3} />,
    Book: <BookOpen size={12} fill="currentColor" />,
    Inaccuracy: (
      <span className="font-extrabold text-[11px] tracking-tighter leading-none select-none">
        !?
      </span>
    ),
    Mistake: (
      <span className="font-extrabold text-[11px] tracking-tighter leading-none select-none">
        ?
      </span>
    ),
    Miss: <X size={14} strokeWidth={3} />,
    Blunder: (
      <span className="font-extrabold text-[11px] tracking-tighter leading-none select-none">
        ??
      </span>
    ),
    Forced: <KeyRound size={11} strokeWidth={2.5} />,
  };

  const moveColors = {
    Brilliant: "bg-[#1baca6] text-white",
    Great: "bg-[#45b6fe] text-white",
    Best: "bg-[#265e34] text-white",
    Excellent: "bg-[#81b64c] text-white",
    Good: "bg-[#a3d16c] text-white",
    Book: "bg-[#b58863] text-white",
    Inaccuracy: "bg-[#f7c04a] text-white",
    Mistake: "bg-[#ffa459] text-white",
    Miss: "bg-[#ff3b30] text-white",
    Blunder: "bg-[#fa4137] text-white",
    Forced: "bg-[#969492] text-white",
  };

  const boardHighlightColors = {
    Brilliant: "rgba(27, 172, 166, 0.5)",
    Great: "rgba(69, 182, 254, 0.5)",
    Best: "rgba(38, 94, 52, 0.5)",
    Excellent: "rgba(129, 182, 76, 0.5)",
    Good: "rgba(163, 209, 108, 0.5)",
    Book: "rgba(181, 136, 99, 0.5)",
    Inaccuracy: "rgba(247, 192, 74, 0.5)",
    Mistake: "rgba(255, 164, 89, 0.5)",
    Miss: "rgba(255, 59, 48, 0.5)",
    Blunder: "rgba(250, 65, 55, 0.5)",
    Forced: "rgba(150, 148, 146, 0.5)",
  };

  const movePairs = useMemo(() => {
    const pairs = [];
    for (let i = 0; i < reviewData.length; i += 2) {
      pairs.push({
        white: reviewData[i],
        black: reviewData[i + 1] || null,
        moveNumber: Math.floor(i / 2) + 1,
      });
    }
    return pairs;
  }, [reviewData]);

  const currentReview = reviewData[currentIndex];

  const currentFen =
    currentReview?.fenAfter ||
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

  const { bestMove, depth, topLines } = useStockfish(currentFen);

  const gameHistory = useMemo(() => {
    if (!state?.pgn) return [];
    try {
      const historyInstance = new Chess();
      historyInstance.loadPgn(state.pgn);
      return historyInstance.history({ verbose: true });
    } catch (e) {
      console.error("Error preprocessing PGN history:", e);
      return [];
    }
  }, [state?.pgn]);

  useEffect(() => {
    if (!state?.pgn) return;

    let isCurrent = true;

    const startReview = async () => {
      setIsReviewing(true);
      setProgress(0); 
      setReviewData([]); 

      try {
        const results = await generateGameReview(
          state.pgn,
          analyzePosition,
          (percentage) => {
            
            if (isCurrent) {
              setProgress(percentage);
            }
          },
        );

        if (isCurrent) {
          setReviewData(results);
        }
      } catch (error) {
        if (isCurrent) {
          console.error("Game review failed:", error);
        }
      } finally {
        if (isCurrent) {
          setIsReviewing(false);
        }
      }
    };

    startReview();

    return () => {
      isCurrent = false;
    };
  }, [state]);

  const getSummary = (side) => {
    const moves = reviewData.filter((m) => m.side === side);

    const counts = {
      Brilliant: 0,
      Great: 0,
      Best: 0,
      Mistake: 0,
      Miss: 0,
      Blunder: 0,
    };

    moves.forEach((move) => {
      if (counts[move.classification] !== undefined) {
        counts[move.classification]++;
      }
    });

    return counts;
  };

  const whiteSummary = getSummary("white");
  const blackSummary = getSummary("black");

  const calculateAccuracy = (moves) => {
    if (!moves || moves.length === 0) return "0.0";

    const evaluatedMoves = moves.filter(
      (move) =>
        move.classification !== "Book" && move.classification !== "Forced",
    );

    if (evaluatedMoves.length === 0) return "100.0";

    const totalAccuracyScore = evaluatedMoves.reduce((sum, move) => {
      const loss = move.accuracyLoss ?? 0;
      const moveAccuracy = 100 * Math.exp(-9 * loss);
      return sum + moveAccuracy;
    }, 0);

    const finalAccuracy = totalAccuracyScore / evaluatedMoves.length;
    return Math.min(100, Math.max(0, finalAccuracy)).toFixed(1);
  };

  useEffect(() => {
    const currentMove = reviewData[currentIndex];

    if (currentMove) {
      triggerMoveSound(currentMove);
    }
  }, [currentIndex]);

  const goToFirst = () => setCurrentIndex(0);
  const goToPrev = () => setCurrentIndex((prev) => Math.max(prev - 1, 0));
  const goToNext = () =>
    setCurrentIndex((prev) => Math.min(prev + 1, reviewData.length - 1));
  const goToLast = () => setCurrentIndex(Math.max(reviewData.length - 1, 0));

  const cachedEval = currentReview?.evalAfter ?? 0;

  const isMate =
    typeof cachedEval === "string" &&
    (cachedEval.includes("M") || cachedEval.includes("#"));

  const numericEval = isMate ? 0 : Number(cachedEval);

  const displayEvalString = currentReview
    ? typeof currentReview.evalAfter === "string"
      ? currentReview.evalAfter.replace("M-", "-M")
      : currentReview.evalAfter > 0
        ? `+${currentReview.evalAfter}`
        : currentReview.evalAfter
    : "0.0";

  const barHeight = isMate
    ? cachedEval.startsWith("-") || cachedEval.startsWith("M-")
      ? 0
      : 100
    : Math.min(Math.max(50 + numericEval * 8, 5), 95);

  const evalBarStyle =
    boardOrientation === "white"
      ? {
          bottom: 0,
          height: `${barHeight}%`,
        }
      : {
          top: 0,
          height: `${barHeight}%`,
        };

  const customSquareStyles = useMemo(() => {
    if (!currentReview || reviewData.length === 0) return {};

    const move = reviewData[currentIndex];
    if (!move) return {};

    const moveDetails = gameHistory[currentIndex];
    if (moveDetails) {
      const highlightColor =
        boardHighlightColors[move.classification] ||
        "rgba(255, 255, 255, 0.15)";

      return {
        [moveDetails.from]: { backgroundColor: highlightColor },
        [moveDetails.to]: { backgroundColor: highlightColor },
      };
    }
    return {};
  }, [currentIndex, reviewData, currentReview, gameHistory]);

  const customSquareElements = useMemo(() => {
    if (currentIndex < 0 || !currentReview || reviewData.length === 0)
      return {};

    const move = reviewData[currentIndex];
    if (!move || !move.classification || !moveIcons[move.classification])
      return {};

    const moveDetails = gameHistory[currentIndex];
    if (moveDetails) {
      const targetSquare = moveDetails.to;
      const isAnimatedMove =
        move.classification === "Brilliant" || move.classification === "Great";

      return {
        [targetSquare]: (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              zIndex: 50,
              pointerEvents: "none",
            }}
          >
            <div
              key={currentIndex}
              className={`absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center border border-zinc-600 shadow-md select-none ${moveColors[move.classification]} ${
                isAnimatedMove ? "animate-pop-snap" : ""
              }`}
              style={isAnimatedMove ? {} : { transform: "scale(1.15)" }}
            >
              {moveIcons[move.classification]}
            </div>
          </div>
        ),
      };
    }
    return {};
  }, [currentIndex, reviewData, currentReview, gameHistory]);

  const MemoizedSquare = useMemo(() => {
    return forwardRef(
      ({ children, square, squareColor, style, ...rest }, ref) => (
        <div
          ref={ref}
          style={{ ...style, position: "relative" }}
          {...rest} 
        >
          {children}
          {customSquareElements[square]}
        </div>
      ),
    );
  }, [customSquareElements]);

  if (isReviewing) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-4">
        <h1 className="text-3xl font-bold mb-2 tracking-wide">
          Analyzing your game...
        </h1>
        <p className="text-zinc-400 mb-6 text-sm">
          Running Stockfish deep evaluation engine
        </p>

        <div className="w-full max-w-md bg-zinc-900 rounded-full h-5 p-1 border border-zinc-800 shadow-inner flex items-center mb-3">
          <div
            style={{ width: `${progress}%` }}
            className="bg-linear-to-r from-emerald-500 to-green-400 h-full rounded-full transition-all duration-300 ease-out"
          />
        </div>

        <span className="text-xl font-mono font-bold text-emerald-400">
          {progress}%
        </span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8">
      <h1 className="text-3xl text-center font-bold mb-10 -mt-4">
        Game Review
      </h1>
      <div className="grid lg:grid-cols-[750px_1fr] gap-10 max-w-7xl mx-auto">
        {/* Left Side: Board and Navigation Controls */}
        <div className="grid grid-cols-[30px_1fr] gap-4">
          <div className="w-6 h-150 bg-zinc-800 rounded-lg overflow-hidden relative flex flex-col justify-between border border-zinc-700 -ml-3">
            <div
              className="absolute w-full bg-white transition-all duration-300"
              style={evalBarStyle}
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span
                className={`text-[11px] font-black uppercase tracking-wider rotate-90 whitespace-nowrap
                  ${barHeight === 50 ? "hidden" : ""}
                  ${
                    boardOrientation === "white"
                      ? barHeight > 50
                        ? "text-black mt-10"
                        : "text-white mb-10"
                      : barHeight > 50
                        ? "text-black mb-10"
                        : "text-white mt-10"
                  }`}
              >
                {displayEvalString}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div
              style={{
                position: "relative",
                width: "100%",
                maxWidth: "600px",
                aspectRatio: "1/1",
              }}
              className="rounded-sm shadow-2xl"
            >
              <Chessboard
                position={currentFen}
                boardOrientation={boardOrientation}
                boardWidth={600}
                arePiecesDraggable={false}
                promotionDialogVariant="modal"
                customSquareStyles={customSquareStyles}
                customSquare={MemoizedSquare}
              />
            </div>

            <div className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 mt-4 w-full max-w-150">
              <button
                onClick={goToFirst}
                className="bg-zinc-800 hover:bg-zinc-700 p-3 rounded-lg flex justify-center transition-colors cursor-pointer text-white"
              >
                <ChevronsLeft size={24} />
              </button>

              <button
                onClick={goToPrev}
                className="bg-zinc-800 hover:bg-zinc-700 p-3 rounded-lg flex justify-center transition-colors cursor-pointer text-white"
              >
                <ChevronLeft size={24} />
              </button>

              <button
                onClick={goToNext}
                className="bg-zinc-800 hover:bg-zinc-700 p-3 rounded-lg flex justify-center transition-colors cursor-pointer text-white"
              >
                <ChevronRight size={24} />
              </button>

              <button
                onClick={goToLast}
                className="bg-zinc-800 hover:bg-zinc-700 p-3 rounded-lg flex justify-center transition-colors cursor-pointer text-white"
              >
                <ChevronsRight size={24} />
              </button>

              <button
                onClick={() =>
                  setBoardOrientation((prev) =>
                    prev === "white" ? "black" : "white",
                  )
                }
                title="Flip Board"
                className="bg-zinc-800 hover:bg-zinc-700 px-4 rounded-lg flex items-center justify-center transition-colors cursor-pointer text-white"
              >
                <Repeat size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Score Cards, Inspector, and Move Feed Container */}
        <div className="bg-zinc-900 rounded-xl p-5 -mr-15 max-h-167.5 overflow-y-auto border border-zinc-800 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4 shrink-0">
            <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
              <h3 className="font-bold mb-2">⚪ White</h3>

              <p className="text-blue-400 font-bold mb-4">
                Accuracy:{" "}
                {calculateAccuracy(
                  reviewData.filter((m) => m.side === "white"),
                )}
                %
              </p>

              {Object.entries(whiteSummary).map(([key, value]) => (
                <div
                  key={key}
                  className="flex justify-between items-center text-sm mt-1"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center ${moveColors[key]}`}
                    >
                      {moveIcons[key]}
                    </div>
                    <span>{key}</span>
                  </div>
                  <span>{value}</span>
                </div>
              ))}
            </div>

            <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
              <h3 className="font-bold mb-2">⚫ Black</h3>

              <p className="text-blue-400 font-bold mb-4">
                Accuracy:{" "}
                {calculateAccuracy(
                  reviewData.filter((m) => m.side === "black"),
                )}
                %
              </p>

              {Object.entries(blackSummary).map(([key, value]) => (
                <div
                  key={key}
                  className="flex justify-between items-center text-sm mt-1"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center ${moveColors[key]}`}
                    >
                      {moveIcons[key]}
                    </div>
                    <span>{key}</span>
                  </div>
                  <span>{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800/80 shadow-inner shrink-0">
            <p className="text-zinc-400 font-medium text-sm mb-1">
              Move Profile Tracker
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm font-mono mt-2">
              <div className="bg-zinc-900/50 p-2 rounded">
                Move:{" "}
                <span className="text-zinc-200 font-bold ml-1">
                  #{currentIndex + 1}{" "}
                </span>
                <span className="text-blue-400 font-bold ml-1">
                  {currentReview?.san || "-"}
                </span>
              </div>
              <div className="bg-zinc-900/50 p-2 rounded flex align-center">
                Type:
                {currentReview?.classification && (
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center ml-2 mr-1 ${moveColors[currentReview.classification]}`}
                  >
                    {moveIcons[currentReview.classification]}{" "}
                  </div>
                )}
                <span className="text-purple-400 font-bold">
                  {currentReview?.classification || "-"}
                </span>
              </div>
              <div className="bg-zinc-900/50 p-2 rounded">
                Best Rec:{" "}
                <span className="text-emerald-400 font-bold ml-1">
                  {currentReview?.bestMove || "-"}
                </span>
              </div>
              <div className="bg-zinc-900/50 p-2 rounded">
                Evaluation:{" "}
                <span className="text-amber-400 font-bold ml-1">
                  {displayEvalString}
                </span>
              </div>
            </div>
          </div>

          {reviewData.length === 0 ? (
            <div className="text-center text-zinc-500 py-10 shrink-0">
              No review data available.
            </div>
          ) : (
            <div className="space-y-2 w-full overflow-y-auto pr-1">
              {movePairs.map((pair) => (
                <div
                  key={pair.moveNumber}
                  className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-3"
                >
                  <div className="grid grid-cols-[40px_1fr_1fr] gap-2 items-center">
                    <span className="text-zinc-500 font-mono">
                      {pair.moveNumber}.
                    </span>

                    {pair.white && (
                      <button
                        onClick={() =>
                          setCurrentIndex(reviewData.indexOf(pair.white))
                        }
                        className={`flex items-center text-left p-2 rounded transition cursor-pointer ${
                          currentIndex === reviewData.indexOf(pair.white)
                            ? "bg-blue-600 font-bold text-white"
                            : "hover:bg-zinc-800 text-zinc-300"
                        }`}
                      >
                        <div
                          className={`inline-flex items-center justify-center w-6 h-6 rounded-full mr-2 shrink-0 shadow-sm ${moveColors[pair.white.classification]}`}
                        >
                          {moveIcons[pair.white.classification]}
                        </div>
                        <span className="font-medium">{pair.white.san}</span>
                      </button>
                    )}

                    {pair.black ? (
                      <button
                        onClick={() =>
                          setCurrentIndex(reviewData.indexOf(pair.black))
                        }
                        className={`flex items-center text-left p-2 rounded transition cursor-pointer ${
                          currentIndex === reviewData.indexOf(pair.black)
                            ? "bg-blue-600 font-bold text-white"
                            : "hover:bg-zinc-800 text-zinc-300"
                        }`}
                      >
                        <div
                          className={`inline-flex items-center justify-center w-6 h-6 rounded-full mr-2 shrink-0 shadow-sm ${moveColors[pair.black.classification]}`}
                        >
                          {moveIcons[pair.black.classification]}
                        </div>
                        <span className="font-medium">{pair.black.san}</span>
                      </button>
                    ) : (
                      <div />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GameReview;
