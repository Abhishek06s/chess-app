import React from "react";

const STATUS_CONFIG = {
  online: {
    label: "Online",
    dot: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]",
    text: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
    ping: true,
  },
  "in-game": {
    label: "In-Game",
    dot: "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]",
    text: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
    ping: true,
  },
  offline: {
    label: "Offline",
    dot: "bg-zinc-500",
    text: "text-zinc-400",
    bg: "bg-zinc-500/10 border-zinc-500/20",
    ping: false,
  },
};

/**
 * A small colored dot followed by "Online" / "Offline" / "In-Game".
 * Unrecognized/missing statuses fall back to "offline".
 */
const StatusIndicator = ({ status, className = "", dotClassName = "" }) => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.offline;

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium shrink-0 ml-2 ${config.text} ${className}`}
    >
      <span className="relative flex h-2 w-2 items-center justify-center shrink-0">
        {config.ping && (
          <span 
            className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${config.dot}`} 
          />
        )}
        {/* Static dot */}
        <span
          className={`relative inline-flex h-2 w-2 rounded-full ${config.dot} ${dotClassName}`}
        />
      </span>
      <span className="-mt-0.5">{config.label}</span>
    </span>
  );
};

export default StatusIndicator;
