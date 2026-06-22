const { Server } = require("socket.io");

const rooms = {};
let io;

function getGameType(base, increment) {
  const total = base + increment * 40;
  if (total < 180) return "bullet";
  if (total < 600) return "blitz";
  return "rapid";
}

function cleanUpRoom(roomId) {
  if (rooms[roomId]) {
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

  setInterval(() => {
    const now = Date.now();

    for (const roomId in rooms) {
      const room = rooms[roomId];

      if (!room.lastMoveTime || room.gameOver) continue;

      const elapsed = now - room.lastMoveTime;
      let whiteTime = room.whiteTimeRemaining;
      let blackTime = room.blackTimeRemaining;

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
        gameOver: false,
        pendingDrawOffer: null,
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

      room.lastMoveTime = now;

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
      if (!room || room.gameOver) return;

      room.gameOver = true;

      io.to(roomId).emit("game-aborted");

      setTimeout(() => cleanUpRoom(roomId), 10000);
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

        if (room.gameOver) continue;

        if (room.white === socket.id || room.black === socket.id) {
          room.gameOver = true;

          const winner = room.white === socket.id ? "b" : "w";

          io.to(roomId).emit("player-disconnected", {
            winner,
          });

          setTimeout(() => cleanUpRoom(roomId), 10000);

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
