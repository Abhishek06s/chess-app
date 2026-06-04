import { useState } from "react";
import { Chess } from "chess.js";

const useMoveNavigation = (moves) => {
  const [moveIndex, setMoveIndex] = useState(-1);

  const getPositionAtMove = () => {
    const tempGame = new Chess();

    for (let i = 0; i <= moveIndex; i++) {
      if (moves[i]) {
        tempGame.move(moves[i]);
      }
    }

    return tempGame;
  };

  const goToFirst = () => {
    setMoveIndex(-1);
  };

  const goToPrevious = () => {
    setMoveIndex((prev) => Math.max(prev - 1, -1));
  };

  const goToNext = () => {
    setMoveIndex((prev) =>
      Math.min(prev + 1, moves.length - 1)
    );
  };

  const goToLast = () => {
    setMoveIndex(moves.length - 1);
  };

  return {
    moveIndex,
    setMoveIndex,
    getPositionAtMove,
    goToFirst,
    goToPrevious,
    goToNext,
    goToLast,
  };
};

export default useMoveNavigation;