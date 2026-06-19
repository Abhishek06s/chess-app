const { Server } = require("socket.io");

const rooms = {};
let io;

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

    socket.on("create-room", () => {
      const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();

      rooms[roomId] = {
        white: socket.id,
        black: null,
      };

      socket.join(roomId);
      socket.emit("room-created", roomId);
      console.log(`Room Created: ${roomId}`);
    });

    socket.on("join-room", (roomId) => {
      const room = rooms[roomId];

      if (!room) {
        return socket.emit("room-error", "Room not found");
      }

      if (room.black) {
        return socket.emit("room-error", "Room full");
      }

      room.black = socket.id;
      socket.join(roomId);
      io.to(roomId).emit("player-joined");
      console.log(`Player joined ${roomId}`);
    });
  });
};

const getIO = () => io;

module.exports = {
  initializeSocket,
  getIO,
};
