import { Chess } from "chess.js";

let engine = null;
let engineReady = null; // Promise that resolves once the UCI handshake is done

const queue = [];
let isThinking = false;

const MIN_THINK_MS = 500;
const MAX_THINK_MS = 1000;

// --- Generic "wait for a specific engine response line" plumbing ---------
//
// Stockfish (like any UCI engine) is asynchronous: sending "uci" doesn't
// mean it's initialized, and sending "setoption" doesn't mean the option
// has been applied. The protocol's way of confirming this is:
//   uci        -> wait for "uciok"
//   setoption  -> (any number of these)
//   isready    -> wait for "readyok"
// Only after "readyok" is it safe to trust that previously-sent options
// (like MultiPV) have actually taken effect.

let pendingWaits = [];

// While a search is in flight, every "info ..." line the engine emits is
// also handed to this listener (if set) so we can track the current best
// move for each MultiPV slot as the search deepens. This is how difficulty
// is now enforced: instead of asking Stockfish to play weaker (via
// UCI_LimitStrength/UCI_Elo, which is inconsistent - see botDifficulty.js),
// we always let it search at full honesty for the given depth/multiPV, then
// deliberately choose among the ranked candidates ourselves.
let infoListener = null;

function dispatchLine(line) {
  if (typeof line !== "string") return;
  if (infoListener) infoListener(line);
  pendingWaits = pendingWaits.filter((waiter) => {
    if (waiter.test(line)) {
      waiter.resolve(line);
      return false;
    }
    return true;
  });
}

function waitForLine(test, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const waiter = { test, resolve: null };
    const timer = setTimeout(() => {
      pendingWaits = pendingWaits.filter((w) => w !== waiter);
      reject(new Error("Timed out waiting for engine response"));
    }, timeoutMs);

    waiter.resolve = (line) => {
      clearTimeout(timer);
      resolve(line);
    };
    pendingWaits.push(waiter);
  });
}

function createEngineWorker() {
  const worker = new Worker("/stockfish/stockfish-18-lite-single.js");
  worker.addEventListener("message", (event) => dispatchLine(event.data));
  return worker;
}

// Lazily creates the engine and performs the full UCI init handshake:
// uci -> uciok -> setoption(s) -> isready -> readyok.
// Safe to call repeatedly; concurrent callers all await the same
// in-flight init promise instead of re-running the handshake.
async function getEngine() {
  if (engine && engineReady) {
    await engineReady;
    return engine;
  }

  engine = createEngineWorker();

  engineReady = (async () => {
    const uciOk = waitForLine((line) => line === "uciok");
    engine.postMessage("uci");
    await uciOk;

    // MultiPV is (re)sent fresh before every move in processQueue() instead
    // of once here, since the difficulty (and therefore the pool size) can
    // change from one game to the next on this same worker.
    const readyOk = waitForLine((line) => line === "readyok");
    engine.postMessage("isready");
    await readyOk;
  })();

  await engineReady;
  return engine;
}

function finishTurn() {
  queue.shift();
  isThinking = false;
  processQueue();
}

// Parses a single UCI "info ..." line for the fields we care about:
//   multipv <n>   - which ranked line this is (1 = engine's current best)
//   score cp <x>  | score mate <x>  - evaluation from the mover's POV
//   pv <move> ... - the line's first (i.e. the actual candidate) move
// Returns null if the line doesn't carry all three (e.g. "info string ...").
function parseInfoLine(line) {
  if (!line.startsWith("info ")) return null;

  const multipvMatch = line.match(/\bmultipv (\d+)/);
  const scoreMatch = line.match(/\bscore (cp|mate) (-?\d+)/);
  const pvMatch = line.match(/\bpv (\S+)/);
  if (!multipvMatch || !scoreMatch || !pvMatch) return null;

  const index = parseInt(multipvMatch[1], 10);
  const rawScore = parseInt(scoreMatch[2], 10);
  // Normalize "mate in N" to a large centipawn-equivalent so it still sorts
  // and compares sensibly against genuine cp scores (closer mates are
  // "more winning"/"more losing" than further ones).
  const centipawns =
    scoreMatch[1] === "mate"
      ? Math.sign(rawScore) * (100000 - Math.abs(rawScore) * 100)
      : rawScore;

  return { index, centipawns, move: pvMatch[1] };
}

// Picks which candidate move to actually play, given the ranked MultiPV
// list (candidates[0] is the engine's genuine best move) and this tier's
// mistake profile. With probability `mistakeChance` we deliberately play
// something other than the best move, but only from among candidates whose
// evaluation is within `maxCentipawnLoss` of the best - so weaker tiers
// error more *often*, while the `maxCentipawnLoss` cap (set per tier)
// bounds how *bad* any single error can be.
//
// If `mistakesOnlyWhenComplex` is set, the mistake roll is skipped entirely
// unless the position is "close" - i.e. the best and second-best candidates
// are within `complexityThreshold` centipawns of each other. A wide gap
// means there's one clearly-best move (a hanging piece, a forced tactic),
// which a strong tier wouldn't plausibly miss.
//
// Within the eligible set, `mistakeSoftening` controls how strongly smaller
// losses are favored over larger ones (weight = 1 / (loss + softening)): a
// low value concentrates mistakes near the best move (near-misses only,
// used for the strong tiers), a high value flattens the distribution so
// genuinely bad moves are plausible too (used for the weak tiers, so they
// don't just make token, harmless "mistakes").
function chooseMove(
  candidates,
  {
    mistakeChance,
    maxCentipawnLoss,
    mistakeSoftening = 50,
    mistakesOnlyWhenComplex = false,
    complexityThreshold = 0,
  },
) {
  if (candidates.length <= 1) return candidates[0];

  const best = candidates[0];

  if (mistakesOnlyWhenComplex) {
    const second = candidates[1];
    const gap = second ? best.centipawns - second.centipawns : Infinity;
    if (gap > complexityThreshold) return best;
  }

  if (Math.random() >= mistakeChance) return best;

  const eligible = candidates.slice(1).filter((candidate) => {
    const loss = best.centipawns - candidate.centipawns;
    return loss <= maxCentipawnLoss;
  });
  if (eligible.length === 0) return best;

  const weights = eligible.map((candidate) => {
    const loss = Math.max(0, best.centipawns - candidate.centipawns);
    return 1 / (loss + mistakeSoftening);
  });
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  let roll = Math.random() * totalWeight;
  for (let i = 0; i < eligible.length; i += 1) {
    roll -= weights[i];
    if (roll <= 0) return eligible[i];
  }
  return eligible[eligible.length - 1];
}

async function processQueue() {
  if (isThinking || queue.length === 0) return;
  isThinking = true;

  const {
    fen,
    depth,
    multiPV,
    mistakeChance,
    maxCentipawnLoss,
    mistakeSoftening,
    mistakesOnlyWhenComplex,
    complexityThreshold,
    resolve,
    reject,
  } = queue[0];

  try {
    const chess = new Chess(fen);

    if (chess.isGameOver()) {
      resolve(null);
      finishTurn();
      return;
    }

    const worker = await getEngine();
    const startedAt = Date.now();

    const candidatesBySlot = new Map();
    infoListener = (line) => {
      const parsed = parseInfoLine(line);
      if (!parsed) return;
      candidatesBySlot.set(parsed.index, parsed);
    };

    worker.postMessage(
      `setoption name MultiPV value ${Math.max(1, multiPV || 1)}`,
    );
    const readyOk = waitForLine((line) => line === "readyok");
    worker.postMessage("isready");
    await readyOk;

    const bestMove = waitForLine((line) => line.startsWith("bestmove"), 30000);

    worker.postMessage(`position fen ${fen}`);
    worker.postMessage(`go depth ${depth}`);

    const line = await bestMove;
    infoListener = null;

    const candidates = [...candidatesBySlot.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, info]) => info);

    let rawMove;
    if (candidates.length > 0) {
      const chosen = chooseMove(candidates, {
        mistakeChance: mistakeChance ?? 0,
        maxCentipawnLoss: maxCentipawnLoss ?? 0,
        mistakeSoftening: mistakeSoftening ?? 50,
        mistakesOnlyWhenComplex: mistakesOnlyWhenComplex ?? false,
        complexityThreshold: complexityThreshold ?? 0,
      });
      rawMove = chosen.move;
    } else {
      // Fallback for the rare case no "info ... multipv ..." line arrived
      // (e.g. mate-in-0 / only one legal move) - trust the engine's own
      // bestmove verbatim.
      rawMove = line.split(" ")[1];
    }

    if (!rawMove || rawMove === "(none)") {
      resolve(null);
      finishTurn();
      return;
    }

    const move = {
      from: rawMove.slice(0, 2),
      to: rawMove.slice(2, 4),
      promotion: rawMove[4] || undefined,
    };

    let san = null;
    try {
      const verifyGame = new Chess(fen);
      const result = verifyGame.move(move);
      san = result ? result.san : null;
    } catch {
      san = null;
    }

    if (!san) {
      resolve(null);
      finishTurn();
      return;
    }

    const elapsed = Date.now() - startedAt;
    const target =
      MIN_THINK_MS + Math.random() * (MAX_THINK_MS - MIN_THINK_MS);
    const remainingDelay = Math.max(0, target - elapsed);

    setTimeout(() => {
      resolve({ ...move, san });
      finishTurn();
    }, remainingDelay);
  } catch (err) {
    infoListener = null;
    reject(err);
    finishTurn();
  }
}

/**
 * Ask the engine for a single move in the given position.
 * Resolves to { from, to, promotion, san } or null if there's no
 * legal move to make (checkmate/stalemate/etc).
 *
 * @param {string} fen
 * @param {object} [options]
 * @param {number} [options.depth] - fixed search depth for "go depth N".
 * @param {number} [options.multiPV] - number of ranked candidate moves to
 *   request from the engine; 1 disables mistake injection entirely.
 * @param {number} [options.mistakeChance] - 0-1 probability of deliberately
 *   playing something other than the engine's top choice.
 * @param {number} [options.maxCentipawnLoss] - upper bound (in centipawns)
 *   on how much worse a deliberately-chosen "mistake" move is allowed to be
 *   relative to the top choice.
 * @param {number} [options.mistakeSoftening] - weighting softener; higher
 *   values allow worse mistakes to be picked more often (see chooseMove()).
 * @param {boolean} [options.mistakesOnlyWhenComplex] - if true, only roll
 *   for a mistake when the best/second-best candidates are close in eval.
 * @param {number} [options.complexityThreshold] - centipawn gap under which
 *   a position counts as "complex" when mistakesOnlyWhenComplex is set.
 */
export function requestBotMove(
  fen,
  {
    depth = 14,
    multiPV = 1,
    mistakeChance = 0,
    maxCentipawnLoss = 0,
    mistakeSoftening = 50,
    mistakesOnlyWhenComplex = false,
    complexityThreshold = 0,
  } = {},
) {
  return new Promise((resolve, reject) => {
    queue.push({
      fen,
      depth,
      multiPV,
      mistakeChance,
      maxCentipawnLoss,
      mistakeSoftening,
      mistakesOnlyWhenComplex,
      complexityThreshold,
      resolve,
      reject,
    });
    processQueue();
  });
}

/**
 * Convenience wrapper for bot games: checks whether it's actually the
 * bot's turn, fetches its move, and hands it to the caller's makeMove
 * function (the same { from, to, promotion } shape ChessBoard.makeMove
 * already expects). Safe to call after every player move — it no-ops
 * for anything that isn't a live bot game on the bot's turn.
 *
 * @param {object} params
 * @param {import("chess.js").Chess} params.game - current game instance
 * @param {"bot"|"multiplayer"} params.gameMode
 * @param {boolean} params.gameStarted - only true once "New Game" has been
 *   pressed for the bot section; the engine refuses to move otherwise, even
 *   if it happens to already be the bot's turn on a stale board.
 * @param {"w"|"b"} params.botColor - which side the bot is playing
 * @param {(move: {from:string,to:string,promotion?:string}) => void} params.makeMove
 * @param {() => boolean} [params.isCancelled] - checked right before the
 *   resolved move is applied; return true to discard it (e.g. the game was
 *   reset or left while the engine was still thinking).
 * @param {number} [params.depth]
 * @param {number} [params.multiPV]
 * @param {number} [params.mistakeChance]
 * @param {number} [params.maxCentipawnLoss]
 * @param {number} [params.mistakeSoftening]
 * @param {boolean} [params.mistakesOnlyWhenComplex]
 * @param {number} [params.complexityThreshold]
 */
export async function triggerBotMove({
  game,
  gameMode,
  gameStarted,
  botColor,
  makeMove,
  isCancelled,
  depth = 14,
  multiPV = 1,
  mistakeChance = 0,
  maxCentipawnLoss = 0,
  mistakeSoftening = 50,
  mistakesOnlyWhenComplex = false,
  complexityThreshold = 0,
} = {}) {
  if (gameMode !== "bot") return null;
  if (!gameStarted) return null;
  if (!game || typeof makeMove !== "function") return null;
  if (!botColor) return null;
  if (game.isGameOver()) return null;
  if (game.turn() !== botColor) return null;

  const move = await requestBotMove(game.fen(), {
    depth,
    multiPV,
    mistakeChance,
    maxCentipawnLoss,
    mistakeSoftening,
    mistakesOnlyWhenComplex,
    complexityThreshold,
  });
  if (!move) return null;
  if (typeof isCancelled === "function" && isCancelled()) return null;

  makeMove({
    from: move.from,
    to: move.to,
    promotion: move.promotion,
  });

  return move;
}

/** Stop the current search and clear any pending requests. */
export function stopBot() {
  if (engine) {
    engine.postMessage("stop");
  }
  // Resolve anything still waiting so callers of requestBotMove don't hang,
  // then drop the queue and any in-flight response listeners.
  queue.forEach((item) => item.resolve(null));
  queue.length = 0;
  isThinking = false;
  pendingWaits = [];
  infoListener = null;
}

/** Fully tear down the engine worker (e.g. when leaving a bot game). */
export function terminateBot() {
  if (engine) {
    engine.terminate();
    engine = null;
    engineReady = null;
  }
  queue.forEach((item) => item.resolve(null));
  queue.length = 0;
  isThinking = false;
  pendingWaits = [];
  infoListener = null;
}