const { Server } = require("socket.io");

const rooms = {};
let io;

function getGameType(base, increment) {
  const total = base + increment * 40;

  if (total < 180) return "bullet";
  if (total < 600) return "blitz";
  return "rapid";
}

const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: "http://localhost:5173",
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log("User Connected:", socket.id);

    setInterval(() => {
      for (const roomId in rooms) {
        const room = rooms[roomId];

        if (!room.lastMoveTime) continue;
        if (room.gameOver) continue;

        const now = Date.now();
        const elapsed = now - room.lastMoveTime;

        let whiteTime = room.whiteTimeRemaining;
        let blackTime = room.blackTimeRemaining;

        if (room.activeColor === "w") {
          whiteTime = Math.max(0, room.whiteTimeRemaining - elapsed);

          if (whiteTime === 0) {
            room.gameOver = true;
          }
        } else {
          blackTime = Math.max(0, room.blackTimeRemaining - elapsed);

          if (blackTime === 0) {
            room.gameOver = true;
          }
        }

        io.to(roomId).emit("clock-update", {
          whiteTimeRemaining: whiteTime,
          blackTimeRemaining: blackTime,
          activeColor: room.activeColor,
        });
      }
    }, 100);

    socket.on("ping-test", (message) => {
      console.log(message);
    });

    socket.on("disconnect", () => {
      console.log("User Disconnected:", socket.id);
    });

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
      };

      socket.join(roomId);
      socket.emit("room-created", roomId);
      console.log(`Room Created: ${roomId}`);
    });

    socket.on("join-room", ({ roomId, username, rating }) => {
      const room = rooms[roomId];

      if (!room) {
        return socket.emit("room-error", "Room not found");
      }

      if (room.black) {
        return socket.emit("room-error", "Room full");
      }

      room.black = socket.id;
      room.blackName = username;
      room.blackRating = rating?.[room.gameType]?.rating || 1200;

      socket.join(roomId);
      room.lastMoveTime = Date.now();

      io.to(roomId).emit("game-started", {
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
      console.log(`Player joined ${roomId}`);
    });

    socket.on("move", ({ roomId, move }) => {
      const room = rooms[roomId];

      if (!room) return;

      const now = Date.now();
      const elapsed = now - room.lastMoveTime;

      if (room.activeColor === "w") {
        room.whiteTimeRemaining -= elapsed;
        room.whiteTimeRemaining += room.timeControl.increment * 1000;

        if (room.whiteTimeRemaining < 0) {
          room.whiteTimeRemaining = 0;
        }

        room.activeColor = "b";
      } else {
        room.blackTimeRemaining -= elapsed;
        room.blackTimeRemaining += room.timeControl.increment * 1000;

        if (room.blackTimeRemaining < 0) {
          room.blackTimeRemaining = 0;
        }

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

    socket.on("game-over", ({ roomId }) => {
      const room = rooms[roomId];

      if (!room) return;

      room.gameOver = true;
    });
  });
};

const getIO = () => io;

module.exports = {
  initializeSocket,
  getIO,
};
