import { useState } from "react";

const useCapturedPieces = () => {
  const [capturedPieces, setCapturedPieces] = useState({
    white: [],
    black: [],
  });

  const addCapturedPiece = (piece) => {
    if (!piece) return;

    setCapturedPieces((prev) => ({
      ...prev,
      [piece.color === "w" ? "white" : "black"]: [
        ...prev[piece.color === "w" ? "white" : "black"],
        {
          type: piece.type,
          color: piece.color,
        },
      ],
    }));
  };

  const resetCapturedPieces = () => {
    setCapturedPieces({
      white: [],
      black: [],
    });
  };

  const groupPieces = (pieces) => {
    const grouped = {};

    pieces.forEach((piece) => {
      const key = `${piece.color}-${piece.type}`;

      if (!grouped[key]) {
        grouped[key] = {
          piece,
          count: 0,
        };
      }

      grouped[key].count++;
    });

    return Object.values(grouped);
  };

  const pieceValues = {
    p: 1,
    n: 3,
    b: 3,
    r: 5,
    q: 9,
  };

  const getMaterialScore = (pieces) =>
    pieces.reduce((sum, piece) => sum + pieceValues[piece.type], 0);

  const whiteScore = getMaterialScore(capturedPieces.black);
  const blackScore = getMaterialScore(capturedPieces.white);
  const whiteAdvantage = Math.max(whiteScore - blackScore, 0);
  const blackAdvantage = Math.max(blackScore - whiteScore, 0);

  const groupedWhitePieces = groupPieces(capturedPieces.white);
  const groupedBlackPieces = groupPieces(capturedPieces.black);

  return {
    capturedPieces,
    addCapturedPiece,
    resetCapturedPieces,
    whiteAdvantage,
    blackAdvantage,
    groupedWhitePieces,
    groupedBlackPieces,
  };
};

export default useCapturedPieces;
