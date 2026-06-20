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

        whiteRating: rating?.[gameType]?.rating || 1200,
        blackRating: null,
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
      io.to(roomId).emit("game-started", {
        roomId,
        white: room.white,
        black: room.black,
        whiteName: room.whiteName,
        blackName: room.blackName,
        whiteRating: room.whiteRating,
        blackRating: room.blackRating,
        gameType: room.gameType,
      });
      console.log(`Player joined ${roomId}`);
    });

    socket.on("move", ({ roomId, move }) => {
      socket.to(roomId).emit("opponent-move", move);
    });
  });
};

const getIO = () => io;

module.exports = {
  initializeSocket,
  getIO,
};
