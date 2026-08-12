import React, { useEffect, useRef, useState } from "react";
import { socket } from "../services/socket.service";

// Matchmaking modal — replaces the old "create room / join room" code-sharing
// flow. Clicking "New Game" drops the player into a matchmaking pool (keyed
// by time control + rated setting) and the server pairs them with the
// closest-rated waiting opponent (or, if nobody is waiting, with whoever
// joins next). A roomId is still generated behind the scenes exactly like
// before, it's just no longer something the players have to exchange.
const MultiplayerTester = ({
  activeUser,
  timeControl,
  isRated = true,
  onClose,
  onGameStarted,
  setMultiplayerBlackTime,
  setMultiplayerWhiteTime,
}) => {
  const [status, setStatus] = useState("searching"); // "searching" | "matched" | "error"
  const [errorMsg, setErrorMsg] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const hasCancelledRef = useRef(false);

  useEffect(() => {
    const handleSearching = () => {
      setStatus("searching");
    };

    const handleGameStarted = (data) => {
      hasCancelledRef.current = true; // no need to cancel on unmount anymore
      const color = socket.id === data.white ? "white" : "black";

      setStatus("matched");

      onGameStarted({
        roomId: data.roomId,
        color,

        whiteName: data.whiteName,
        blackName: data.blackName,

        whiteAvatar: data.whiteAvatar || null,
        blackAvatar: data.blackAvatar || null,

        whiteRating: data.whiteRating || 1200,
        blackRating: data.blackRating || 1200,

        whiteId: data.whiteUserId,
        blackId: data.blackUserId,

        timeControl: data.timeControl,

        whiteTimeRemaining: data.whiteTimeRemaining,
        blackTimeRemaining: data.blackTimeRemaining,

        isRated: data.isRated ?? isRated,
      });
    };

    const handleClockUpdate = (data) => {
      setMultiplayerWhiteTime(data.whiteTimeRemaining);
      setMultiplayerBlackTime(data.blackTimeRemaining);
    };

    const handleRoomError = (msg) => {
      setStatus("error");
      setErrorMsg(typeof msg === "string" ? msg : "Something went wrong.");
    };

    const handleAlreadyActive = () => {
      setStatus("error");
      setErrorMsg(
        "Matchmaking is already in progress in another window or tab.",
      );
    };

    socket.on("searching-match", handleSearching);
    socket.on("game-started", handleGameStarted);
    socket.on("clock-update", handleClockUpdate);
    socket.on("room-error", handleRoomError);
    socket.on("matchmaking-already-active", handleAlreadyActive);

    // Enter the matchmaking pool as soon as the modal opens.
    socket.emit("find-match", {
      username: activeUser.username,
      avatar: activeUser.avatar || null,
      rating: activeUser.stats,
      timeControl,
      isRated,
    });

    return () => {
      socket.off("searching-match", handleSearching);
      socket.off("game-started", handleGameStarted);
      socket.off("clock-update", handleClockUpdate);
      socket.off("room-error", handleRoomError);
      socket.off("matchmaking-already-active", handleAlreadyActive);

      // Leave the queue if the modal closes before a match was found.
      if (!hasCancelledRef.current) {
        socket.emit("cancel-matchmaking");
      }
    };
  }, []);

  useEffect(() => {
    if (status !== "searching") return;
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [status]);

  const handleCancel = () => {
    hasCancelledRef.current = true;
    socket.emit("cancel-matchmaking");
    onClose();
  };

  const formattedTime = `${Math.floor(elapsedSeconds / 60)
    .toString()
    .padStart(2, "0")}:${(elapsedSeconds % 60).toString().padStart(2, "0")}`;

  return (
    <div className="relative bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4 w-sm text-center">
      <button
        onClick={handleCancel}
        className="absolute top-2 right-2 text-zinc-400 hover:text-white cursor-pointer"
      >
        ✕
      </button>

      <h3 className="font-semibold text-lg">
        {status === "error" ? "Matchmaking" : "Finding an Opponent"}
      </h3>

      {status === "searching" && (
        <>
          <div className="flex justify-center py-4">
            <div className="w-10 h-10 border-4 border-zinc-700 border-t-emerald-500 rounded-full animate-spin" />
          </div>
          <p className="text-zinc-400 text-sm">
            Matching you with a player near your rating…
          </p>
          <p className="text-zinc-500 text-xs font-mono">{formattedTime}</p>
          <button
            onClick={handleCancel}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg cursor-pointer text-sm"
          >
            Cancel
          </button>
        </>
      )}

      {status === "matched" && (
        <p className="text-green-400 text-sm">Opponent found — starting game…</p>
      )}

      {status === "error" && (
        <>
          <p className="text-red-400 text-sm">{errorMsg}</p>
          <button
            onClick={handleCancel}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg cursor-pointer text-sm"
          >
            Close
          </button>
        </>
      )}
    </div>
  );
};

export default MultiplayerTester;