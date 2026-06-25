const { Server } = require("socket.io");
const { Chess } = require("chess.js");

const rooms = {};
let io;

function getGameType(base, increment) {
  const total = base + increment * 40;
  if (total < 180) return "bullet";
  if (total < 600) return "blitz";
  return "rapid";
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
      origin: "http://localhost:5173",
      credentials: true,
    },
  });

  const clearDisconnectState = (room) => {
    if (!room || !room.disconnected) return;
    clearTimeout(room.disconnected.timeoutId);
    room.disconnected = null;
    room.abortOnDisconnect = false;
  };

  const failDisconnect = (roomId) => {
    const room = rooms[roomId];
    if (!room || room.gameOver || !room.disconnected) return;

    const disconnectedColor = room.disconnected.player;
    const winner = disconnectedColor === "w" ? "b" : "w";

    room.gameOver = true;
    const eventData = {
      winner,
      disconnectedColor,
    };

    if (room.disconnected.isAbort) {
      io.to(roomId).emit("game-aborted");
    } else {
      io.to(roomId).emit("player-abandoned", eventData);
    }

    clearDisconnectState(room);
    setTimeout(() => cleanUpRoom(roomId), 10000);
  };

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

          setTimeout(() => cleanUpRoom(roomId), 10000);
          continue;
        }
      }

      if (room.activeColor === "w") {
        whiteTime = Math.max(0, room.whiteTimeRemaining - elapsed);
        if (whiteTime === 0) {
          room.gameOver = true;
          io.to(roomId).emit("timeout", { winner: "b" });
          setTimeout(() => cleanUpRoom(roomId), 10000);
        }
      } else {
        blackTime = Math.max(0, room.blackTimeRemaining - elapsed);
        if (blackTime === 0) {
          room.gameOver = true;
          io.to(roomId).emit("timeout", { winner: "w" });
          setTimeout(() => cleanUpRoom(roomId), 10000);
        }
      }

      io.to(roomId).emit("clock-update", {
        whiteTimeRemaining: whiteTime,
        blackTimeRemaining: blackTime,
        activeColor: room.activeColor,
      });
    }
  }, 100);

  io.on("connection", (socket) => {
    console.log("User Connected:", socket.id);

    socket.on("create-room", ({ username, rating, timeControl }) => {
      const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
      const gameType = getGameType(timeControl.base, timeControl.increment);

      const startingFen = new Chess().fen();

      rooms[roomId] = {
        white: socket.id,
        black: null,
        whiteName: username,
        blackName: null,
        gameType,
        timeControl: {
          base: timeControl.base,
          increment: timeControl.increment,
        },
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
        fen: startingFen,
        moves: [],
        firstMoveAbortSeconds: null,

        whiteMoved: false,
        blackMoved: false,
      };

      socket.join(roomId);
      socket.emit("room-created", roomId);
    });

    socket.on("join-room", ({ roomId, username, rating }) => {
      const room = rooms[roomId];

      if (!room) return socket.emit("room-error", "Room not found");
      if (room.black) return socket.emit("room-error", "Room full");

      room.black = socket.id;
      room.blackName = username;
      room.blackRating = rating?.[room.gameType]?.rating || 1200;

      socket.join(roomId);
      room.lastMoveTime = Date.now();
      room.firstMoveAbortSeconds = null;

      io.to(roomId).emit("game-started", {
        room,
        roomId,
        white: room.white,
        black: room.black,
        whiteName: room.whiteName,
        blackName: room.blackName,
        whiteRating: room.whiteRating,
        blackRating: room.blackRating,
        gameType: room.gameType,
        timeControl: room.timeControl,
        whiteTimeRemaining: room.whiteTimeRemaining,
        blackTimeRemaining: room.blackTimeRemaining,
        whiteMoved: false,
        blackMoved: false,
      });
    });

    socket.on("move", ({ roomId, move }) => {
      const room = rooms[roomId];
      if (!room || room.gameOver) return;

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
        io.to(roomId).emit("abort-countdown", {
          remainingSeconds: null,
        });
      }

      socket.to(roomId).emit("opponent-move", {
        move,
        whiteTimeRemaining: room.whiteTimeRemaining,
        blackTimeRemaining: room.blackTimeRemaining,
        activeColor: room.activeColor,
      });
    });

    socket.on("draw-offer", ({ roomId }) => {
      const room = rooms[roomId];
      if (!room || room.gameOver) return;

      room.pendingDrawOffer = socket.id;
      socket.to(roomId).emit("draw-offer-received");
    });

    socket.on("draw-response", ({ roomId, accepted }) => {
      const room = rooms[roomId];
      if (!room) return;

      room.pendingDrawOffer = null;

      if (accepted) {
        room.gameOver = true;
        io.to(roomId).emit("draw-accepted");
        cleanUpRoom(roomId);
      } else {
        io.to(roomId).emit("draw-declined");
      }
    });

    socket.on("resign", ({ roomId }) => {
      const room = rooms[roomId];
      if (!room || room.gameOver) return;

      room.gameOver = true;

      const winner = socket.id === room.white ? "black" : "white";

      io.to(roomId).emit("player-resigned", {
        winner,
      });

      setTimeout(() => cleanUpRoom(roomId), 10000);
    });

    socket.on("abort-game", ({ roomId }) => {
      const room = rooms[roomId];
      if (!room || room.gameOver || room.disconnected) return;

      room.gameOver = true;

      io.to(roomId).emit("game-aborted");

      setTimeout(() => cleanUpRoom(roomId), 10000);
    });

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
        if (normalizedColor === "w") {
          room.white = socket.id;
        } else {
          room.black = socket.id;
        }

        socket.join(roomId);
        clearTimeout(room.disconnected.timeoutId);
        room.disconnected = null;
      } else if (room.gameOver) {
        if (normalizedColor === "w") {
          room.white = socket.id;
        } else {
          room.black = socket.id;
        }
        socket.join(roomId);
      } else {
        socket.emit("room-restore-failed");
        return;
      }

      const roomState = {
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
        timeControl: room.timeControl,
        gameOver: room.gameOver,
        termination: room.termination,
        moveCount: room.moveCount,
        winner: room.winner,
      };

      socket.emit("room-restored", roomState);
      io.to(roomId).emit("player-reconnected", {
        playerColor: normalizedColor === "w" ? "white" : "black",
      });
    });

    socket.on("game-over", ({ roomId }) => {
      const room = rooms[roomId];
      if (!room) return;

      room.gameOver = true;

      setTimeout(() => {
        cleanUpRoom(roomId);
      }, 10000);
    });

    socket.on("disconnect", () => {
      console.log("User Disconnected:", socket.id);

      for (const roomId in rooms) {
        const room = rooms[roomId];

        if (room.gameOver || room.disconnected) continue;

        if (room.white === socket.id || room.black === socket.id) {
          const player = room.white === socket.id ? "w" : "b";
          const isAbort = room.moveCount < 2;

          room.disconnected = {
            player,
            startTime: Date.now(),
            timeoutId: setTimeout(() => failDisconnect(roomId), 60000),
            isAbort,
          };

          io.to(roomId).emit("disconnect-countdown", {
            disconnectedColor: player,
            remainingSeconds: 60,
            isAbort,
          });

          // keep room alive longer after abandonment/abort so reconnect can restore final board
          room.cleanupTimeout = setTimeout(() => cleanUpRoom(roomId), 120000);

          break;
        }
      }
    });
  });
};

const getIO = () => io;

module.exports = {
  initializeSocket,
  getIO,
};
