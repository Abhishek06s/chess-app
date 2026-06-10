import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { analyzePosition } from "../services/stockfishService";
import { generateGameReview } from "../utils/gameReview";
import { Chessboard } from "react-chessboard";
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

  useEffect(() => {
    if (!state?.pgn) return;

    const startReview = async () => {
      setIsReviewing(true);

      try {
        const results = await generateGameReview(state.pgn, analyzePosition);

        setReviewData(results);
      } catch (error) {
        console.error("Game review failed:", error);
      } finally {
        setIsReviewing(false);
      }
    };

    startReview();
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
      const moveAccuracy = 100 * Math.exp(-4 * loss);
      return sum + moveAccuracy;
    }, 0);

    const finalAccuracy = totalAccuracyScore / evaluatedMoves.length;
    return Math.min(100, Math.max(0, finalAccuracy)).toFixed(1);
  };

  const goToFirst = () => setCurrentIndex(0);
  const goToPrev = () => setCurrentIndex((prev) => Math.max(prev - 1, 0));
  const goToNext = () =>
    setCurrentIndex((prev) => Math.min(prev + 1, reviewData.length - 1));
  const goToLast = () => setCurrentIndex(Math.max(reviewData.length - 1, 0));

  if (isReviewing) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center">
        <h1 className="text-3xl font-bold mb-6">Analyzing your game...</h1>

        <div className="w-96 bg-zinc-800 rounded-full h-4 overflow-hidden">
          <div className="bg-green-500 h-full animate-pulse w-full" />
        </div>

        <p className="text-zinc-400 mt-4">Running Stockfish analysis...</p>
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
                  {currentReview
                    ? typeof currentReview.evalAfter === "string"
                      ? currentReview.evalAfter.replace("M-", "-M")
                      : currentReview.evalAfter > 0
                        ? `+${currentReview.evalAfter}`
                        : currentReview.evalAfter
                    : "-"}
                </span>
              </div>
            </div>
          </div>

          {isReviewing ? (
            <div className="text-center text-zinc-400 py-10 shrink-0">
              Running full game review analysis...
            </div>
          ) : reviewData.length === 0 ? (
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
