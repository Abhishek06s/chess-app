import { useEffect, useState } from "react";

const useChessClock = (
  game,
  moves,
  gameStarted,
  baseTimeSeconds = 600,
  incrementSeconds = 0,
) => {
  const [whiteTime, setWhiteTime] = useState(baseTimeSeconds * 1000);
  const [blackTime, setBlackTime] = useState(baseTimeSeconds * 1000);

  useEffect(() => {
    setWhiteTime(baseTimeSeconds * 1000);
    setBlackTime(baseTimeSeconds * 1000);
  }, [baseTimeSeconds, incrementSeconds]);

  useEffect(() => {
    if (moves.length === 0 || !gameStarted || game.isGameOver()) return;

    const playerWhoJustMoved = game.turn() === "b" ? "w" : "b";

    if (playerWhoJustMoved === "w") {
      setWhiteTime((prev) => prev + incrementSeconds * 1000);
    } else {
      setBlackTime((prev) => prev + incrementSeconds * 1000);
    }
  }, [moves.length]);

  useEffect(() => {
    if (!gameStarted || game.isGameOver()) return;

    const interval = setInterval(() => {
      if (game.turn() === "w") {
        setWhiteTime((prev) => Math.max(prev - 10, 0));
      } else {
        setBlackTime((prev) => Math.max(prev - 10, 0));
      }
    }, 10);

    return () => clearInterval(interval);
  }, [moves.length, gameStarted, game]);

  const resetClock = () => {
    setWhiteTime(baseTimeSeconds * 1000);
    setBlackTime(baseTimeSeconds * 1000);
  };

  return {
    whiteTime,
    blackTime,
    resetClock,
  };
};

export default useChessClock;
