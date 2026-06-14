import { useEffect, useRef, useState } from "react";
import { Chess } from "chess.js";

const useStockfish = (fen) => {
  const workerRef = useRef(null);

  const fenRef = useRef(fen);
  const sideToMoveRef = useRef("w");
  const linesCacheRef = useRef([]);

  // State managers to prevent WASM memory crashes
  const isSearchingRef = useRef(false);
  const pendingFenRef = useRef(null);

  const [evaluation, setEvaluation] = useState("0.00");
  const [bestMove, setBestMove] = useState("");
  const [depth, setDepth] = useState(0);
  const [topLines, setTopLines] = useState([]);

  useEffect(() => {
    fenRef.current = fen;
    const parts = fen ? fen.split(" ") : [];
    sideToMoveRef.current = parts[1] || "w";
  }, [fen]);

  // 1. Initialize Worker ONLY ONCE on mount
  useEffect(() => {
    const worker = new Worker("/stockfish/stockfish-18-lite-single.js");
    workerRef.current = worker;

    worker.postMessage("uci");
    worker.postMessage("setoption name MultiPV value 3");
    worker.postMessage("isready");

    worker.onmessage = (event) => {
      const line = event.data;
      if (typeof line !== "string") return;

      const currentFen = fenRef.current;
      const sideToMove = sideToMoveRef.current;

      if (line.includes(" depth ")) {
        const depthMatch = line.match(/\bdepth (\d+)\b/);
        if (depthMatch) setDepth(Number(depthMatch[1]));
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
            const cleanGame = new Chess(currentFen);
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

            linesCacheRef.current[idx] = {
              eval: lineEval,
              continuation:
                readableMoves.length > 0
                  ? readableMoves.join(" ")
                  : "Game Over",
            };

            setTopLines([...linesCacheRef.current].filter(Boolean).slice(0, 3));
          } catch (e) {}
        }
      }

      // PROGRESSIVE BEST MOVE UPDATE
      // Reads the engine's current top choice before it finishes the full depth
      if (
        line.includes(" depth ") &&
        line.includes(" pv ") &&
        line.includes("multipv 1 ")
      ) {
        const pvMatch = line.match(/ pv\s+([a-h][1-8][a-h][1-8][qrbn]?)/);
        if (pvMatch && pvMatch[1]) {
          const rawMove = pvMatch[1];
          try {
            const cleanGame = new Chess(currentFen);
            const moveObj = cleanGame.move({
              from: rawMove.slice(0, 2),
              to: rawMove.slice(2, 4),
              promotion: rawMove[4] || undefined,
            });
            if (moveObj) setBestMove(moveObj.san);
          } catch (e) {
            // Fallback to the raw UCI move if chess.js throws an error
            setBestMove(rawMove);
          }
        }
      }

      // Handle the end of a search cleanly
      if (line.startsWith("bestmove")) {
        isSearchingRef.current = false; // The engine has safely stopped

        // If a FEN was queued up while we were stopping, start it now
        if (pendingFenRef.current) {
          const nextFen = pendingFenRef.current;
          pendingFenRef.current = null; // Clear the queue

          workerRef.current.postMessage(`position fen ${nextFen}`);
          workerRef.current.postMessage("go depth 22");
          isSearchingRef.current = true;
        }

        // Standard bestmove parsing
        const rawMove = line.split(" ")[1];
        if (rawMove && rawMove !== "(none)" && rawMove.length >= 4) {
          try {
            const cleanGame = new Chess(currentFen);
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

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  // 2. Control the Engine safely when the FEN changes
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
      linesCacheRef.current = [];
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
        linesCacheRef.current = [];

        if (workerRef.current && isSearchingRef.current) {
          workerRef.current.postMessage("stop");
        }
        return;
      }
    } catch (e) {
      console.error("Game Over validation check failed:", e);
    }

    setBestMove("-");
    setTopLines([]);
    setDepth(0);
    linesCacheRef.current = [];

    // Safe Command Routing
    if (workerRef.current) {
      if (isSearchingRef.current) {
        // Engine is currently crunching a previous move.
        // Queue the new FEN and ask it to stop gracefully.
        pendingFenRef.current = fen;
        workerRef.current.postMessage("stop");
      } else {
        // Engine is idle. Start immediately.
        workerRef.current.postMessage(`position fen ${fen}`);
        workerRef.current.postMessage("go depth 22");
        isSearchingRef.current = true;
      }
    }
  }, [fen]);

  return {
    evaluation,
    bestMove,
    depth,
    topLines,
  };
};

export default useStockfish;
