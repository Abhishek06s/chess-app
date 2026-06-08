import { useEffect, useRef, useState } from "react";
import { Chess } from "chess.js";

const useStockfish = (fen) => {
  const workerRef = useRef(null);

  const [evaluation, setEvaluation] = useState("0.00");
  const [bestMove, setBestMove] = useState("");
  const [depth, setDepth] = useState(0);
  const [topLines, setTopLines] = useState([]);

  useEffect(() => {
    if (
      !fen ||
      typeof fen !== "string" ||
      fen.trim() === "" ||
      fen.split(" ").length < 2
    ) {
      setEvaluation("0.00");
      setBestMove("-");
      setDepth(0);
      setTopLines([]);
      return;
    }

    try {
      const chessInstance = new Chess(fen);
      if (chessInstance.isGameOver()) {
        if (chessInstance.isCheckmate()) {
          setEvaluation(chessInstance.turn() === "b" ? "1-0" : "0-1");
        } else {
          setEvaluation("1/2-1/2"); 
        }
        setBestMove("-");
        setDepth(0);
        setTopLines([]);

        if (workerRef.current) {
          workerRef.current.terminate();
          workerRef.current = null;
        }
        return;
      }
    } catch (e) {
      console.error("Game Over validation check failed:", e);
    }

    setBestMove("-"); 
    setTopLines([]);
    setDepth(0);

    if (workerRef.current) {
      workerRef.current.terminate();
    }

    const worker = new Worker("/stockfish/stockfish-18-lite-single.js");
    workerRef.current = worker;

    const fenParts = fen.split(" ");
    const sideToMove = fenParts[1] || "w";

    let linesCache = [];

    worker.onmessage = (event) => {
      const line = event.data;
      if (typeof line !== "string") return;

      if (line.includes(" depth ")) {
        const depthMatch = line.match(/\bdepth (\d+)\b/);
        if (depthMatch) {
          setDepth(Number(depthMatch[1]));
        }
      }

      if (line.includes("score cp") && line.includes("multipv 1 ")) {
        const match = line.match(/score cp (-?\d+)/);
        if (match) {
          let cpValue = Number(match[1]);
          if (sideToMove === "b") cpValue = -cpValue;
          setEvaluation((cpValue / 100).toFixed(2));
        }
      }

      if (line.includes("score mate") && line.includes("multipv 1 ")) {
        const match = line.match(/score mate (-?\d+)/);
        if (match) {
          let mateValue = Number(match[1]);
          if (sideToMove === "b") mateValue = -mateValue;

          if (mateValue === 0) {
            setEvaluation(sideToMove === "b" ? "1-0" : "0-1");
          } else {
            const prefix = mateValue > 0 ? "+" : "-";
            setEvaluation(`${prefix}M${Math.abs(mateValue)}`);
          }
        }
      }

      if (line.includes(" depth ") && line.includes(" multipv ")) {
        const pvIdxMatch = line.match(/multipv (\d+)/);
        const pvMovesMatch = line.match(/ pv (.+)/);

        if (pvIdxMatch && pvMovesMatch) {
          const idx = parseInt(pvIdxMatch[1], 10) - 1;
          const rawMoves = pvMovesMatch[1].split(" ");

          try {
            const cleanGame = new Chess(fen);
            const readableMoves = [];
            const movesToParse = Math.min(rawMoves.length, 4);

            for (let i = 0; i < movesToParse; i++) {
              const m = rawMoves[i];
              if (!m || m.length < 4) continue;
              const moveObj = cleanGame.move({
                from: m.slice(0, 2),
                to: m.slice(2, 4),
                promotion: m[4] || undefined,
              });
              if (moveObj) readableMoves.push(moveObj.san);
            }

            let lineEval = "0.00";
            if (line.includes("score cp")) {
              const cpMatch = line.match(/score cp (-?\d+)/);
              if (cpMatch) {
                let val = Number(cpMatch[1]) / 100;
                if (sideToMove === "b") val = -val;
                lineEval = val > 0 ? `+${val.toFixed(2)}` : val.toFixed(2);
              }
            } else if (line.includes("score mate")) {
              const mateMatch = line.match(/score mate (-?\d+)/);
              if (mateMatch) {
                let val = Number(mateMatch[1]);
                if (sideToMove === "b") val = -val;
                lineEval =
                  val > 0 ? `+M${Math.abs(val)}` : `-M${Math.abs(val)}`;
              }
            }

            linesCache[idx] = {
              eval: lineEval,
              continuation: readableMoves.length > 0 ? readableMoves.join(" ") : "Game Over",
            };

            setTopLines([...linesCache].filter(Boolean).slice(0, 3));
          } catch (e) {}
        }
      }

      if (
        line.includes(" depth ") &&
        line.includes(" pv ") &&
        line.includes("multipv 1 ")
      ) {
        const pvMatch = line.match(/ pv\s+([a-h][1-8][a-h][1-8][qrbn]?)/);
        if (pvMatch && pvMatch[1]) {
          const rawMove = pvMatch[1];
          try {
            const cleanGame = new Chess(fen);
            const moveObj = cleanGame.move({
              from: rawMove.slice(0, 2),
              to: rawMove.slice(2, 4),
              promotion: rawMove[4] || undefined,
            });
            if (moveObj) setBestMove(moveObj.san);
          } catch (e) {}
        }
      }

      if (line.startsWith("bestmove")) {
        const rawMove = line.split(" ")[1];
        if (rawMove && rawMove !== "(none)" && rawMove.length >= 4) {
          try {
            const cleanGame = new Chess(fen);
            const moveObj = cleanGame.move({
              from: rawMove.slice(0, 2),
              to: rawMove.slice(2, 4),
              promotion: rawMove[4] || undefined,
            });
            if (moveObj) setBestMove(moveObj.san);
          } catch (e) {
            setBestMove(rawMove);
          }
        } else {
          setBestMove("-");
        }
      }
    };

    worker.postMessage("uci");
    worker.postMessage("setoption name MultiPV value 3");
    worker.postMessage("isready");
    worker.postMessage(`position fen ${fen}`);
    worker.postMessage("go depth 22");
  }, [fen]);

  useEffect(() => {
    return () => {
      if (workerRef.current) workerRef.current.terminate();
    };
  }, []);

  return {
    evaluation,
    bestMove,
    depth,
    topLines,
  };
};

export default useStockfish;