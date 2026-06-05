import { useEffect, useRef, useState } from "react";
import { Chess } from "chess.js";

const useStockfish = (fen) => {
  const workerRef = useRef(null);

  const [evaluation, setEvaluation] = useState("0.00");
  const [bestMove, setBestMove] = useState("");
  const [depth, setDepth] = useState(0);

  useEffect(() => {
    if (!fen) return;

    // 1. Terminate the old worker immediately to clear the calculation pipeline
    if (workerRef.current) {
      workerRef.current.terminate();
    }

    // 2. Initialize a fresh, clean engine instance for the new board state
    const worker = new Worker("/stockfish/stockfish-18-lite-single.js");
    workerRef.current = worker;

    // Instantly parse the side to move from the active FEN string
    const fenParts = fen.split(" ");
    const sideToMove = fenParts[1] || "w";

    worker.onmessage = (event) => {
      const line = event.data;
      if (typeof line !== "string") return;

      // Parse intermediate centipawn evaluations
      if (line.includes("score cp")) {
        const match = line.match(/score cp (-?\d+)/);
        if (match) {
          let cpValue = Number(match[1]);
          if (sideToMove === "b") cpValue = -cpValue;
          setEvaluation((cpValue / 100).toFixed(2));
        }
      }

      // Parse intermediate forced checkmates
      if (line.includes("score mate")) {
        const match = line.match(/score mate (-?\d+)/);
        if (match) {
          let mateValue = Number(match[1]);
          if (sideToMove === "b") mateValue = -mateValue;
          
          if (mateValue === 0) {
            setEvaluation(sideToMove === "b" ? "+M0" : "-M0");
          } else {
            const prefix = mateValue > 0 ? "+" : "-";
            setEvaluation(`${prefix}M${Math.abs(mateValue)}`);
          }
        }
      }

      // Parse lookahead calculation depth
      if (line.includes(" depth ")) {
        const match = line.match(/depth (\d+)/);
        if (match) {
          setDepth(Number(match[1]));
        }
      }

      // Convert raw engine notation (c5d4) to clean SAN (cxd5) on the fly
      if (line.startsWith("bestmove") || line.includes("pv ")) {
        let rawMove = "";
        
        if (line.startsWith("bestmove")) {
          rawMove = line.split(" ")[1];
        } else {
          // Fallback: extract the current best line guess from the PV stream
          const pvMatch = line.match(/pv\s+([a-h][1-8][a-h][1-8][qrbn]?)/);
          if (pvMatch) rawMove = pvMatch[1];
        }

        if (rawMove && rawMove !== "(none)") {
          try {
            // Reconstruct the move through chess.js to obtain pristine notation
            const cleanGame = new Chess(fen);
            const moveObj = cleanGame.move({
              from: rawMove.slice(0, 2),
              to: rawMove.slice(2, 4),
              promotion: rawMove[4] || undefined,
            });
            
            if (moveObj) setBestMove(moveObj.san);
          } catch (e) {
            setBestMove(rawMove); // Fallback securely if parsing errors occur
          }
        } else if (rawMove === "(none)") {
          setBestMove("-");
        }
      }
    };

    // 3. Command the fresh engine instance to start working
    worker.postMessage("uci");
    worker.postMessage("isready");
    worker.postMessage(`position fen ${fen}`);
    worker.postMessage("go depth 22");

  }, [fen]);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      if (workerRef.current) workerRef.current.terminate();
    };
  }, []);

  return {
    evaluation,
    bestMove,
    depth,
  };
};

export default useStockfish;