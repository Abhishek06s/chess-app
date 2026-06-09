import { Chess } from "chess.js";

export function analyzePosition(fen, depth = 22) {
  return new Promise((resolve, reject) => {
    try {
      const worker = new Worker("/stockfish/stockfish-18-lite-single.js");

      const chess = new Chess(fen);

      if (chess.isGameOver()) {
        resolve({
          evaluation: 0,
          bestMove: "-",
        });

        worker.terminate();
        return;
      }

      const sideToMove = chess.turn();

      let evaluation = 0;
      let bestMove = "-";

      worker.onmessage = (event) => {
        const line = event.data;

        if (typeof line !== "string") {
          return;
        }

        if (line.includes("score cp") && line.includes("multipv 1")) {
          const match = line.match(/score cp (-?\d+)/);

          if (match) {
            let cp = Number(match[1]) / 100;

            if (sideToMove === "b") {
              cp *= -1;
            }

            evaluation = cp;
          }
        }

        if (line.includes("score mate") && line.includes("multipv 1")) {
          evaluation = 9999;
        }

        if (line.startsWith("bestmove")) {
          const rawMove = line.split(" ")[1];

          if (rawMove && rawMove !== "(none)" && rawMove.length >= 4) {
            try {
              const moveObj = chess.move({
                from: rawMove.slice(0, 2),
                to: rawMove.slice(2, 4),
                promotion: rawMove[4] || undefined,
              });

              if (moveObj) {
                bestMove = moveObj.san;
              }
            } catch {}
          }

          worker.terminate();

          resolve({
            evaluation,
            bestMove,
          });
        }
      };

      worker.postMessage("uci");
      worker.postMessage(`position fen ${fen}`);
      worker.postMessage(`go depth ${depth}`);
    } 
    catch (err) {
      reject(err);
    }
  });
}
