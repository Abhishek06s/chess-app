import React from "react";
import { ExternalLink } from "lucide-react";
import StatusIndicator from "./StatusIndicator";

const PlayerCard = ({
  name,
  rating,
  isOnline,
  status,
  color,
  time,
  isActive,
  capturedPieces = [],
  advantage,
  statusText,
  ratingChange = null,
  showClock = true,
  showOnlineDot = true,
  onNameClick,
}) => {
  const formatTime = (ms = 0) => {
    if (typeof ms !== "number" || Number.isNaN(ms)) {
      return "0:00";
    }

    const totalSeconds = Math.floor(ms / 1000);

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (ms < 10000) {
      const tenths = Math.floor((ms % 1000) / 100);
      return `${seconds}.${tenths}`;
    }

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
        .toString()
        .padStart(2, "0")}`;
    }

    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const getTimeColor = () => {
    if ((time ?? 0) <= 5000) {
      return "text-red-500 animate-pulse drop-shadow-lg";
    }

    if ((time ?? 0) <= 10000) {
      return "text-orange-400";
    }

    if ((time ?? 0) <= 30000) {
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
          {onNameClick ? (
            <button
              onClick={onNameClick}
              className="group/name flex items-center gap-1.5 text-left rounded-md outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 cursor-pointer transition-all duration-200"
              aria-label={`View ${name}'s profile`}
            >
              <h2 className="text-base md:text-lg font-bold text-zinc-100 decoration-indigo-400/40 decoration-2 underline-offset-4 group-hover/name:underline group-hover/name:text-indigo-400 transition-all duration-200">
                {name}
              </h2>
              <span className="flex items-center text-zinc-500 group-hover/name:text-indigo-400 transition-all duration-300 transform -translate-x-1 translate-y-1 group-hover/name:translate-x-0 group-hover/name:-translate-y-0">
                <ExternalLink className="w-4 h-4 opacity-0 group-hover/name:opacity-100 transition-opacity duration-300" />
              </span>
            </button>
          ) : (
            <h2 className="text-base md:text-lg font-bold text-zinc-100">
              {name}
            </h2>
          )}
        </div>

        <div className="flex items-center gap-2">
          <p className="text-zinc-400 text-sm">Rating: {rating ?? "?"}</p>
          {ratingChange !== null && (
            <span
              className={`text-xs font-bold ${
                ratingChange > 0
                  ? "text-emerald-400"
                  : ratingChange < 0
                    ? "text-rose-400"
                    : "text-zinc-400"
              }`}
            >
              {ratingChange > 0 ? `+${ratingChange}` : ratingChange}
            </span>
          )}
        </div>

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
        {statusText && (
          <p className="text-xs text-amber-300 mt-2">{statusText}</p>
        )}
      </div>

      <div className="flex items-center gap-4">
        {showClock && (
          <p
            className={`text-2xl font-bold bg-zinc-900 px-5 py-2 rounded-lg ${getTimeColor()}`}
          >
            {formatTime(time)}
          </p>
        )}
        {showOnlineDot &&
          (status ? (
            <StatusIndicator status={status} />
          ) : (
            <div
              className={`w-3 h-3 rounded-full ${
                isOnline ? "bg-green-500" : "bg-red-500"
              }`}
            />
          ))}
      </div>
    </div>
  );
};

export default PlayerCard;
