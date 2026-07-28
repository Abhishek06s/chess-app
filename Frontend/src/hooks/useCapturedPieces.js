import { useState } from "react";

const useCapturedPieces = (fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1") => {
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

  const restoreCapturedPieces = (pieces) => {
    setCapturedPieces({
      white: Array.isArray(pieces?.white) ? pieces.white : [],
      black: Array.isArray(pieces?.black) ? pieces.black : [],
    });
  };

  const groupPieces = (pieces) => {
    const grouped = {};
    pieces.forEach((piece) => {
      const key = `${piece.color}-${piece.type}`;
      if (!grouped[key]) {
        grouped[key] = { piece, count: 0 };
      }
      grouped[key].count++;
    });
    return Object.values(grouped);
  };

  const pieceValues = { p: 1, n: 3, b: 3, r: 5, q: 9 };
  let whiteScore = 0;
  let blackScore = 0;
  
  const boardLayout = fen.split(" ")[0];
  for (const char of boardLayout) {
    const lower = char.toLowerCase();
    if (pieceValues[lower]) {
      if (char === char.toUpperCase()) {
        whiteScore += pieceValues[lower];
      } else {
        blackScore += pieceValues[lower];
      }
    }
  }

  const whiteAdvantage = Math.max(whiteScore - blackScore, 0);
  const blackAdvantage = Math.max(blackScore - whiteScore, 0);

  const groupedWhitePieces = groupPieces(capturedPieces.white);
  const groupedBlackPieces = groupPieces(capturedPieces.black);

  return {
    capturedPieces,
    addCapturedPiece,
    resetCapturedPieces,
    restoreCapturedPieces,
    whiteAdvantage,
    blackAdvantage,
    groupedWhitePieces,
    groupedBlackPieces,
  };
};

export default useCapturedPieces;