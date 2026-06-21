import React, { useState, useEffect } from "react";
import { socket } from "../services/socket.service";

const MultiplayerTester = ({
  activeUser,
  timeControl,
  onClose,
  onGameStarted,
  setMultiplayerBlackTime,
  setMultiplayerWhiteTime,
}) => {
  const [roomCode, setRoomCode] = useState("");
  const [createdRoom, setCreatedRoom] = useState("");
  const [playerColor, setPlayerColor] = useState("");
  const [currentRoom, setCurrentRoom] = useState("");
  const [gameStarted, setGameStarted] = useState(false);

  useEffect(() => {
    socket.on("room-created", (roomId) => {
      setCreatedRoom(roomId);
      setCurrentRoom(roomId);
      console.log("Room:", roomId);
    });

    socket.on("game-started", (data) => {
      const color = socket.id === data.white ? "white" : "black";

      setPlayerColor(color);
      setGameStarted(true);

      onGameStarted({
        roomId: data.roomId,
        color,

        whiteName: data.whiteName,
        blackName: data.blackName,

        whiteRating: data.whiteRating || 1200,
        blackRating: data.blackRating || 1200,

        whiteId: data.white,
        blackId: data.black,

        timeControl: data.timeControl,

        whiteTimeRemaining: data.whiteTimeRemaining,
        blackTimeRemaining: data.blackTimeRemaining,
      });
    });

    socket.on(
      "opponent-move",
      ({ move, whiteTimeRemaining, blackTimeRemaining, activeColor }) => {
        console.log("Opponent Move:", move);
      },
    );

    socket.on("clock-update", (data) => {
      setMultiplayerWhiteTime(data.whiteTimeRemaining);
      setMultiplayerBlackTime(data.blackTimeRemaining);
    });

    socket.on("room-error", (msg) => {
      console.log(msg);
    });

    return () => {
      socket.off("room-created");
      socket.off("game-started");
      socket.off("opponent-move");
      socket.off("room-error");
    };
  }, []);

  return (
    <div className="relative bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3 w-xl">
      <button
        onClick={onClose}
        className="absolute top-2 right-2 text-zinc-400 hover:text-white cursor-pointer"
      >
        ✕
      </button>
      <h3 className="font-semibold">Multiplayer Testing</h3>

      {createdRoom && <p className="text-green-400">Room: {createdRoom}</p>}

      <input
        type="text"
        value={roomCode}
        onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
        placeholder="Enter Room Code"
        className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg px-3 py-2"
      />

      <div className="flex gap-2">
        <button
          onClick={() =>
            socket.emit("create-room", {
              username: activeUser.username,
              rating: activeUser.stats,
              timeControl,
            })
          }
          className="px-3 py-2 bg-indigo-600 rounded-lg cursor-pointer"
        >
          Create Room
        </button>

        <button
          onClick={() =>
            socket.emit("join-room", {
              roomId: roomCode,
              username: activeUser.username,
              rating: activeUser.stats,
            })
          }
          className="px-3 py-2 bg-emerald-600 rounded-lg cursor-pointer"
        >
          Join Room
        </button>
      </div>

      <div>
        {gameStarted && <p className="text-green-400 m-1">Match Started</p>}

        {playerColor && (
          <p className="text-yellow-400 m-1">
            You are playing as {playerColor}
          </p>
        )}
      </div>
    </div>
  );
};

export default MultiplayerTester;
