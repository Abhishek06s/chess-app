import React, { useState, useEffect } from "react";
import { socket } from "../services/socket.service";

const MultiplayerTester = () => {
  const [roomCode, setRoomCode] = useState("");
  const [createdRoom, setCreatedRoom] = useState("");

  useEffect(() => {
    socket.on("room-created", (roomId) => {
      setCreatedRoom(roomId);
      console.log("Room:", roomId);
    });

    socket.on("player-joined", () => {
      console.log("Opponent Joined");
    });

    socket.on("room-error", (msg) => {
      console.log(msg);
    });

    return () => {
      socket.off("room-created");
      socket.off("player-joined");
      socket.off("room-error");
    };
  }, []);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
      <h3 className="font-semibold">Multiplayer Testing</h3>

      {createdRoom && (
        <p className="text-green-400">
          Room: {createdRoom}
        </p>
      )}

      <input
        type="text"
        value={roomCode}
        onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
        placeholder="Enter Room Code"
        className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg px-3 py-2"
      />

      <div className="flex gap-2">
        <button
          onClick={() => socket.emit("create-room")}
          className="px-3 py-2 bg-indigo-600 rounded-lg"
        >
          Create Room
        </button>

        <button
          onClick={() => socket.emit("join-room", roomCode)}
          className="px-3 py-2 bg-emerald-600 rounded-lg"
        >
          Join Room
        </button>
      </div>
    </div>
  );
};

export default MultiplayerTester;