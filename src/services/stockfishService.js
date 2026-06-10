import { Chess } from "chess.js";

let globalWorker = null;

function getWorker() {
  if (!globalWorker) {
    globalWorker = new Worker("/stockfish/stockfish-18-lite-single.js");
    globalWorker.postMessage("uci");
  }
  return globalWorker;
}

export function analyzePosition(fen, depth = 18) {
  return new Promise((resolve, reject) => {
    try {
      const worker = getWorker();
      const chess = new Chess(fen);

      if (chess.isCheckmate()) {
        const losingSide = chess.turn();
        const finalEvaluation = losingSide === "b" ? "M0" : "-M0";
        return resolve({ evaluation: finalEvaluation, bestMove: "-", bestMoveRaw: "-" });
      }

      if (chess.isGameOver()) {
        return resolve({ evaluation: 0, bestMove: "-", bestMoveRaw: "-" });
      }

      const sideToMove = chess.turn(); 
      let evaluation = 0; 
      let bestMove = "-";
      let bestMoveRaw = "-";

      worker.onmessage = (event) => {
        const line = event.data;
        if (typeof line !== "string") return;

        if (line.includes("score cp") && line.includes("multipv 1")) {
          const match = line.match(/score cp (-?\d+)/);
          if (match) {
            let cp = Number(match[1]) / 100;
            if (sideToMove === "b") {
              evaluation = -cp;
            } else {
              evaluation = cp;
            }
          }
        }

        if (line.includes("score mate") && line.includes("multipv 1")) {
          const match = line.match(/score mate (-?\d+)/);
          if (match) {
            const mateInMoves = Number(match[1]);
            if (sideToMove === "b") {
              evaluation = mateInMoves > 0 ? `M${-mateInMoves}` : `M${Math.abs(mateInMoves)}`;
            } else {
              evaluation = mateInMoves > 0 ? `M${mateInMoves}` : `-M${Math.abs(mateInMoves)}`;
            }
          }
        }

        if (line.startsWith("bestmove")) {
          const rawMove = line.split(" ")[1];
          bestMoveRaw = rawMove;

          if (!rawMove || rawMove === "(none)") {
            if (chess.isCheckmate()) {
              evaluation = sideToMove === "b" ? "-M0" : "M0";
            }
            return resolve({ evaluation, bestMove: "-", bestMoveRaw: "-" });
          }

          if (rawMove.length >= 4) {
            try {
              const moveObj = chess.move({
                from: rawMove.slice(0, 2),
                to: rawMove.slice(2, 4),
                promotion: rawMove[4] || undefined,
              });
              if (moveObj) bestMove = moveObj.san;
            } catch (e) {
              bestMove = rawMove;
            }
          }
          resolve({ evaluation, bestMove, bestMoveRaw });
        }
      };

      worker.postMessage(`position fen ${fen}`);
      worker.postMessage(`go depth ${depth}`);
    } catch (err) {
      reject(err);
    }
  });
}