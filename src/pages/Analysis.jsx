import { useLocation } from "react-router-dom";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { useEffect, useState, useRef } from "react";

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "react-feather";

import openings from "../data/openings";
import useChessSounds from "../hooks/useChessSounds";
import useStockfish from "../hooks/useStockfish";
import { buildMoveTree, MoveNode } from "../utils/moveTree";

const Analysis = () => {
  const { state } = useLocation();

  const [rootNode, setRootNode] = useState(null);
  const [currentNode, setCurrentNode] = useState(null);
  const [openingInfo, setOpeningInfo] = useState(null);

  const { playMoveSound, playCaptureSound, playCheckSound, playGameEndSound } =
    useChessSounds();

  useEffect(() => {
    if (!state?.pgn) return;
    const root = buildMoveTree(state.pgn);
    setRootNode(root);
    setCurrentNode(root);
  }, [state]);

  const currentFen =
    currentNode?.fen ||
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

  useEffect(() => {
    const opening = openings[currentFen];
    setOpeningInfo(opening || null);
  }, [currentFen]);

  const triggerMoveSound = (targetNode) => {
    if (!targetNode || !targetNode.parent) return;

    try {
      const prevGame = new Chess(targetNode.parent.fen);
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

  // --- Tree Navigation Controls ---
  const goToFirst = () => {
    if (rootNode) setCurrentNode(rootNode);
  };

  const goToParent = () => {
    if (currentNode?.parent) {
      setCurrentNode(currentNode.parent);
    }
  };

  const goToMainChild = () => {
    if (currentNode?.children?.length) {
      const nextNode = currentNode.children[0];
      setCurrentNode(nextNode);
      triggerMoveSound(nextNode);
    }
  };

  const goToLast = () => {
    let curr = currentNode;
    if (!curr) return;

    while (curr.children && curr.children.length > 0) {
      curr = curr.children[0];
    }

    if (curr !== currentNode) {
      setCurrentNode(curr);
      triggerMoveSound(curr);
    }
  };

  // --- Handling User Moves / Variations ---
  const createVariation = (
    sourceSquare,
    targetSquare,
    promotionPiece = "q",
    isFromDialog = false,
  ) => {
    if (!currentNode) return false;

    const gameForCheck = new Chess(currentFen);
    const pieceOnSource = gameForCheck.get(sourceSquare);
    const isPawn = pieceOnSource && pieceOnSource.type === "p";
    const isPromotionRank = targetSquare[1] === "8" || targetSquare[1] === "1";

    if (isPawn && isPromotionRank && !isFromDialog) {
      return true;
    }

    const game = new Chess(currentFen);

    try {
      const move = game.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: promotionPiece,
      });

      if (!move) return false;

      const existingChild = currentNode.children.find(
        (child) => child.san === move.san,
      );

      if (existingChild) {
        setCurrentNode(existingChild);
        triggerMoveSound(existingChild);
        return true;
      }

      const variationNode = new MoveNode({
        id: crypto.randomUUID(),
        fen: game.fen(),
        san: move.san,
        move,
        parent: currentNode,
      });

      currentNode.children.push(variationNode);
      setCurrentNode(variationNode);
      triggerMoveSound(variationNode);

      return true;
    } catch (e) {
      console.error("Validation blocked:", e);
      return false;
    }
  };

  const onPieceDrop = (sourceSquare, targetSquare) => {
    return createVariation(sourceSquare, targetSquare, "q", false);
  };

  const handlePromotionSelect = (piece, promoteFromSquare, promoteToSquare) => {
    if (!piece) return false;
    const promotionPieceLetter = piece[1].toLowerCase();

    return createVariation(
      promoteFromSquare,
      promoteToSquare,
      promotionPieceLetter,
      true,
    );
  };

  const getCustomSquareStyles = () => {
    if (!currentNode || !currentNode.move) return {};
    const { from, to } = currentNode.move;
    return {
      [from]: { backgroundColor: "rgba(255, 255, 0, 0.4)" },
      [to]: { backgroundColor: "rgba(255, 255, 0, 0.4)" },
    };
  };

  const getPathFromRoot = () => {
    const path = [];
    let curr = currentNode;
    while (curr && curr.parent) {
      path.unshift(curr);
      curr = curr.parent;
    }
    return path;
  };

  const currentPath = getPathFromRoot();

  const movePairs = [];
  for (let i = 0; i < currentPath.length; i += 2) {
    movePairs.push({
      whiteNode: currentPath[i],
      blackNode: currentPath[i + 1] || null,
      moveNumber: Math.floor(i / 2) + 1,
    });
  }

  const { evaluation, bestMove, depth, topLines } = useStockfish(currentFen);

  const isMate =
    typeof evaluation === "string" &&
    (evaluation.includes("M") || evaluation.includes("#"));
  const numericEval = isMate ? 0 : Number(evaluation || 0);

  const barHeight = isMate
    ? evaluation.includes("-")
      ? 0
      : 100
    : Math.min(Math.max(50 + numericEval * 8, 5), 95);

  const movesContainerRef = useRef(null);
  useEffect(() => {
    if (movesContainerRef.current) {
      movesContainerRef.current.scrollTop =
        movesContainerRef.current.scrollHeight;
    }
  }, [currentFen]);
  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8">
      <h1 className="text-3xl text-center font-bold mb-10 -mt-4">
        Analysis Board
      </h1>

      <div className="grid lg:grid-cols-[700px_1fr] gap-10 max-w-7xl mx-auto">
        <div className="grid grid-cols-[30px_1fr] gap-4">
          <div className="w-6 h-[600px] bg-zinc-800 rounded-lg overflow-hidden relative flex flex-col justify-between border border-zinc-700">
            <div
              className="absolute bottom-0 w-full bg-white transition-all duration-300"
              style={{ height: `${barHeight}%` }}
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span
                className={`text-[11px] font-black uppercase tracking-wider rotate-90 whitespace-nowrap 
                  ${barHeight === 50 ? "hidden" : ""}
                  ${barHeight > 50 ? "text-black mt-10" : "text-white mb-10"}`}
              >
                {evaluation || "0.0"}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-center">
            <div className="w-[600px] rounded-sm overflow-hidden shadow-2xl">
              <Chessboard
                position={currentFen}
                arePiecesDraggable={true}
                animationDuration={200}
                boardWidth={600}
                customSquareStyles={getCustomSquareStyles()}
                onPieceDrop={onPieceDrop}
                onPromotionPieceSelect={handlePromotionSelect}
                showPromotionDialog={true}
              />
            </div>

            <div className="grid grid-cols-4 gap-2 mt-4 w-full max-w-[600px]">
              <button
                onClick={goToFirst}
                className="bg-zinc-800 hover:bg-zinc-700 p-3 rounded-lg flex justify-center transition-colors cursor-pointer"
              >
                <ChevronsLeft size={24} />
              </button>
              <button
                onClick={goToParent}
                className="bg-zinc-800 hover:bg-zinc-700 p-3 rounded-lg flex justify-center transition-colors cursor-pointer"
              >
                <ChevronLeft size={24} />
              </button>
              <button
                onClick={goToMainChild}
                className="bg-zinc-800 hover:bg-zinc-700 p-3 rounded-lg flex justify-center transition-colors cursor-pointer"
              >
                <ChevronRight size={24} />
              </button>
              <button
                onClick={goToLast}
                className="bg-zinc-800 hover:bg-zinc-700 p-3 rounded-lg flex justify-center transition-colors cursor-pointer"
              >
                <ChevronsRight size={24} />
              </button>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900 rounded-xl p-5 max-h-[670px] overflow-y-auto border border-zinc-800 flex flex-col gap-4">
          <h2 className="text-xl text-center font-bold tracking-wide">
            Move List
          </h2>

          {openingInfo && (
            <div className="bg-zinc-950/60 border border-emerald-900/40 rounded-xl p-4">
              <h2 className="text-lg font-bold text-emerald-400">
                {openingInfo.name}
              </h2>
              <p className="text-xs text-zinc-400 font-mono mt-0.5">
                ECO: {openingInfo.eco}
              </p>
            </div>
          )}

          <div className="bg-zinc-950/40 border border-zinc-800 flex justify-between items-center rounded-xl p-4">
            <div>
              <h3 className="text-zinc-500 text-xs uppercase tracking-wider font-semibold">
                Evaluation
              </h3>
              <p className="text-xl font-bold mt-1 font-mono text-zinc-200">
                {evaluation || "0.0"}
              </p>
            </div>
            <div>
              <h3 className="text-zinc-500 text-xs uppercase tracking-wider font-semibold">
                Best Move
              </h3>
              <p className="text-xl font-mono font-bold mt-1 text-blue-400">
                {bestMove || "--"}
              </p>
            </div>
            <div>
              <h3 className="text-zinc-500 text-xs uppercase tracking-wider font-semibold">
                Depth
              </h3>
              <p className="text-sm font-mono font-bold text-zinc-400 mt-1">
                {depth || "0"}
              </p>
            </div>
          </div>

          <div className="bg-zinc-950/20 border border-zinc-800/80 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-zinc-400 text-xs font-bold tracking-wider uppercase">
                Top Engine Variations
              </h3>
              <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded font-mono">
                Multi-PV
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {topLines.length === 0 ? (
                <p className="text-xs text-zinc-500 italic">Thinking...</p>
              ) : (
                topLines.map((line, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 bg-zinc-950/70 p-2 rounded-lg border border-zinc-800/60"
                  >
                    <span className="text-xs font-bold text-zinc-600 w-4">
                      #{index + 1}
                    </span>
                    <span
                      className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded min-w-[50px] text-center ${
                        line.eval.includes("-")
                          ? "bg-red-950/30 text-red-400"
                          : "bg-emerald-950/30 text-emerald-400"
                      }`}
                    >
                      {line.eval}
                    </span>
                    <p className="text-xs font-mono text-zinc-400 truncate flex-1">
                      {line.continuation || "..."}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div
            className="space-y-1.5 overflow-y-auto flex-1 max-h-[250px] pr-1"
            ref={movesContainerRef}
          >
            {movePairs.map((pair, index) => (
              <div
                key={index}
                className="bg-zinc-950/40 px-3 py-1.5 rounded-md flex items-center text-sm border border-zinc-800/30"
              >
                <span className="w-9 text-zinc-600 font-mono text-xs">
                  {pair.moveNumber}.
                </span>

                <button
                  onClick={() => {
                    setCurrentNode(pair.whiteNode);
                    triggerMoveSound(pair.whiteNode);
                  }}
                  className={`flex-1 text-left px-2 py-1 rounded font-mono transition-colors ${
                    currentNode?.id === pair.whiteNode.id
                      ? "bg-blue-600 text-white font-bold"
                      : "hover:bg-zinc-800 text-zinc-300"
                  }`}
                >
                  {pair.whiteNode.san}
                </button>

                {pair.blackNode ? (
                  <button
                    onClick={() => {
                      setCurrentNode(pair.blackNode);
                      triggerMoveSound(pair.blackNode);
                    }}
                    className={`flex-1 text-left px-2 py-1 rounded font-mono transition-colors ${
                      currentNode?.id === pair.blackNode.id
                        ? "bg-blue-600 text-white font-bold"
                        : "hover:bg-zinc-800 text-zinc-300"
                    }`}
                  >
                    {pair.blackNode.san}
                  </button>
                ) : (
                  <span className="flex-1"></span>
                )}
              </div>
            ))}
          </div>

          {currentNode?.parent && currentNode.parent.children.length > 1 && (
            <div className="bg-zinc-950/60 p-3 rounded-xl border border-zinc-800">
              <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">
                Alternative Branches
              </h3>
              <div className="flex gap-2 flex-wrap">
                {currentNode.parent.children.map((variation) => (
                  <button
                    key={variation.id}
                    onClick={() => {
                      setCurrentNode(variation);
                      triggerMoveSound(variation);
                    }}
                    className={`px-2.5 py-1 text-xs font-mono rounded transition-colors ${
                      variation.id === currentNode.id
                        ? "bg-blue-600 font-bold text-white"
                        : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                    }`}
                  >
                    {variation.san}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Analysis;
