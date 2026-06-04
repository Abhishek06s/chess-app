import { useEffect, useRef, useState } from "react";

const useStockfish = (fen) => {
  const engineRef = useRef(null);

  const [evaluation, setEvaluation] = useState(0);
  const [bestMove, setBestMove] = useState("");
  const [depth, setDepth] = useState(0);

  useEffect(() => {
    engineRef.current = new Worker("/stockfish/stockfish-18-lite-single.js");

    const engine = engineRef.current;

    engine.onmessage = (event) => {
      const line = event.data;

      if (typeof line !== "string") return;

      if (line.includes("score cp")) {
        const match = line.match(/score cp (-?\d+)/);

        if (match) {
          setEvaluation((Number(match[1]) / 100).toFixed(2));
        }
      }

      if (line.includes("score mate")) {
        const match = line.match(/score mate (-?\d+)/);

        if (match) {
          setEvaluation(`#${match[1]}`);
        }
      }

      if (line.includes(" depth ")) {
        const match = line.match(/depth (\d+)/);

        if (match) {
          setDepth(Number(match[1]));
        }
      }

      if (line.startsWith("bestmove")) {
        const move = line.split(" ")[1];

        setBestMove(move);
      }
    };

    return () => {
      engine.terminate();
    };
  }, []);

  useEffect(() => {
    if (!engineRef.current || !fen) return;

    const engine = engineRef.current;

    engine.postMessage("uci");
    engine.postMessage("isready");

    engine.postMessage(`position fen ${fen}`);

    engine.postMessage("go depth 15");
  }, [fen]);

  return {
    evaluation,
    bestMove,
    depth,
  };
};

export default useStockfish;
