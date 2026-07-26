import { Chess } from "chess.js";

let engine = null;
let engineReady = null; 

const queue = [];
let isThinking = false;

const DEFAULT_ELO = 1500;
const MIN_ELO = 400;
const MAX_ELO = 2900;

const MIN_THINK_MS = 500;
const MAX_THINK_MS = 1000;

let pendingWaits = [];

function dispatchLine(line) {
  if (typeof line !== "string") return;
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

    engine.postMessage("setoption name UCI_LimitStrength value true");

    const readyOk = waitForLine((line) => line === "readyok");
    engine.postMessage("isready");
    await readyOk;
  })();

  await engineReady;
  return engine;
}

function clampElo(elo) {
  return Math.min(MAX_ELO, Math.max(MIN_ELO, elo));
}

function finishTurn() {
  queue.shift();
  isThinking = false;
  processQueue();
}

async function processQueue() {
  if (isThinking || queue.length === 0) return;
  isThinking = true;

  const { fen, elo, depth, resolve, reject } = queue[0];

  try {
    const chess = new Chess(fen);

    if (chess.isGameOver()) {
      resolve(null);
      finishTurn();
      return;
    }

    const worker = await getEngine();
    const startedAt = Date.now();
    
    worker.postMessage(`setoption name UCI_Elo value ${clampElo(elo)}`);
    const readyOk = waitForLine((line) => line === "readyok");
    worker.postMessage("isready");
    await readyOk;

    const bestMove = waitForLine((line) => line.startsWith("bestmove"), 30000);

    worker.postMessage(`position fen ${fen}`);
    worker.postMessage(`go depth ${depth}`);

    const line = await bestMove;
    const rawMove = line.split(" ")[1];

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
    reject(err);
    finishTurn();
  }
}

/**
 * Ask the engine for a single move in the given position.
 * Resolves to { from, to, promotion, san } or null if there's no
 * legal move to make (checkmate/stalemate/etc).
 */
export function requestBotMove(fen, { elo = DEFAULT_ELO, depth = 14 } = {}) {
  return new Promise((resolve, reject) => {
    queue.push({ fen, elo, depth, resolve, reject });
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
 * @param {number} [params.elo]
 * @param {number} [params.depth]
 */

export async function triggerBotMove({
  game,
  gameMode,
  gameStarted,
  botColor,
  makeMove,
  isCancelled,
  elo = DEFAULT_ELO,
  depth = 14,
} = {}) {
  if (gameMode !== "bot") return null;
  if (!gameStarted) return null;
  if (!game || typeof makeMove !== "function") return null;
  if (!botColor) return null;
  if (game.isGameOver()) return null;
  if (game.turn() !== botColor) return null;

  const move = await requestBotMove(game.fen(), { elo, depth });
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
  
  
  queue.forEach((item) => item.resolve(null));
  queue.length = 0;
  isThinking = false;
  pendingWaits = [];
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
}