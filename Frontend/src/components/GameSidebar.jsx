import { Chess } from "chess.js";
import { useEffect, useRef, useState } from "react";
import { ZoomIn } from "react-feather";
import { toast } from "react-hot-toast";
import { useNavigate } from "react-router-dom";

const GameSidebar = ({
  moves,
  game,
  setGame,
  setMoves,
  flipBoard,
  resetClock,
  setGameStarted,
  whiteFlagged,
  blackFlagged,
  resetCapturedPieces,
}) => {
  const navigate = useNavigate();

  const openAnalysis = () => {
    const tempGame = new Chess();

    moves.forEach((move) => {
      tempGame.move(move);
    });

    navigate("/analysis", {
      state: {
        moves,
        pgn: tempGame.pgn(),
        fen: tempGame.fen(),
      },
    });
  };

  const [showShareMenu, setShowShareMenu] = useState(false);
  const copyPGN = async () => {
    const tempGame = new Chess();

    moves.forEach((move) => {
      tempGame.move(move);
    });

    await navigator.clipboard.writeText(tempGame.pgn());
    toast.success("PGN copied to clipboard!");
    setShowShareMenu(false);
  };

  const copyFEN = async () => {
    const tempGame = new Chess();

    moves.forEach((move) => {
      tempGame.move(move);
    });

    await navigator.clipboard.writeText(tempGame.fen());
    toast.success("FEN copied to clipboard!");
    setShowShareMenu(false);
  };

  const movesContainerRef = useRef(null);
  useEffect(() => {
    if (movesContainerRef.current) {
      movesContainerRef.current.scrollTop =
        movesContainerRef.current.scrollHeight;
    }
  }, [moves]);

  let statusText = "Game in Progress";
  let statusClass = "text-green-400 mt-3 text-md";

  if (whiteFlagged) {
    statusText = "Black wins on time!";
    statusClass = "text-red-400 mt-3 text-md";
  } else if (blackFlagged) {
    statusText = "White wins on time!";
    statusClass = "text-red-400 mt-3 text-md";
  }

  if (game.isCheckmate()) {
    statusText = "Checkmate!";
    statusClass = "text-red-400 mt-3 text-md";
  } else if (game.isCheck()) {
    statusText = "Check!";
    statusClass = "text-yellow-400 mt-3 text-md";
  } else if (game.isDraw()) {
    if (game.isStalemate()) {
      statusText = "Stalemate!";
      statusClass = "text-blue-400 mt-3 text-md";
    } else if (game.isInsufficientMaterial()) {
      statusText = "Draw by Insufficient Material!";
      statusClass = "text-blue-400 mt-3 text-md";
    } else if (game.isDraw()) {
      statusText = "Draw!";
      statusClass = "text-blue-400 mt-3 text-md";
    }
  }

  function resetGame() {
    setGame(new Chess());
    setMoves([]);
    resetClock();
    resetCapturedPieces();
    setGameStarted(true);
  }

  const movePairs = [];

  for (let i = 0; i < moves.length; i += 2) {
    movePairs.push({
      white: moves[i],
      black: moves[i + 1] || "",
    });
  }

  return (
    <div className="bg-zinc-900 rounded-2xl p-6 h-fit">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold mb-4">Game Information</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={openAnalysis}
            className="bg-zinc-700 hover:bg-zinc-600 p-3 rounded-lg transition"
          >
            <ZoomIn size={24} className="cursor-pointer" />
          </button>
          <div className="relative">
            <button
              onClick={() => setShowShareMenu(!showShareMenu)}
              className="w-full py-3 px-4 rounded-xl cursor-pointer bg-purple-600 hover:bg-purple-500 transition"
            >
              📤 Share Game
            </button>

            {showShareMenu && (
              <div className="absolute mt-2 w-full bg-zinc-800 rounded-xl shadow-lg overflow-hidden z-10">
                <button
                  onClick={copyPGN}
                  className="w-full text-left px-4 py-3 hover:bg-zinc-700 cursor-pointer"
                >
                  📋 Copy PGN
                </button>

                <button
                  onClick={copyFEN}
                  className="w-full text-left px-4 py-3 hover:bg-zinc-700 cursor-pointer"
                >
                  📋 Copy FEN
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div>
        <button
          onClick={resetGame}
          className="w-full mb-6 py-3 rounded-xl cursor-pointer bg-green-600 hover:bg-green-500 transition"
        >
          New Game
        </button>

        <div className="bg-zinc-800 rounded-xl p-4 mb-6 flex justify-between">
          <button
            onClick={() => {
              flipBoard();
            }}
            className="w-25 bg-blue-600 hover:bg-blue-500 py-3 rounded-xl mb-2 cursor-pointer"
          >
            Flip Board
          </button>

          <div>
            <h3 className="text-sm text-zinc-300 mb-2">Current Turn</h3>

            <div className="flex items-center gap-3">
              <div
                className={`w-4 h-4 rounded-full ${
                  game.turn() === "w"
                    ? "bg-white"
                    : "bg-black border border-zinc-400"
                }`}
              />

              <span className="font-semibold ">
                {game.turn() === "w" ? "White to Move" : "Black to Move"}
              </span>
            </div>
          </div>

          <div className={`${statusClass}`}>{statusText}</div>
        </div>
      </div>

      <h3 className="font-semibold mb-4">Move History</h3>

      <div
        ref={movesContainerRef}
        className="max-h-125 overflow-y-auto space-y-2"
      >
        {moves.length === 0 ? (
          <p className="text-zinc-400">No moves yet</p>
        ) : (
          movePairs.map((pair, index) => (
            <div
              key={index}
              className="bg-zinc-800 px-3 py-2 rounded-lg flex justify-between font-mono w-full"
            >
              <span className="text-zinc-500 w-8">{index + 1}.</span>
              <span className="flex-1 text-left text-zinc-200">
                {pair.white}
              </span>
              <span className="flex-1 text-left text-zinc-300">
                {pair.black}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default GameSidebar;
