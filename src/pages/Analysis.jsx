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
import useStockfish from "../hooks/useStockfish";

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

  const goToFirst = () => {
    setMoveIndex(0);
  };

  const goToPrevious = () => {
    setMoveIndex((prev) => Math.max(prev - 1, 0));
  };

  const goToNext = () => {
    setMoveIndex((prev) => Math.min(prev + 1, positions.length - 1));
  };

  const goToLast = () => {
    setMoveIndex(positions.length - 1);
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

  const readableBestMove = useMemo(() => {
    if (!bestMove || bestMove.length < 4) return "-";

    try {
      const game = new Chess(positions[moveIndex]);

      const move = game.move({
        from: bestMove.slice(0, 2),
        to: bestMove.slice(2, 4),
        promotion: bestMove[4],
      });

      return move?.san || bestMove;
    } catch {
      return bestMove;
    }
  }, [bestMove, positions, moveIndex]);

  const numericEval =
    typeof evaluation === "string" && evaluation.startsWith("#")
      ? 10
      : Number(evaluation);

  const barHeight = Math.min(Math.max(50 + numericEval * 8, 5), 95);

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8">
      <h1 className="text-3xl text-center font-bold mb-10 -mt-4">
        Analysis Board
      </h1>

      <div className="grid lg:grid-cols-[750px_1fr] gap-10">
        <div className="grid grid-cols-[20px_1fr] space-x-0">
          {/* Eval Bar */}
          <div className="w-5 h-175 bg-zinc-800 rounded-lg overflow-hidden relative">
            <div
              className="absolute bottom-0 w-full bg-white transition-all duration-300"
              style={{
                height: `${barHeight}%`,
              }}
            />

            <div
              className={`${evaluation === 0 ? "hidden" : "absolute inset-0 flex items-center justify-center text-[16px] font-bold rotate-90"} ${
                evaluation > 0 ? "mt-8" : "mb-8"
              }`}
            >
              <span className={evaluation > 0 ? `text-black` : `text-white`}>
                {" "}
                {evaluation > 0 ? "+" : ""}
              </span>
              <span className={evaluation > 0 ? `text-black` : `text-white`}>
                {" "}
                {evaluation}{" "}
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
              <p className="text-2xl font-bold">{evaluation}</p>
            </div>

            <div>
              <h3 className="text-zinc-400 text-sm">Best Move</h3>
              <p className="text-xl font-semibold">{readableBestMove || "--"}</p>
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
                  onClick={() => setMoveIndex(pair.whiteIndex)}
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
                    onClick={() => setMoveIndex(pair.blackIndex)}
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
