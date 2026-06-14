import { Chess } from "chess.js";

let globalWorker = null;

const queue = [];
let isProcessing = false;

function getWorker() {
  if (!globalWorker) {
    globalWorker = new Worker("/stockfish/stockfish-18-lite-single.js");
    globalWorker.postMessage("uci");
  }
  return globalWorker;
}

async function processQueue() {
  if (isProcessing || queue.length === 0) return;
  isProcessing = true;

  const { fen, depth, options, resolve, reject } = queue[0];
  const multiPV = options?.multiPV || 1;

  try {
    const worker = getWorker();
    const chess = new Chess(fen);

    if (chess.isCheckmate()) {
      const losingSide = chess.turn();
      const finalEvaluation = losingSide === "b" ? "M0" : "-M0";
      const result = {
        evaluation: finalEvaluation,
        bestMove: "-",
        bestMoveRaw: "-",
      };
      if (multiPV > 1) result.lines = [];

      resolve(result);
      queue.shift();
      isProcessing = false;
      processQueue();
      return;
    }

    if (chess.isGameOver()) {
      const result = { evaluation: 0, bestMove: "-", bestMoveRaw: "-" };
      if (multiPV > 1) result.lines = [];

      resolve(result);
      queue.shift();
      isProcessing = false;
      processQueue();
      return;
    }

    const sideToMove = chess.turn();

    const pvData = [];

    worker.postMessage(`setoption name MultiPV value ${multiPV}`);

    worker.onmessage = (event) => {
      const line = event.data;
      if (typeof line !== "string") return;

      if (line.includes("info ") && line.includes("multipv")) {
        const mpvMatch = line.match(/multipv (\d+)/);
        if (mpvMatch) {
          const pvIndex = parseInt(mpvMatch[1], 10) - 1;
          if (!pvData[pvIndex]) pvData[pvIndex] = {};

          if (line.includes("score cp")) {
            const match = line.match(/score cp (-?\d+)/);
            if (match) {
              let cp = Number(match[1]) / 100;

              pvData[pvIndex].evaluation = sideToMove === "b" ? -cp : cp;
            }
          }

          if (line.includes("score mate")) {
            const match = line.match(/score mate (-?\d+)/);
            if (match) {
              const mateInMoves = Number(match[1]);
              if (sideToMove === "b") {
                pvData[pvIndex].evaluation =
                  mateInMoves > 0
                    ? `M${-mateInMoves}`
                    : `M${Math.abs(mateInMoves)}`;
              } else {
                pvData[pvIndex].evaluation =
                  mateInMoves > 0
                    ? `M${mateInMoves}`
                    : `-M${Math.abs(mateInMoves)}`;
              }
            }
          }

          const pvMatch = line.match(/pv ([a-h][1-8][a-h][1-8][qrbn]?)/);
          if (pvMatch) {
            pvData[pvIndex].bestMoveRaw = pvMatch[1];
          }
        }
      }

      if (line.startsWith("bestmove")) {
        const rawMove = line.split(" ")[1];

        let bestMoveRaw = rawMove;
        let bestMove = "-";
        let mainEval = pvData[0] ? pvData[0].evaluation : 0;

        if (!rawMove || rawMove === "(none)") {
          if (chess.isCheckmate()) {
            mainEval = sideToMove === "b" ? "-M0" : "M0";
          }
          const result = {
            evaluation: mainEval,
            bestMove: "-",
            bestMoveRaw: "-",
          };
          if (multiPV > 1) result.lines = [];

          resolve(result);
          cleanupAndNext();
          return;
        }

        if (rawMove.length >= 4) {
          try {
            const moveObj = chess.move({
              from: rawMove.slice(0, 2),
              to: rawMove.slice(2, 4),
              promotion: rawMove[4] || undefined,
            });
            if (moveObj) bestMove = moveObj.san;
            chess.undo();
          } catch (e) {
            bestMove = rawMove;
          }
        }

        const formattedLines = pvData.map((data) => {
          let lineSan = "-";
          if (data.bestMoveRaw && data.bestMoveRaw.length >= 4) {
            try {
              const tempMove = chess.move({
                from: data.bestMoveRaw.slice(0, 2),
                to: data.bestMoveRaw.slice(2, 4),
                promotion: data.bestMoveRaw[4] || undefined,
              });
              if (tempMove) lineSan = tempMove.san;
              chess.undo();
            } catch (e) {
              lineSan = data.bestMoveRaw;
            }
          }
          return {
            evaluation: data.evaluation !== undefined ? data.evaluation : 0,
            bestMoveRaw: data.bestMoveRaw || "-",
            bestMove: lineSan,
            move: lineSan,
          };
        });

        const finalPayload = { evaluation: mainEval, bestMove, bestMoveRaw };
        if (multiPV > 1) {
          finalPayload.lines = formattedLines;
        }
        resolve(finalPayload);
        cleanupAndNext();
      }
    };

    function cleanupAndNext() {
      worker.postMessage(`setoption name MultiPV value 1`);
      queue.shift();
      isProcessing = false;
      processQueue();
    }

    worker.postMessage(`position fen ${fen}`);
    worker.postMessage(`go depth ${depth}`);
  } catch (err) {
    reject(err);
    queue.shift();
    isProcessing = false;
    processQueue();
  }
}

export function analyzePosition(fen, depth = 18, options = {}) {
  return new Promise((resolve, reject) => {
    queue.push({ fen, depth, options, resolve, reject });
    processQueue();
  });
}
