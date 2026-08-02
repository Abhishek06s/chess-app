require("dotenv").config();
const { Server } = require("socket.io");
const { Chess } = require("chess.js");
const jwt = require("jsonwebtoken");

const rooms = {};

const botGames = {};

// Matchmaking queue, bucketed by `${base}:${increment}:${isRated}` — an
// EXACT time control match, not just the same broad category (bullet /
// blitz / rapid). E.g. 3+0 and 3+2 are both "blitz" but must never be
// paired together.
// Each entry: { socketId, userId, username, rating, rd, timeControl, isRated, gameType, joinedAt }
const matchmakingQueues = {};

// ── Presence tracking (online / offline / in-game) ──────────────────────────
// userId -> Set of connected socketIds. A user can have several tabs open,
// so "offline" only fires once the LAST socket for that user disconnects.
const onlineUsers = {};
// userId -> Set of roomIds the user is currently an active (non-guest)
// player in. Non-empty means "in-game" regardless of onlineUsers, since a
// mid-game disconnect keeps the room (and the reconnect window) alive.
const inGameUsers = {};

function computeUserStatus(userId) {
  if (!userId) return "offline";
  if (inGameUsers[userId] && inGameUsers[userId].size > 0) return "in-game";
  if (onlineUsers[userId] && onlineUsers[userId].size > 0) return "online";
  return "offline";
}

// Broadcast a single user's current status to everyone connected. There's
// no per-friend subscription mechanism, so this is a simple global emit —
// clients filter for the userIds they care about.
function broadcastPresence(userId) {
  if (!userId || !io) return;
  io.emit("presence-update", { userId, status: computeUserStatus(userId) });
}

function markUserInGame(userId, roomId) {
  if (!userId) return;
  if (!inGameUsers[userId]) inGameUsers[userId] = new Set();
  inGameUsers[userId].add(roomId);
  broadcastPresence(userId);
}

function unmarkUserInGame(userId, roomId) {
  if (!userId || !inGameUsers[userId]) return;
  inGameUsers[userId].delete(roomId);
  if (inGameUsers[userId].size === 0) delete inGameUsers[userId];
  broadcastPresence(userId);
}

let io;

const ROOM_ID_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

// ── Matchmaking tuning ───────────────────────────────────────────────────
const MATCHMAKING_SWEEP_INTERVAL_MS = 1000;

// Instantly determine maximum allowed rating difference based on game type and rating.
function getMaxMatchRange(player) {
  if (player.gameType === "bullet" || player.gameType === "blitz") {
    return player.rating < 2500 ? 200 : 500;
  } else {
    // Rapid (and catch-all for any other formats)
    return player.rating < 2000 ? 200 : 500;
  }
}

// Generates a 12 character alphanumeric room id (collision-checked against
// currently active rooms).
function generateRoomId() {
  let roomId;
  do {
    roomId = "";
    for (let i = 0; i < 12; i++) {
      roomId += ROOM_ID_CHARS.charAt(
        Math.floor(Math.random() * ROOM_ID_CHARS.length),
      );
    }
  } while (rooms[roomId]);
  return roomId;
}

function getPoolKey(base, increment, isRated) {
  return `${base}:${increment}:${Boolean(isRated)}`;
}

// Removes this socket's own queued entry from every pool. Deliberately
// scoped to the socket only (not the userId) — a different browser/tab for
// the same account has its own independent search and must not be
// cancelled as a side effect of this one queueing or disconnecting.
function removeFromMatchmakingQueues(socketId) {
  for (const poolKey in matchmakingQueues) {
    const pool = matchmakingQueues[poolKey];
    const idx = pool.findIndex((entry) => entry.socketId === socketId);
    if (idx !== -1) pool.splice(idx, 1);
    if (matchmakingQueues[poolKey] && matchmakingQueues[poolKey].length === 0) {
      delete matchmakingQueues[poolKey];
    }
  }
}

// Returns the queued entry for this userId, if that account already has a
// search running (in any pool, e.g. from another browser/tab). Guests
// (no userId) are never deduped this way since they have no stable identity.
function findActiveSearchForUser(userId) {
  if (!userId) return null;
  for (const poolKey in matchmakingQueues) {
    const found = matchmakingQueues[poolKey].find(
      (entry) => entry.userId === userId,
    );
    if (found) return found;
  }
  return null;
}

// Parses the raw Cookie header string — no extra dep needed
function parseCookies(cookieStr = "") {
  const cookies = {};
  cookieStr.split(";").forEach((pair) => {
    const [key, ...val] = pair.trim().split("=");
    if (key) cookies[key.trim()] = decodeURIComponent(val.join("="));
  });
  return cookies;
}

// Extracts the userId from the JWT stored in the socket handshake cookie
function getUserIdFromSocket(socket) {
  try {
    const raw = socket.handshake.headers.cookie || "";
    const { token } = parseCookies(raw);
    if (!token) return null;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return String(decoded.id || decoded._id || "");
  } catch {
    return null;
  }
}

function getGameType(base, increment) {
  const total = base + increment * 40;
  if (total < 180) return "bullet";
  if (total < 600) return "blitz";
  return "rapid";
}

function getBotRoomName(userId) {
  return `bot:${userId}`;
}

function cleanUpBotGame(userId, state) {
  if (state?.cleanupTimeout) clearTimeout(state.cleanupTimeout);
  delete botGames[userId];
}

function cleanUpRoom(roomId) {
  const room = rooms[roomId];
  if (room) {
    if (room.disconnected) {
      clearTimeout(room.disconnected.timeoutId);
    }
    if (room.cleanupTimeout) {
      clearTimeout(room.cleanupTimeout);
    }
    console.log(`Cleaning up and deleting room: ${roomId}`);
    unmarkUserInGame(room.whiteUserId, roomId);
    unmarkUserInGame(room.blackUserId, roomId);
    delete rooms[roomId];
  }
}

const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:5173",
      credentials: true,
    },
  });

  // ── Helpers ──────────────────────────────────────────────────────────────

  // Clears all disconnect-countdown state from a room
  const clearDisconnectState = (room) => {
    if (!room || !room.disconnected) return;
    clearTimeout(room.disconnected.timeoutId);
    room.disconnected = null;
    room.abortOnDisconnect = false;
  };

  const clearCleanupTimeout = (room) => {
    if (!room?.cleanupTimeout) return;
    clearTimeout(room.cleanupTimeout);
    room.cleanupTimeout = null;
  };

  // Pairs two matchmaking-queue entries into a live room. Colors are
  // assigned randomly. The underlying room/roomId mechanism is unchanged
  // from the old create-room/join-room flow — only how two players find
  // each other has changed.
  const pairPlayersIntoRoom = (playerA, playerB) => {
    const roomId = generateRoomId();

    const whiteFirst = Math.random() < 0.5;
    const white = whiteFirst ? playerA : playerB;
    const black = whiteFirst ? playerB : playerA;

    const whiteSocket = io.sockets.sockets.get(white.socketId);
    const blackSocket = io.sockets.sockets.get(black.socketId);

    // If either socket vanished (disconnected) between being queued and
    // being matched, put the still-connected player back in the queue.
    if (!whiteSocket || !blackSocket) {
      const stillHere = whiteSocket ? white : blackSocket ? black : null;
      if (stillHere) {
        const poolKey = getPoolKey(
          stillHere.timeControl.base,
          stillHere.timeControl.increment,
          stillHere.isRated,
        );
        if (!matchmakingQueues[poolKey]) matchmakingQueues[poolKey] = [];
        matchmakingQueues[poolKey].push(stillHere);
        attemptMatchesInPool(poolKey);
      }
      return;
    }

    const startingFen = new Chess().fen();

    rooms[roomId] = {
      white: white.socketId,
      black: black.socketId,
      whiteUserId: white.userId,
      blackUserId: black.userId,
      whiteName: white.username,
      blackName: black.username,
      gameType: white.gameType,
      timeControl: {
        base: white.timeControl.base,
        increment: white.timeControl.increment,
      },
      isRated: Boolean(white.isRated),
      whiteRating: white.rating,
      blackRating: black.rating,
      whiteTimeRemaining: white.timeControl.base * 1000,
      blackTimeRemaining: white.timeControl.base * 1000,
      activeColor: "w",
      lastMoveTime: Date.now(),
      moveCount: 0,
      gameOver: false,
      pendingDrawOffer: null,
      disconnected: null,
      cleanupTimeout: null,
      fen: startingFen,
      moves: [],
      firstMoveAbortSeconds: null,
      whiteMoved: false,
      blackMoved: false,
    };

    whiteSocket.join(roomId);
    blackSocket.join(roomId);

    const room = rooms[roomId];

    // Guests have no userId and are never presence-tracked.
    markUserInGame(room.whiteUserId, roomId);
    markUserInGame(room.blackUserId, roomId);

    io.to(roomId).emit("game-started", {
      room,
      roomId,
      white: room.white,
      black: room.black,
      whiteUserId: room.whiteUserId,
      blackUserId: room.blackUserId,
      whiteName: room.whiteName,
      blackName: room.blackName,
      whiteRating: room.whiteRating,
      blackRating: room.blackRating,
      gameType: room.gameType,
      timeControl: room.timeControl,
      whiteTimeRemaining: room.whiteTimeRemaining,
      blackTimeRemaining: room.blackTimeRemaining,
      isRated: room.isRated,
      whiteMoved: false,
      blackMoved: false,
    });
  };

  // Sweeps a single matchmaking pool and pairs up everyone who currently
  // has an eligible opponent. 
  const attemptMatchesInPool = (poolKey) => {
    const pool = matchmakingQueues[poolKey];
    if (!pool || pool.length < 2) return;

    const matchedSocketIds = new Set();
    const pairsToCreate = [];

    // Oldest-waiting players get first pick of an opponent.
    const waiting = [...pool].sort((a, b) => a.joinedAt - b.joinedAt);

    for (const playerA of waiting) {
      if (matchedSocketIds.has(playerA.socketId)) continue;
      
      const maxRangeA = getMaxMatchRange(playerA);

      let bestOpponent = null;
      let closestRatingDiff = Infinity;

      for (const playerB of waiting) {
        if (playerB.socketId === playerA.socketId) continue;
        if (matchedSocketIds.has(playerB.socketId)) continue;
        if (
          playerA.userId &&
          playerB.userId &&
          playerA.userId === playerB.userId
        )
          continue; // no self-matching across tabs

        if (playerA.isGuest !== playerB.isGuest) continue; // guests only pair with guests

        const maxRangeB = getMaxMatchRange(playerB);
        const ratingDiff = Math.abs(playerA.rating - playerB.rating);

        // Both players must be within each other's maximum acceptable range limits.
        if (ratingDiff > Math.min(maxRangeA, maxRangeB)) continue;

        // Instantly find the absolute closest rating match available.
        if (ratingDiff < closestRatingDiff) {
          closestRatingDiff = ratingDiff;
          bestOpponent = playerB;
        }
      }

      if (bestOpponent) {
        matchedSocketIds.add(playerA.socketId);
        matchedSocketIds.add(bestOpponent.socketId);
        pairsToCreate.push([playerA, bestOpponent]);
      }
    }

    if (pairsToCreate.length === 0) return;

    matchmakingQueues[poolKey] = pool.filter(
      (entry) => !matchedSocketIds.has(entry.socketId),
    );
    if (matchmakingQueues[poolKey].length === 0) {
      delete matchmakingQueues[poolKey];
    }

    for (const [playerA, playerB] of pairsToCreate) {
      pairPlayersIntoRoom(playerA, playerB);
    }
  };

  // Periodically re-sweep every pool so players who are only widening their
  // rating range by waiting (no new player joining) still get matched.
  setInterval(() => {
    for (const poolKey in matchmakingQueues) {
      attemptMatchesInPool(poolKey);
    }
  }, MATCHMAKING_SWEEP_INTERVAL_MS);

  const buildRoomState = (roomId, room, normalizedColor) => ({
    roomId,
    fen: room.fen,
    moves: room.moves,
    whiteTimeRemaining: room.whiteTimeRemaining,
    blackTimeRemaining: room.blackTimeRemaining,
    activeColor: room.activeColor,
    whiteName: room.whiteName,
    blackName: room.blackName,
    whiteRating: room.whiteRating,
    blackRating: room.blackRating,
    whitePlayerId: room.whiteUserId,
    blackPlayerId: room.blackUserId,
    timeControl: room.timeControl,
    gameType: room.gameType,
    whiteMoved: room.whiteMoved,
    blackMoved: room.blackMoved,
    gameOver: room.gameOver,
    termination: room.termination,
    moveCount: room.moveCount,
    winner: room.winner,
    playerColor: normalizedColor === "w" ? "white" : "black",
    isRated: room.isRated,
    whiteSocketId: room.white,
  });

  // ── Disconnect enforcement ────────────────────────────────────────────────

  const failDisconnect = (roomId) => {
    const room = rooms[roomId];
    if (!room || room.gameOver || !room.disconnected) return;

    const disconnectedColor = room.disconnected.player;
    const winner = disconnectedColor === "w" ? "b" : "w";

    room.gameOver = true;

    if (room.disconnected.isAbort) {
      io.to(roomId).emit("game-aborted");
    } else {
      io.to(roomId).emit("player-abandoned", { winner, disconnectedColor });
    }

    clearDisconnectState(room);
    room.cleanupTimeout = setTimeout(() => cleanUpRoom(roomId), 10000);
  };

  // ── Clock tick (100 ms) ───────────────────────────────────────────────────

  setInterval(() => {
    const now = Date.now();

    for (const roomId in rooms) {
      const room = rooms[roomId];

      if (!room.lastMoveTime || room.gameOver) continue;

      const elapsed = now - room.lastMoveTime;
      let whiteTime = room.whiteTimeRemaining;
      let blackTime = room.blackTimeRemaining;

      if (room.disconnected) {
        const disconnectedElapsed = now - room.disconnected.startTime;
        const remainingMs = Math.max(0, 60000 - disconnectedElapsed);
        const remainingSeconds = Math.ceil(remainingMs / 1000);

        if (room.activeColor === "w") {
          whiteTime = Math.max(0, room.whiteTimeRemaining - elapsed);
        } else {
          blackTime = Math.max(0, room.blackTimeRemaining - elapsed);
        }

        // ── THROTTLE EMISSIONS TO ONCE PER SECOND ────────────────────────────
        if (room.disconnected.lastEmittedSecond !== remainingSeconds) {
          room.disconnected.lastEmittedSecond = remainingSeconds;

          io.to(roomId).emit("disconnect-countdown", {
            disconnectedColor: room.disconnected.player,
            remainingSeconds,
            isAbort: room.disconnected.isAbort,
          });
        }

        io.to(roomId).emit("disconnect-countdown", {
          disconnectedColor: room.disconnected.player,
          remainingSeconds,
          isAbort: room.disconnected.isAbort,
        });

        io.to(roomId).emit("clock-update", {
          whiteTimeRemaining: whiteTime,
          blackTimeRemaining: blackTime,
          activeColor: room.activeColor,
        });

        continue;
      }

      const waitingForWhiteFirstMove = !room.whiteMoved;
      const waitingForBlackFirstMove = room.whiteMoved && !room.blackMoved;

      if (
        (waitingForWhiteFirstMove || waitingForBlackFirstMove) &&
        !room.gameOver &&
        !room.disconnected &&
        room.lastMoveTime
      ) {
        const idle = now - room.lastMoveTime;
        const playerColor = waitingForWhiteFirstMove ? "w" : "b";

        if (idle >= 10000 && idle < 30000) {
          const remainingSeconds = Math.ceil((30000 - idle) / 1000);
          if (room.firstMoveAbortSeconds !== remainingSeconds) {
            room.firstMoveAbortSeconds = remainingSeconds;
            io.to(roomId).emit("abort-countdown", {
              playerColor,
              remainingSeconds,
            });
          }
        }

        if (idle >= 30000) {
          room.gameOver = true;
          room.termination = "abort";
          io.to(roomId).emit("game-aborted");
          room.cleanupTimeout = setTimeout(() => cleanUpRoom(roomId), 10000);
          continue;
        }
      }

      if (room.activeColor === "w") {
        whiteTime = Math.max(0, room.whiteTimeRemaining - elapsed);
        if (whiteTime === 0) {
          room.gameOver = true;
          room.termination = "timeout";
          room.winner = "b";
          io.to(roomId).emit("timeout", { winner: "b" });
          room.cleanupTimeout = setTimeout(() => cleanUpRoom(roomId), 10000);
        }
      } else {
        blackTime = Math.max(0, room.blackTimeRemaining - elapsed);
        if (blackTime === 0) {
          room.gameOver = true;
          room.termination = "timeout";
          room.winner = "w";
          io.to(roomId).emit("timeout", { winner: "w" });
          room.cleanupTimeout = setTimeout(() => cleanUpRoom(roomId), 10000);
        }
      }

      io.to(roomId).emit("clock-update", {
        whiteTimeRemaining: whiteTime,
        blackTimeRemaining: blackTime,
        activeColor: room.activeColor,
      });
    }
  }, 100);

  // ── Socket events ─────────────────────────────────────────────────────────

  io.on("connection", (socket) => {
    console.log("User Connected:", socket.id);

    const authedUserId = getUserIdFromSocket(socket);
    if (authedUserId) {
      socket.join(getBotRoomName(authedUserId));

      if (!onlineUsers[authedUserId]) onlineUsers[authedUserId] = new Set();
      onlineUsers[authedUserId].add(socket.id);
      broadcastPresence(authedUserId);
    }

    // ── Presence queries ─────────────────────────────────────────────────────
    // Batch lookup used by clients to get the current status for a list of
    // userIds (friends list, leaderboard rows, paired opponent, etc). Live
    // updates after this initial snapshot arrive via "presence-update".
    socket.on("get-presence", (userIds, callback) => {
      const ids = Array.isArray(userIds) ? userIds : [];
      const statuses = {};
      ids.forEach((id) => {
        if (id) statuses[String(id)] = computeUserStatus(String(id));
      });
      if (typeof callback === "function") callback(statuses);
    });

    // ── Matchmaking ──────────────────────────────────────────────────────────
    // Replaces the old create-room/join-room "share a code" flow. Players
    // are pooled by time control + rated setting and paired automatically —
    // first by availability (the first two players in an empty pool pair
    // immediately), and by closest rating whenever more than one candidate
    // is waiting. Once paired, a room is created exactly like before (same
    // roomId-keyed `rooms` object), just generated as a 12-character
    // alphanumeric id instead of a 6-character shareable code.
    socket.on(
      "find-match",
      ({ username, rating, timeControl, isRated = true }) => {
        const userId = getUserIdFromSocket(socket);

        // Same account already searching from another browser/tab? Don't
        // start a second search — tell this tab so it can show a message.
        const existingSearch = findActiveSearchForUser(userId);
        if (existingSearch && existingSearch.socketId !== socket.id) {
          socket.emit("matchmaking-already-active");
          return;
        }

        const gameType = getGameType(timeControl.base, timeControl.increment);
        const playerRating = rating?.[gameType]?.rating || 1200;
        const playerRD = rating?.[gameType]?.rd || 350;

        // Guard against double-queueing (e.g. a stray double click from
        // this same tab re-emitting find-match).
        removeFromMatchmakingQueues(socket.id);

        // Exact time-control match required — e.g. 3+0 and 3+2 are both
        // "blitz" but must never be paired with each other.
        const poolKey = getPoolKey(timeControl.base, timeControl.increment, isRated);
        if (!matchmakingQueues[poolKey]) matchmakingQueues[poolKey] = [];

        matchmakingQueues[poolKey].push({
          socketId: socket.id,
          userId,
          username,
          rating: playerRating,
          rd: playerRD,
          timeControl: {
            base: timeControl.base,
            increment: timeControl.increment,
          },
          isRated: Boolean(isRated),
          gameType,
          // Derived from the server-verified JWT (not client input), so it
          // can't be spoofed — guests have no JWT cookie and always resolve
          // to userId === null here.
          isGuest: !userId,
          joinedAt: Date.now(),
        });

        socket.emit("searching-match", { gameType, isRated: Boolean(isRated) });

        attemptMatchesInPool(poolKey);
      },
    );

    socket.on("cancel-matchmaking", () => {
      removeFromMatchmakingQueues(socket.id);
      socket.emit("matchmaking-cancelled");
    });

    socket.on("move", ({ roomId, move }) => {
      const room = rooms[roomId];
      if (!room || room.gameOver) return;

      let movingColor = null;
      if (socket.id === room.white) movingColor = "w";
      else if (socket.id === room.black) movingColor = "b";

      const movingUserId = getUserIdFromSocket(socket);
      if (!movingColor && movingUserId) {
        if (room.whiteUserId === movingUserId) movingColor = "w";
        else if (room.blackUserId === movingUserId) movingColor = "b";
      }

      if (!movingColor || movingColor !== room.activeColor) {
        return socket.emit("room-error", "It is not your turn!");
      }

      if (movingColor === "w") room.white = socket.id;
      else room.black = socket.id;

      // If there is a pending draw offer, playing a move automatically declines it
      if (room.pendingDrawOffer) {
        room.pendingDrawOffer = null;
        io.to(roomId).emit("draw-declined");
      }

      const now = Date.now();
      const elapsed = now - room.lastMoveTime;

      if (room.activeColor === "w") {
        room.whiteTimeRemaining =
          Math.max(0, room.whiteTimeRemaining - elapsed) +
          room.timeControl.increment * 1000;
        room.activeColor = "b";
      } else {
        room.blackTimeRemaining =
          Math.max(0, room.blackTimeRemaining - elapsed) +
          room.timeControl.increment * 1000;
        room.activeColor = "w";
      }

      const gameCopy = new Chess(room.fen);
      const result = gameCopy.move(move);

      if (result) {
        room.moves.push(result.san);
        room.fen = gameCopy.fen();

        if (result.color === "w" && !room.whiteMoved) {
          room.whiteMoved = true;
          io.to(roomId).emit("abort-countdown", {
            playerColor: "w",
            remainingSeconds: null,
          });
        }
        if (result.color === "b" && !room.blackMoved) {
          room.blackMoved = true;
          io.to(roomId).emit("abort-countdown", {
            playerColor: "b",
            remainingSeconds: null,
          });
        }
      }

      room.moveCount += 1;
      room.lastMoveTime = now;
      room.firstMoveAbortSeconds = null;

      if (room.moveCount === 2) {
        io.to(roomId).emit("abort-countdown", { remainingSeconds: null });
      }

      socket.to(roomId).emit("opponent-move", {
        move,
        whiteTimeRemaining: room.whiteTimeRemaining,
        blackTimeRemaining: room.blackTimeRemaining,
        activeColor: room.activeColor,
      });
    });

    // ── DRAW OFFER ───────────────────────────────────────────────────────────
    socket.on("draw-offer", ({ roomId }) => {
      const room = rooms[roomId];
      if (!room || room.gameOver) return;

      let offeringColor = null;
      if (socket.id === room.white) offeringColor = "w";
      else if (socket.id === room.black) offeringColor = "b";

      const orderingUserId = getUserIdFromSocket(socket);
      if (!offeringColor && orderingUserId) {
        if (room.whiteUserId === orderingUserId) offeringColor = "w";
        else if (room.blackUserId === orderingUserId) offeringColor = "b";
      }

      if (!offeringColor) return;

      // ── ANTI-SPAM RATE LIMITER (10 Seconds) ────────────────────────────────
      if (!room.lastDrawOffers) room.lastDrawOffers = {};
      const now = Date.now();
      if (now - (room.lastDrawOffers[offeringColor] || 0) < 10000) {
        return;
      }
      room.lastDrawOffers[offeringColor] = now;

      room.pendingDrawOffer = offeringColor;

      socket
        .to(roomId)
        .emit("draw-offer-received", { initiatedBy: offeringColor });
    });

    // ── DRAW RESPONSE ────────────────────────────────────────────────────────
    socket.on("draw-response", ({ roomId, accepted }) => {
      const room = rooms[roomId];
      if (!room || room.gameOver || !room.pendingDrawOffer) return;

      let respondingColor = null;
      if (socket.id === room.white) respondingColor = "w";
      else if (socket.id === room.black) respondingColor = "b";

      const respondingUserId = getUserIdFromSocket(socket);
      if (!respondingColor && respondingUserId) {
        if (room.whiteUserId === respondingUserId) respondingColor = "w";
        else if (room.blackUserId === respondingUserId) respondingColor = "b";
      }

      if (!respondingColor || respondingColor === room.pendingDrawOffer) {
        return;
      }

      if (respondingColor === "w") room.white = socket.id;
      else room.black = socket.id;

      room.pendingDrawOffer = null;
      if (accepted) {
        room.gameOver = true;
        room.termination = "draw";
        room.winner = null;
        io.to(roomId).emit("draw-accepted",{ whiteSocketId: room.white });
        cleanUpRoom(roomId);
      } else {
        io.to(roomId).emit("draw-declined");
      }
    });

    socket.on("resign", ({ roomId }) => {
      const room = rooms[roomId];
      if (!room || room.gameOver) return;
      room.gameOver = true;
      const winnerColor = socket.id === room.white ? "b" : "w";
      room.termination = "resignation";
      room.winner = winnerColor;
      // Keep existing event shape (human-readable) for clients listening to player-resigned
      io.to(roomId).emit("player-resigned", {
        winner: winnerColor === "w" ? "white" : "black",
        whiteSocketId: room.white,
      });
      room.cleanupTimeout = setTimeout(() => cleanUpRoom(roomId), 10000);
    });

    socket.on("abort-game", ({ roomId }) => {
      const room = rooms[roomId];
      if (!room || room.gameOver || room.disconnected) return;

      if (room.moveCount >= 2) {
        return socket.emit(
          "room-error",
          "Cannot abort. You must resign instead.",
        );
      }

      room.gameOver = true;
      io.to(roomId).emit("game-aborted");
      room.cleanupTimeout = setTimeout(() => cleanUpRoom(roomId), 10000);
    });

    // ── BOT GAME SYNC ─────────────────────────────────────────────────────────
    socket.on("bot:continue", ({ fen, moves, playerColor } = {}) => {
      const userId = getUserIdFromSocket(socket);
      if (!userId) return;

      const roomName = getBotRoomName(userId);
      socket.join(roomName);

      let state = botGames[userId];
      if (!state) {
        state = botGames[userId] = {
          fen: fen || new Chess().fen(),
          moves: Array.isArray(moves) ? moves : [],
          playerColor: playerColor === "black" ? "black" : "white",
          gameStarted: true,
          engineOwnerSocketId: null,
          gameOverHandled: false,
          cleanupTimeout: null,
        };
      }

      if (state.cleanupTimeout) {
        clearTimeout(state.cleanupTimeout);
        state.cleanupTimeout = null;
      }
      state.gameOverHandled = false;
      state.gameStarted = true;

      // Only take over engine ownership if nobody currently connected holds it.
      const currentOwner = state.engineOwnerSocketId
        ? io.sockets.sockets.get(state.engineOwnerSocketId)
        : null;
      if (!currentOwner) {
        state.engineOwnerSocketId = socket.id;
      }

      socket.emit("bot:sync-state", {
        fen: state.fen,
        moves: state.moves,
        playerColor: state.playerColor,
        gameStarted: state.gameStarted,
      });

      socket.emit("bot:engine-owner", {
        isOwner: state.engineOwnerSocketId === socket.id,
      });
    });


    socket.on("bot:move", ({ move } = {}) => {
      const userId = getUserIdFromSocket(socket);
      if (!userId || !move) return;

      const state = botGames[userId];
      if (!state) return;

      try {
        const chessCopy = new Chess(state.fen);
        const result = chessCopy.move(move);
        if (!result) return;

        state.fen = chessCopy.fen();
        state.moves.push(result.san);

        socket.to(getBotRoomName(userId)).emit("bot:move", {
          move,
          san: result.san,
          fen: state.fen,
        });
      } catch {}
    });

    // "New Game" clicked in any tab: resets the one shared session and
    // broadcasts the fresh position to every tab (including the sender),
    socket.on("bot:new-game", ({ playerColor } = {}) => {
      const userId = getUserIdFromSocket(socket);
      if (!userId) return;

      const roomName = getBotRoomName(userId);
      socket.join(roomName);

      const previous = botGames[userId];
      if (previous?.cleanupTimeout) clearTimeout(previous.cleanupTimeout);

      const startingFen = new Chess().fen();
      const normalizedColor = playerColor === "black" ? "black" : "white";

      const state = (botGames[userId] = {
        fen: startingFen,
        moves: [],
        playerColor: normalizedColor,
        gameStarted: true,
        engineOwnerSocketId: socket.id,
        gameOverHandled: false,
        cleanupTimeout: null,
      });

      io.to(roomName).emit("bot:new-game", {
        fen: state.fen,
        moves: state.moves,
        playerColor: state.playerColor,
        gameStarted: true,
      });

      const room = io.sockets.adapter.rooms.get(roomName);
      if (room) {
        for (const sid of room) {
          io.to(sid).emit("bot:engine-owner", { isOwner: sid === socket.id });
        }
      }
    });


    socket.on("bot:game-over", (payload = {}, callback) => {
      const userId = getUserIdFromSocket(socket);
      if (!userId) {
        if (typeof callback === "function") callback({ shouldPersist: true });
        return;
      }

      const { termination, winner, fen, moves } = payload;

      let state = botGames[userId];
      if (!state) {
        state = botGames[userId] = {
          fen: fen || new Chess().fen(),
          moves: Array.isArray(moves) ? moves : [],
          playerColor: null,
          gameStarted: false,
          engineOwnerSocketId: null,
          gameOverHandled: false,
          cleanupTimeout: null,
        };
      }

      if (state.gameOverHandled) {
        if (typeof callback === "function") callback({ shouldPersist: false });
        return;
      }

      state.gameOverHandled = true;
      state.gameStarted = false;
      if (typeof fen === "string") state.fen = fen;
      if (Array.isArray(moves)) state.moves = moves;

      if (typeof callback === "function") callback({ shouldPersist: true });

      // Let every other open tab know the result too (e.g. a resignation
      // or draw offer isn't derivable from the move list alone).
      socket.to(getBotRoomName(userId)).emit("bot:game-ended", {
        termination: termination || null,
        winner: winner || null,
        fen: state.fen,
        moves: state.moves,
      });

      // Keep the finished session around briefly in case other tabs are
      // mid-flight with their own "bot:game-over", then drop it.
      if (state.cleanupTimeout) clearTimeout(state.cleanupTimeout);
      state.cleanupTimeout = setTimeout(() => {
        cleanUpBotGame(userId, state);
      }, 15000);
    });

    // ── reconnect-room: same-device path (localStorage) ─────────────────────

    socket.on("reconnect-room", ({ roomId, playerColor }) => {
      const room = rooms[roomId];
      if (!room) {
        socket.emit("room-restore-failed");
        return;
      }

      const normalizedColor =
        playerColor === "white"
          ? "w"
          : playerColor === "black"
            ? "b"
            : playerColor;

      if (!["w", "b"].includes(normalizedColor)) {
        socket.emit("room-restore-failed");
        return;
      }

      const isLiveReconnect =
        !room.gameOver &&
        room.disconnected &&
        room.disconnected.player === normalizedColor;

      if (isLiveReconnect) {
        if (normalizedColor === "w") room.white = socket.id;
        else room.black = socket.id;

        socket.join(roomId);

        clearDisconnectState(room);
        clearCleanupTimeout(room);
      } else if (room.gameOver) {
        if (normalizedColor === "w") room.white = socket.id;
        else room.black = socket.id;
        socket.join(roomId);
        clearCleanupTimeout(room);
      } else {
        socket.emit("room-restore-failed");
        return;
      }

      socket.emit(
        "room-restored",
        buildRoomState(roomId, room, normalizedColor),
      );
      io.to(roomId).emit("player-reconnected", {
        playerColor: normalizedColor === "w" ? "white" : "black",
      });
    });

    // ── reconnect-by-session: cross-device path (JWT session) ───────────────

    socket.on("reconnect-by-session", (callback) => {
      const userId = getUserIdFromSocket(socket);
      if (!userId) {
        if (typeof callback === "function") {
          return callback({ status: "not-found" });
        }
        socket.emit("session-game-not-found");
        return;
      }

      for (const roomId in rooms) {
        const room = rooms[roomId];

        let normalizedColor = null;
        if (room.whiteUserId && room.whiteUserId === userId)
          normalizedColor = "w";
        else if (room.blackUserId && room.blackUserId === userId)
          normalizedColor = "b";

        if (!normalizedColor) continue;
        if (room.gameOver) continue;

        if (!room.black) {
          cleanUpRoom(roomId);
          continue;
        }

        socket.join(roomId);

        if (normalizedColor === "w") room.white = socket.id;
        else room.black = socket.id;

        if (room.disconnected?.player === normalizedColor) {
          clearDisconnectState(room);
          clearCleanupTimeout(room);
        }

        const roomState = buildRoomState(roomId, room, normalizedColor);

        if (typeof callback === "function") {
          callback({ status: "found", roomState });
        } else {
          socket.emit("session-game-found", roomState);
        }

        if (!room.gameOver) {
          io.to(roomId).emit("player-reconnected", {
            playerColor: normalizedColor === "w" ? "white" : "black",
          });
        }
        return;
      }

      if (typeof callback === "function") {
        callback({ status: "not-found" });
      } else {
        socket.emit("session-game-not-found");
      }
    });

    socket.on("rating-update", ({ roomId, ratingChanges }) => {
      if (!roomId || !ratingChanges) return;
      io.to(roomId).emit("rating-update", ratingChanges);
    });

    socket.on("game-over", ({ roomId }) => {
      const room = rooms[roomId];
      if (!room) return;
      room.gameOver = true;
      room.cleanupTimeout = setTimeout(() => cleanUpRoom(roomId), 10000);
    });

    // Client-driven game end with details (e.g. checkmate) — broadcast so both clients can clear state
    socket.on(
      "game-ended",
      ({ roomId, termination, winner, pgn, moves, fen }) => {
        const room = rooms[roomId];
        if (!room) return;

        if (room.gameEndedHandled) return;
        room.gameEndedHandled = true;

        room.gameOver = true;
        room.termination = termination || null;
        room.winner = winner || null;
        if (Array.isArray(moves)) room.moves = moves;
        if (typeof fen === "string") room.fen = fen;
        io.to(roomId).emit("game-ended", {
          termination: room.termination,
          winner: room.winner,
          pgn: pgn || null,
          moves: room.moves,
          fen: room.fen,
          whiteSocketId: room.white,
        });
        room.cleanupTimeout = setTimeout(() => cleanUpRoom(roomId), 10000);
      },
    );

    // ── disconnect ───────────────────────────────────────────────────────────

    socket.on("disconnect", () => {
      console.log("User Disconnected:", socket.id);

      // Drop this socket from the matchmaking queue if it was waiting.
      removeFromMatchmakingQueues(socket.id);

      // If this socket owned the Stockfish engine for a bot game, hand
      // ownership to another still-open tab for the same user, if any.
      // If no tab is left, ownership simply clears and the next tab to click "Continue Game" will take it.
      const disconnectedUserId = getUserIdFromSocket(socket);
      if (disconnectedUserId) {
        const botState = botGames[disconnectedUserId];
        if (botState && botState.engineOwnerSocketId === socket.id) {
          const roomName = getBotRoomName(disconnectedUserId);
          const room = io.sockets.adapter.rooms.get(roomName);
          const remaining = room
            ? Array.from(room).filter((sid) => sid !== socket.id)
            : [];

          if (remaining.length > 0) {
            const [newOwnerId] = remaining;
            botState.engineOwnerSocketId = newOwnerId;
            io.to(newOwnerId).emit("bot:engine-owner", { isOwner: true });
          } else {
            botState.engineOwnerSocketId = null;
          }
        }

        // Drop this tab from the presence set; only flips to "offline" once
        // every tab for this user has disconnected.
        if (onlineUsers[disconnectedUserId]) {
          onlineUsers[disconnectedUserId].delete(socket.id);
          if (onlineUsers[disconnectedUserId].size === 0) {
            delete onlineUsers[disconnectedUserId];
          }
          broadcastPresence(disconnectedUserId);
        }
      }

      for (const roomId in rooms) {
        const room = rooms[roomId];
        if (room.gameOver || room.disconnected) continue;

        if (room.white === socket.id || room.black === socket.id) {
          if (!room.black) {
            cleanUpRoom(roomId);
            continue;
          }

          const player = room.white === socket.id ? "w" : "b";
          const isAbort = room.moveCount < 2;

          room.disconnected = {
            player,
            startTime: Date.now(),
            // After 60 s with no reconnect the game is forfeited
            timeoutId: setTimeout(() => failDisconnect(roomId), 60000),
            isAbort,
          };

          io.to(roomId).emit("disconnect-countdown", {
            disconnectedColor: player,
            remainingSeconds: 60,
            isAbort,
          });

          // Keep the room alive for up to 120 s so a cross-device reconnect
          room.cleanupTimeout = setTimeout(() => cleanUpRoom(roomId), 120000);

          break;
        }
      }
    });
  });
};

const getIO = () => io;

module.exports = { initializeSocket, getIO };