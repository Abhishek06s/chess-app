import { useEffect, useState } from "react";

const useChessClock = (
  game,
  moves,
  gameStarted,
  initialTime = 600
) => {
    const [whiteTime, setWhiteTime] = useState(initialTime * 1000);
    const [blackTime, setBlackTime] = useState(initialTime * 1000);

  useEffect(() => {
    if (!gameStarted) return;
    if (game.isGameOver()) return;

    const interval = setInterval(() => {
      if (game.turn() === "w") {
        setWhiteTime((prev) => Math.max(prev - 10, 0));
      } 
      else {
        setBlackTime((prev) => Math.max(prev - 10, 0));
      }
    }, 10);

    return () => clearInterval(interval);
  }, [moves.length]);

  const resetClock = () => {
    setWhiteTime(initialTime * 1000);
    setBlackTime(initialTime * 1000);
  };

  return {
    whiteTime,
    blackTime,
    resetClock,
  };
};

export default useChessClock;