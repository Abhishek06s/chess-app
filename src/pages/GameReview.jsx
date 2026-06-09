import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Chess } from "chess.js";

import { buildMoveTree } from "../utils/moveTree";
import { analyzePosition } from "../services/stockfishService";
import { Chessboard } from "react-chessboard";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Repeat,
} from "react-feather";

const GameReview = () => {
  const { state } = useLocation();

  const [reviewResults, setReviewResults] = useState([]);
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewData, setReviewData] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [boardOrientation, setBoardOrientation] = useState("white");

  const currentReview = reviewData[currentIndex];

  const currentFen =
    currentReview?.afterFen ||
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

  useEffect(() => {
    if (!state?.pgn) return;

    const startReview = async () => {
      setIsReviewing(true);

      try {
        const root = buildMoveTree(state.pgn);
        const results = [];
        let currentNode = root; 

        while (currentNode && currentNode.children && currentNode.children.length > 0) {
          const childNode = currentNode.children[0];

          const engineResult = await analyzePosition(currentNode.fen);

          results.push({
            beforeFen: currentNode.fen,
            afterFen: childNode.fen,
            playedMove: childNode.san,
            bestMove: engineResult.bestMove,
            evaluation: engineResult.evaluation,
          });

          currentNode = childNode;
        }

        setReviewResults(results);
        setReviewData(results);
        setCurrentIndex(0);
      } catch (error) {
        console.error("Game review failed:", error);
      } finally {
        setIsReviewing(false);
      }
    };

    startReview();
  }, [state]);

  const goToFirst = () => setCurrentIndex(0);

  const goToPrev = () => setCurrentIndex((prev) => Math.max(prev - 1, 0));

  const goToNext = () =>
    setCurrentIndex((prev) => Math.min(prev + 1, reviewData.length - 1));

  const goToLast = () => setCurrentIndex(reviewData.length - 1);

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8">
      <h1 className="text-3xl text-center font-bold mb-10 -mt-4">
        Game Review
      </h1>
      <div className="grid lg:grid-cols-[750px_1fr] gap-10 max-w-7xl mx-auto">
        <div className="flex flex-col items-center gap-2">
          <div style={{ position: "relative", width: "100%", maxWidth: "600px", aspectRatio: "1/1" }} className="rounded-sm shadow-2xl">
            <Chessboard
              position={currentFen}
              boardOrientation={boardOrientation}
              boardWidth={600}
              arePiecesDraggable={false}
              promotionDialogVariant="modal" 
            />
          </div>

          <div className="grid grid-cols-4 gap-2 mt-4 w-full max-w-150">
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
          </div>
        </div>

        <div className="bg-zinc-900 rounded-xl p-5 -mr-15 max-h-167.5 overflow-y-auto border border-zinc-800 flex flex-col gap-4">
          <div className="bg-linear-to-r from-zinc-900 to-zinc-950 flex items-center justify-center rounded-md p-2">
            <button
              onClick={() =>
                setBoardOrientation((prev) =>
                  prev === "white" ? "black" : "white"
                )
              }
              className="bg-zinc-800 hover:bg-zinc-700 p-4 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-110 cursor-pointer -rotate-90 text-white"
            >
              <Repeat />
            </button>
          </div>
          
          <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800/80 shadow-inner">
            <p className="text-zinc-400 font-medium text-sm mb-1">Move Profile Tracker</p>
            <div className="grid grid-cols-2 gap-2 text-sm font-mono mt-2">
              <div className="bg-zinc-900/50 p-2 rounded">Move: <span className="text-zinc-200 font-bold ml-1">#{currentIndex + 1}</span></div>
              <div className="bg-zinc-900/50 p-2 rounded">Played: <span className="text-blue-400 font-bold ml-1">{currentReview?.playedMove || "-"}</span></div>
              <div className="bg-zinc-900/50 p-2 rounded">Best Rec: <span className="text-emerald-400 font-bold ml-1">{currentReview?.bestMove || "-"}</span></div>
              <div className="bg-zinc-900/50 p-2 rounded">Evaluation: <span className="text-amber-400 font-bold ml-1">{currentReview?.evaluation || "0.00"}</span></div>
            </div>
          </div>

          {isReviewing ? (
            <div className="text-center text-zinc-400 py-10">Running full game review analysis...</div>
          ) : reviewResults.length === 0 ? (
            <div className="text-center text-zinc-500 py-10">
              No review data available.
            </div>
          ) : (
            <div className="space-y-2 w-full">
              {reviewResults.map((move, index) => (
                <div
                  key={index}
                  onClick={() => setCurrentIndex(index)} 
                  className={`border rounded-xl p-4 flex justify-between items-center transition-all cursor-pointer ${
                    index === currentIndex
                      ? "bg-zinc-800 border-zinc-500 shadow-md transform scale-[1.01]"
                      : "bg-zinc-900/40 border-zinc-800/60 hover:bg-zinc-800/40 hover:border-zinc-700"
                  }`}
                >
                  <div>
                    <p className="text-sm text-zinc-500 font-medium">Move {index + 1}</p>
                    <p className="font-mono text-base mt-0.5">
                      Played:{" "}
                      <span className="text-blue-400 font-semibold">{move.playedMove}</span>
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-xs text-zinc-500 font-medium">Best Rec</p>
                    <p className="font-mono text-base text-emerald-400 font-semibold">
                      {move.bestMove}
                    </p>
                    <p className="text-xs text-zinc-400 font-mono mt-0.5">
                      Eval: <span className="text-zinc-200">{move.evaluation}</span>
                    </p>
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