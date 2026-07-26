require("dotenv").config();
const { Server } = require("socket.io");
const { Chess } = require("chess.js");
const jwt = require("jsonwebtoken");

const rooms = {};

const botGames = {};
let io;

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
    }

    socket.on(
      "create-room",
      ({ username, rating, timeControl, isRated = true }) => {
        const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        const gameType = getGameType(timeControl.base, timeControl.increment);
        const startingFen = new Chess().fen();

        rooms[roomId] = {
          white: socket.id,
          black: null,
          whiteUserId: getUserIdFromSocket(socket),
          blackUserId: null,
          whiteName: username,
          blackName: null,
          gameType,
          timeControl: {
            base: timeControl.base,
            increment: timeControl.increment,
          },
          isRated: Boolean(isRated),
          whiteRating: rating?.[gameType]?.rating || 1200,
          blackRating: null,
          whiteTimeRemaining: timeControl.base * 1000,
          blackTimeRemaining: timeControl.base * 1000,
          activeColor: "w",
          lastMoveTime: null,
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

        socket.join(roomId);
        socket.emit("room-created", roomId);
      },
    );

    socket.on("join-room", ({ roomId, username, rating, isRated }) => {
      const room = rooms[roomId];
      if (!room) return socket.emit("room-error", "Room not found");
      if (room.black) return socket.emit("room-error", "Room full");


      // Prevent joining if rated/unrated preferences do not match
      if (typeof isRated === "boolean" && room.isRated !== isRated) {
        return socket.emit(
          "room-error",
          `Game mode mismatch: Room is ${room.isRated ? "Rated" : "Unrated"}.`,
        );
      }

      // ── Block self-play ──────────────────────────────────
      const joiningUserId = getUserIdFromSocket(socket);
      if (
        room.white === socket.id ||
        (joiningUserId && room.whiteUserId === joiningUserId)
      ) {
        return socket.emit("room-error", "You cannot play against yourself!");
      }

      room.black = socket.id;
      room.blackName = username;
      room.blackUserId = getUserIdFromSocket(socket);
      room.blackRating = rating?.[room.gameType]?.rating || 1200;

      socket.join(roomId);
      room.lastMoveTime = Date.now();
      room.firstMoveAbortSeconds = null;

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