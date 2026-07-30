// Parses a PGN move-comment such as "[%clk 0:09:58]" (the standard
// lichess/chess.com clock annotation, stored inside a "{...}" comment
// right after the move it belongs to) into a millisecond duration.
//
// Returns null if the comment doesn't contain a %clk tag.
export function parseClockMs(comment) {
  if (!comment) return null;

  const match = comment.match(/%clk\s+(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/);
  if (!match) return null;

  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const seconds = parseFloat(match[3]);

  return Math.round(((hours * 60 + minutes) * 60 + seconds) * 1000);
}

// Quick check used to decide whether a PGN carries clock annotations at
// all, so the UI can skip rendering clocks entirely for PGNs that don't.
export function pgnHasClockAnnotations(pgn) {
  return typeof pgn === "string" && /%clk\s+\d+:\d{2}:\d{2}/.test(pgn);
}

// Parses a PGN "TimeControl" header (e.g. "600", "600+5", "40/9000:5400")
// into the base time in milliseconds each side starts the game with.
// Returns null if the header is missing, unknown ("?"), or untimed ("-").
export function parseTimeControlBaseMs(timeControl) {
  if (typeof timeControl !== "string") return null;

  const trimmed = timeControl.trim();
  if (!trimmed || trimmed === "-" || trimmed === "*" || trimmed === "?") {
    return null;
  }

  // Classical-style controls can chain multiple stages separated by ":".
  // The base time is the first stage, e.g. "40/9000:5400" -> 9000s.
  const firstStage = trimmed.split(":")[0];

  // "moves/seconds", e.g. "40/9000"
  const movesMatch = firstStage.match(/^\d+\/(\d+)$/);
  if (movesMatch) {
    return parseInt(movesMatch[1], 10) * 1000;
  }

  // "seconds" or "seconds+increment", e.g. "600" or "600+5"
  const secondsMatch = firstStage.match(/^(\d+)(?:\+\d+)?$/);
  if (secondsMatch) {
    return parseInt(secondsMatch[1], 10) * 1000;
  }

  return null;
}

// Best-effort base time (ms) for a game: prefers the PGN's TimeControl
// header, and falls back to the largest %clk value actually seen in the
// game (a reasonable proxy when the header is missing/unrecognized, since
// clocks only ever count down from the base outside of increments).
export function inferBaseTimeMs(timeControl, allClockValues = []) {
  const fromHeader = parseTimeControlBaseMs(timeControl);
  if (fromHeader != null) return fromHeader;

  const known = allClockValues.filter((ms) => typeof ms === "number");
  if (known.length) return Math.max(...known);

  return null;
}

// Given an array of `{ side: "white" | "black", clockMs }`-shaped entries
// (in play order) and an index, returns the most recently known clock for
// each side as of that index (inclusive) — i.e. what a static clock
// display should show if you're looking at that particular move. Before
// either side's first recorded clock, falls back to `baseMs` (the game's
// starting time) instead of null so the display starts from the actual
// base time control rather than 0:00.
export function getClocksAtIndex(entries, index, baseMs = null) {
  let whiteClockMs = baseMs;
  let blackClockMs = baseMs;

  for (let i = 0; i <= index && i < entries.length; i++) {
    const entry = entries[i];
    if (!entry || entry.clockMs == null) continue;
    if (entry.side === "white") whiteClockMs = entry.clockMs;
    else if (entry.side === "black") blackClockMs = entry.clockMs;
  }

  return { whiteClockMs, blackClockMs };
}

// Same idea, but for a root-to-node path of MoveTree nodes (each with
// `.move.color` ("w"/"b") and `.clockMs`), as used on the Analysis board.
export function getClocksAtPath(path, baseMs = null) {
  let whiteClockMs = baseMs;
  let blackClockMs = baseMs;

  for (const node of path) {
    if (!node || node.clockMs == null || !node.move) continue;
    if (node.move.color === "w") whiteClockMs = node.clockMs;
    else if (node.move.color === "b") blackClockMs = node.clockMs;
  }

  return { whiteClockMs, blackClockMs };
}