import React from "react";

const PlayerCard = ({
  name,
  rating,
  isOnline,
  color,
  time,
  isActive,
  capturedPieces,
  advantage,
}) => {
  const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);

    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    if (ms < 10000) {
      const tenths = Math.floor((ms % 1000) / 100);
      return `${seconds}.${tenths}`;
    }

    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const getTimeColor = () => {
    if (time <= 5000) {
      return "text-red-500 animate-pulse drop-shadow-lg";
    }

    if (time <= 10000) {
      return "text-orange-400";
    }

    if (time <= 30000) {
      return "text-yellow-400";
    }

    return "text-white";
  };

  const pieceSymbols = {
    w: {
      k: "https://upload.wikimedia.org/wikipedia/commons/4/42/Chess_klt45.svg",
      q: "https://upload.wikimedia.org/wikipedia/commons/1/15/Chess_qlt45.svg",
      r: "https://upload.wikimedia.org/wikipedia/commons/7/72/Chess_rlt45.svg",
      b: "https://upload.wikimedia.org/wikipedia/commons/b/b1/Chess_blt45.svg",
      n: "https://upload.wikimedia.org/wikipedia/commons/7/70/Chess_nlt45.svg",
      p: "https://upload.wikimedia.org/wikipedia/commons/4/45/Chess_plt45.svg",
    },
    b: {
      k: "https://upload.wikimedia.org/wikipedia/commons/f/f0/Chess_kdt45.svg",
      q: "https://upload.wikimedia.org/wikipedia/commons/4/47/Chess_qdt45.svg",
      r: "https://upload.wikimedia.org/wikipedia/commons/f/ff/Chess_rdt45.svg",
      b: "https://upload.wikimedia.org/wikipedia/commons/9/98/Chess_bdt45.svg",
      n: "https://upload.wikimedia.org/wikipedia/commons/e/ef/Chess_ndt45.svg",
      p: "https://upload.wikimedia.org/wikipedia/commons/c/c7/Chess_pdt45.svg",
    },
  };

  return (
    <div
      className={`rounded-xl p-4 flex justify-between items-center transition-all duration-300
    ${
      isActive
        ? "bg-zinc-700 ring-2 ring-green-500 shadow-lg shadow-green-500/20"
        : "bg-zinc-800"
    }`}
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span
            className={`w-4 h-4 rounded-full ${
              color === "white"
                ? "bg-white border border-zinc-600"
                : "bg-black border border-white"
            }`}
          />
          <h2>{name}</h2>
        </div>

        <p className="text-zinc-400 text-sm">Rating: {rating}</p>

        <div className="flex items-center gap-1 h-6">
          {capturedPieces.map(({ piece, count }) => (
            <div
              key={`${piece.color}-${piece.type}`}
              className="flex items-center"
            >
              <img
                src={pieceSymbols[piece.color][piece.type]}
                alt=""
                className={`w-6 h-6 object-contain ${
                  piece.color === "b"
                    ? "drop-shadow-[0_0_1.5px_rgba(255,255,255,0.8)] filter brightness-110"
                    : "drop-shadow-[0_1.2px_1.2px_rgba(0,0,0,0.5)]"
                }`}
              />

              {count > 1 && (
                <span className="text-xs text-zinc-400 mx-0.5">×{count}</span>
              )}
            </div>
          ))}

          {advantage > 0 && (
            <span className="ml-2 text-green-400 text-xs font-semibold">
              +{advantage}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <p
          className={`text-2xl font-bold bg-zinc-900 px-5 py-2 rounded-lg ${getTimeColor()}`}
        >
          {formatTime(time)}
        </p>
        <div
          className={`w-3 h-3 rounded-full ${
            isOnline ? "bg-green-500" : "bg-red-500"
          }`}
        />
      </div>
    </div>
  );
};

export default PlayerCard;
