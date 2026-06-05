import { useLocation } from "react-router-dom";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { useEffect, useState, useMemo } from "react";

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "react-feather";

import openings from "../data/openings";
import useChessSounds from "../hooks/useChessSounds";
import useStockfish from "../hooks/useStockfish";
import { delay } from "framer-motion";

const Analysis = () => {
  const { state } = useLocation();

  const [positions, setPositions] = useState([]);
  const [moveIndex, setMoveIndex] = useState(0);
  const [moveHistory, setMoveHistory] = useState([]);
  const [openingInfo, setOpeningInfo] = useState(null);

  const buildPositions = (pgn) => {
    const game = new Chess();
    game.loadPgn(pgn);
    const history = game.history();
    const tempGame = new Chess();
    const allPositions = [tempGame.fen()];

    history.forEach((move) => {
      tempGame.move(move);
      allPositions.push(tempGame.fen());
    });

    return {
      positions: allPositions,
      history,
    };
  };

  useEffect(() => {
    if (!state?.pgn) return;

    const { positions, history } = buildPositions(state.pgn);

    setPositions(positions);
    setMoveHistory(history);

    setMoveIndex(positions.length - 1);
  }, [state]);

  useEffect(() => {
    if (!positions.length) return;

    const currentFen = positions[moveIndex];
    const opening = openings[currentFen];

    if (opening) {
      setOpeningInfo(opening);
    }
  }, [moveIndex, positions]);

  // Initialize your custom chess sounds hook
  const { playMoveSound, playCaptureSound, playCheckSound, playGameEndSound } =
    useChessSounds();

  // 1. DYNAMIC SOUND TRIGGERING LOGIC
  // This plays the exact correct sound whenever you change moves!
  const triggerMoveSound = (targetIndex) => {
    if (targetIndex === 0 || !positions.length) return;

    try {
      const prevGame = new Chess(positions[targetIndex - 1]);
      // Replay the move to inspect its properties (check, capture, etc.)
      const moveResult = prevGame.move(moveHistory[targetIndex - 1]);

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

  const goToFirst = () => {
    setMoveIndex(0);
  };

  const goToPrevious = () => {
    setMoveIndex((prev) => {
      const nextIndex = Math.max(prev - 1, 0);
      if (nextIndex !== prev) triggerMoveSound(nextIndex);
      return nextIndex;
    });
  };

  const goToNext = () => {
    setMoveIndex((prev) => {
      const nextIndex = Math.min(prev + 1, positions.length - 1);
      if (nextIndex !== prev) triggerMoveSound(nextIndex);
      return nextIndex;
    });
  };

  const goToLast = () => {
    const lastIndex = positions.length - 1;
    setMoveIndex((prev) => {
      if (prev !== lastIndex) triggerMoveSound(lastIndex);
      return lastIndex;
    });
  };

  const getCustomSquareStyles = () => {
    if (moveIndex === 0 || !positions.length) return {};

    try {
      const tempGame = new Chess(positions[moveIndex - 1]);
      const moveData = tempGame.move(moveHistory[moveIndex - 1]);

      if (moveData) {
        return {
          [moveData.from]: { backgroundColor: "rgba(255, 255, 0, 0.4)" },
          [moveData.to]: { backgroundColor: "rgba(255, 255, 0, 0.4)" },
        };
      }
    } catch (e) {
      return {};
    }
    return {};
  };

  const movePairs = [];

  for (let i = 0; i < moveHistory.length; i += 2) {
    movePairs.push({
      white: moveHistory[i],
      black: moveHistory[i + 1] || "",
      whiteIndex: i + 1,
      blackIndex: i + 2,
    });
  }

  const currentFen = positions.length > 0 ? positions[moveIndex] : null;

  const { evaluation, bestMove, depth } = useStockfish(currentFen);

  const isMate =
    typeof evaluation === "string" &&
    (evaluation.includes("M") || evaluation.includes("#"));

  const isWhiteWinningMate = isMate
    ? evaluation.includes("M0")
      ? moveIndex % 2 !== 0
      : evaluation.startsWith("+")
    : false;

  const numericEval = isMate ? 0 : Number(evaluation);

  const barHeight = isMate
    ? isWhiteWinningMate
      ? 100
      : 0
    : Math.min(Math.max(50 + numericEval * 8, 5), 95);

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8">
      <h1 className="text-3xl text-center font-bold mb-10 -mt-4">
        Analysis Board
      </h1>

      <div className="grid lg:grid-cols-[750px_1fr] gap-10">
        <div className="grid grid-cols-[20px_1fr] space-x-0">
          <div className="w-5 h-175 bg-zinc-800 rounded-lg overflow-hidden relative flex flex-col justify-between">
            <div
              className="absolute bottom-0 w-full bg-white transition-all duration-300"
              style={{
                height: `${barHeight}%`,
              }}
            />

            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span
                className={`text-[13px] font-black uppercase tracking-wider rotate-90 whitespace-nowrap ${
                  barHeight > 50 ? "text-black mt-8" : "text-white mb-8"
                }`}
              >
                {evaluation}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-center">
            <div className="w-full max-w-175 rounded-xs">
              <Chessboard
                position={
                  positions.length > 0 ? positions[moveIndex] : undefined
                }
                arePiecesDraggable={false}
                animationDuration={250}
                boardWidth={700}
              />
            </div>

            <div className="grid grid-cols-4 gap-2 mt-4 w-full max-w-175">
              <button
                onClick={goToFirst}
                className="bg-zinc-800 hover:bg-zinc-700 p-3 rounded-lg flex justify-center cursor-pointer"
              >
                <ChevronsLeft size={32} />
              </button>

              <button
                onClick={goToPrevious}
                className="bg-zinc-800 hover:bg-zinc-700 p-3 rounded-lg flex justify-center cursor-pointer"
              >
                <ChevronLeft size={32} />
              </button>

              <button
                onClick={goToNext}
                className="bg-zinc-800 hover:bg-zinc-700 p-3 rounded-lg flex justify-center cursor-pointer"
              >
                <ChevronRight size={32} />
              </button>

              <button
                onClick={goToLast}
                className="bg-zinc-800 hover:bg-zinc-700 p-3 rounded-lg flex justify-center cursor-pointer"
              >
                <ChevronsRight size={32} />
              </button>
            </div>

            <p className="mt-4 text-zinc-400">
              Move {moveIndex} / {Math.max(positions.length - 1, 0)}
            </p>
          </div>
        </div>

        <div className="bg-zinc-900 rounded-xl p-4 max-h-200 overflow-y-auto">
          <h2 className="text-2xl text-center font-bold mt-4 mb-4">
            Move List
          </h2>
          {openingInfo && (
            <div className="w-full max-w-175 mb-4 bg-zinc-900 rounded-xl p-4">
              <h2 className="text-xl font-bold text-green-400">
                {openingInfo.name}
              </h2>

              <p className="text-zinc-400">ECO: {openingInfo.eco}</p>
            </div>
          )}
          <div className="bg-zinc-800 flex gap-20 items-center rounded-xl p-4 mb-8">
            <div>
              <h3 className="text-zinc-400 text-sm">Engine Evaluation</h3>
              <p className="text-2xl font-bold">
                {typeof evaluation === "string" && evaluation.includes("M0")
                  ? isWhiteWinningMate
                    ? "1-0 (Mate)"
                    : "0-1 (Mate)"
                  : evaluation}
              </p>
            </div>

            <div>
              <h3 className="text-zinc-400 text-sm">Best Move</h3>
              <p className="text-xl font-semibold">{bestMove || "--"}</p>
            </div>

            <div>
              {" "}
              <p className="text-zinc-400 text-sm mt-2">Depth: {depth}</p>
            </div>
          </div>

          <div className="space-y-2">
            {movePairs.map((pair, index) => (
              <div
                key={index}
                className="bg-zinc-800 px-3 py-2 rounded-lg flex items-center"
              >
                <span className="w-10 text-zinc-500">{index + 1}.</span>

                <button
                  onClick={() => {
                    setMoveIndex(pair.whiteIndex - 1);
                    delay(() => {
                      setMoveIndex(pair.whiteIndex);
                      triggerMoveSound(pair.whiteIndex);
                    }, 300);
                  }}
                  className={`flex-1 text-left px-2 py-1 rounded cursor-pointer ${
                    moveIndex === pair.whiteIndex
                      ? "bg-blue-600"
                      : "hover:bg-zinc-700"
                  }`}
                >
                  {pair.white}
                </button>

                {pair.black && (
                  <button
                    onClick={() => {
                      setMoveIndex(pair.blackIndex - 1);
                      delay(() => {
                        setMoveIndex(pair.blackIndex);
                        triggerMoveSound(pair.blackIndex);
                      }, 300);
                    }}
                    className={`flex-1 text-left px-2 py-1 rounded cursor-pointer ${
                      moveIndex === pair.blackIndex
                        ? "bg-blue-600"
                        : "hover:bg-zinc-700"
                    }`}
                  >
                    {pair.black}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analysis;
