import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { socket } from "../services/socket.service";
import { useAuth } from "./authContext";
import {
  getPendingRequests,
  acceptFriendRequest,
  rejectFriendRequest,
} from "../services/user.service";

const NotificationContext = createContext(null);

// Phase 1: floating top-of-screen toast with a visible countdown.
export const CHALLENGE_TOAST_MS = 15000;
// Phase 2: if still unanswered, it persists (still respondable) in the
// notification bell for this much longer before finally auto-declining.
export const CHALLENGE_BELL_MS = 45000;
// Total lifetime of a challenge, and how long the challenger's own
// "challenge sent" banner stays up for.
export const CHALLENGE_TTL_MS = CHALLENGE_TOAST_MS + CHALLENGE_BELL_MS;

/**
 * Central place for everything that shows up in the notification bell
*/

export const NotificationProvider = ({ children }) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Floating top-of-screen challenge toasts (15s toast phase)
  const [activeChallenges, setActiveChallenges] = useState([]);
  // Persistent bell notifications: friend requests (until actioned),
  // still-pending challenges that outlived their toast (until actioned or
  // auto-declined), and declined challenges (until the bell is cleared)
  const [notifications, setNotifications] = useState([]);
  // The single outstanding challenge THIS user has sent, if any — powers
  // the "challenge sent" banner with its own 60s timer + cancel option.
  const [sentChallenge, setSentChallenge] = useState(null);

  // Reset everything on logout, and seed pending friend requests on login.
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setActiveChallenges([]);
      setSentChallenge(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await getPendingRequests();
        if (cancelled) return;
        const requests = (res.requests || []).map((r) => ({
          id: `friend_${r._id}`,
          type: "friend_request",
          userId: r._id,
          username: r.username,
          stats: r.stats,
          receivedAt: Date.now(),
        }));
        setNotifications((prev) => [
          ...requests,
          ...prev.filter(
            (n) =>
              n.type !== "friend_request" ||
              !requests.some((r) => r.userId === n.userId),
          ),
        ]);
      } catch {
        // Not fatal — bell just starts empty and fills in via sockets.
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]);

  useEffect(() => {
    if (!user) return;

    const addFriendRequestNotification = ({ from } = {}) => {
      if (!from?._id) return;
      setNotifications((prev) => {
        if (
          prev.some((n) => n.type === "friend_request" && n.userId === from._id)
        )
          return prev;
        return [
          {
            id: `friend_${from._id}`,
            type: "friend_request",
            userId: from._id,
            username: from.username,
            stats: from.stats,
            receivedAt: Date.now(),
          },
          ...prev,
        ];
      });
      toast.success(`${from.username} sent you a friend request`);
    };

    const handleFriendRequestAccepted = ({ by } = {}) => {
      if (by?.username)
        toast.success(`${by.username} accepted your friend request`);
    };

    const handleChallengeReceived = (data) => {
      setActiveChallenges((prev) => {
        if (prev.some((c) => c.challengeId === data.challengeId)) return prev;
        return [...prev, { ...data, receivedAt: Date.now() }];
      });
    };

    // Phase 1 -> Phase 2: the floating toast window elapsed with no
    // response. Move it into the bell as a STILL-PENDING entry (not yet
    // declined) — it stays actionable there for the remaining grace period.
    const handleChallengeToastExpired = ({ challengeId } = {}) => {
      setActiveChallenges((prev) => {
        const found = prev.find((c) => c.challengeId === challengeId);
        if (found && !found.responding) {
          setNotifications((prevNotifications) => {
            if (
              prevNotifications.some(
                (n) => n.type === "challenge" && n.challengeId === challengeId,
              )
            )
              return prevNotifications;
            return [
              {
                id: `challenge_${challengeId}`,
                type: "challenge",
                status: "pending",
                challengeId,
                challenger: found.challenger,
                isRated: found.isRated,
                timeControl: found.timeControl,
                gameType: found.gameType,
                receivedAt: found.receivedAt,
                movedToBellAt: Date.now(),
              },
              ...prevNotifications,
            ];
          });
        }
        return prev.filter((c) => c.challengeId !== challengeId);
      });
    };

    // Phase 2 ends: nobody responded within the FULL window — flip the
    // bell entry (if still there) from "pending" to a permanent "declined"
    // record, the same way an actively-declined challenge would look.
    const handleFinalExpired = ({ challengeId } = {}) => {
      setNotifications((prev) =>
        prev.map((n) =>
          n.type === "challenge" && n.challengeId === challengeId
            ? { ...n, status: "declined" }
            : n,
        ),
      );
      // Safety net in case this tab never saw the toast->bell transition.
      setActiveChallenges((prev) =>
        prev.filter((c) => c.challengeId !== challengeId),
      );
    };

    // Challenge withdrawn or otherwise force-removed (challenger cancelled
    // it, challenger disconnected, or we ourselves just started a
    // different game) — drop it silently, wherever it currently lives.
    const handleChallengeRemoved = ({ challengeId } = {}) => {
      setActiveChallenges((prev) =>
        prev.filter((c) => c.challengeId !== challengeId),
      );
      setNotifications((prev) =>
        prev.filter(
          (n) => !(n.type === "challenge" && n.challengeId === challengeId),
        ),
      );
      // Also covers our own sent challenge being withdrawn server-side
      // (e.g. we started a different game elsewhere) — drop the "waiting
      // for a response" banner silently, no toast.
      setSentChallenge((prev) =>
        prev && prev.challengeId === challengeId ? null : prev,
      );
    };

    const handleSent = (data = {}) => {
      toast.success("Challenge sent");
      setSentChallenge({ ...data, sentAt: data.sentAt || Date.now() });
    };

    // Fires for every rejection path: active decline, the 60s timeout,
    // the target closing their browser, or the target starting a new game.
    const handleDeclined = ({ challengeId, targetUsername, auto, reason } = {}) => {
      const name = targetUsername || "Opponent";
      let message;
      if (!auto) {
        message = `${name} declined your challenge`;
      } else if (reason === "offline") {
        message = `${name} has gone offline`;
      } else {
        message = `${name} didn't respond in time — challenge cancelled`;
      }
      toast.error(message);
      setSentChallenge((prev) =>
        prev && prev.challengeId === challengeId ? null : prev,
      );
    };

    // Confirms our own cancel-challenge request went through.
    const handleChallengeCancelled = ({ challengeId } = {}) => {
      setSentChallenge((prev) =>
        prev && prev.challengeId === challengeId ? null : prev,
      );
      toast.success("Challenge cancelled");
    };

    const handleChallengeError = ({ message } = {}) => {
      toast.error(message || "Something went wrong with that challenge");
      setActiveChallenges((prev) => prev.filter((c) => !c.responding));
    };

    const handleGameStarted = (data) => {
      const color = socket.id === data.white ? "white" : "black";

      navigate("/play", {
        state: {
          multiplayerGameStart: {
            roomId: data.roomId,
            color,
            whiteName: data.whiteName,
            blackName: data.blackName,
            whiteRating: data.whiteRating || 1200,
            blackRating: data.blackRating || 1200,
            whiteId: data.whiteUserId,
            blackId: data.blackUserId,
            timeControl: data.timeControl,
            whiteTimeRemaining: data.whiteTimeRemaining,
            blackTimeRemaining: data.blackTimeRemaining,
            isRated: data.isRated,
          },
          navKey: `${data.roomId}-${Date.now()}`,
        },
      });

      setActiveChallenges((prev) =>
        prev.filter(
          (c) =>
            c.challenger?.userId !== data.whiteUserId &&
            c.challenger?.userId !== data.blackUserId,
        ),
      );
      setNotifications((prev) =>
        prev.filter(
          (n) =>
            !(
              n.type === "challenge" &&
              (n.challenger?.userId === data.whiteUserId ||
                n.challenger?.userId === data.blackUserId)
            ),
        ),
      );
      setSentChallenge((prev) =>
        prev &&
        (prev.targetUserId === data.whiteUserId ||
          prev.targetUserId === data.blackUserId)
          ? null
          : prev,
      );
    };

    socket.on("challenge-received", handleChallengeReceived);
    socket.on("challenge-toast-expired", handleChallengeToastExpired);
    socket.on("challenge-expired", handleFinalExpired);
    socket.on("challenge-removed", handleChallengeRemoved);
    socket.on("challenge-sent", handleSent);
    socket.on("challenge-declined", handleDeclined);
    socket.on("challenge-cancelled", handleChallengeCancelled);
    socket.on("challenge-error", handleChallengeError);
    socket.on("game-started", handleGameStarted);
    socket.on("friend-request-received", addFriendRequestNotification);
    socket.on("friend-request-accepted", handleFriendRequestAccepted);

    return () => {
      socket.off("challenge-received", handleChallengeReceived);
      socket.off("challenge-toast-expired", handleChallengeToastExpired);
      socket.off("challenge-expired", handleFinalExpired);
      socket.off("challenge-removed", handleChallengeRemoved);
      socket.off("challenge-sent", handleSent);
      socket.off("challenge-declined", handleDeclined);
      socket.off("challenge-cancelled", handleChallengeCancelled);
      socket.off("challenge-error", handleChallengeError);
      socket.off("game-started", handleGameStarted);
      socket.off("friend-request-received", addFriendRequestNotification);
      socket.off("friend-request-accepted", handleFriendRequestAccepted);
    };
  }, [user, navigate]);

  const respondChallenge = useCallback(
    (challengeId, accepted) => {
      setActiveChallenges((prev) =>
        prev.map((c) =>
          c.challengeId === challengeId ? { ...c, responding: true } : c,
        ),
      );
      setNotifications((prev) =>
        prev.map((n) =>
          n.type === "challenge" && n.challengeId === challengeId
            ? { ...n, responding: true }
            : n,
        ),
      );
      socket.emit("respond-challenge", {
        challengeId,
        accepted,
        username: user?.username,
        rating: user?.stats,
      });
      if (!accepted) {
        setActiveChallenges((prev) =>
          prev.filter((c) => c.challengeId !== challengeId),
        );
        setNotifications((prev) =>
          prev.filter(
            (n) => !(n.type === "challenge" && n.challengeId === challengeId),
          ),
        );
      }
    },
    [user],
  );

  // Challenger backing out of their own outstanding sent challenge. This
  // also removes it from the other user's notification section.
  const cancelChallenge = useCallback((challengeId) => {
    if (!challengeId) return;
    socket.emit("cancel-challenge", { challengeId });
  }, []);

  const acceptFriend = useCallback(async (userId) => {
    try {
      await acceptFriendRequest(userId);
      setNotifications((prev) =>
        prev.filter(
          (n) => !(n.type === "friend_request" && n.userId === userId),
        ),
      );
      toast.success("Friend request accepted");
    } catch (err) {
      toast.error(
        err?.response?.data?.message || "Failed to accept friend request",
      );
    }
  }, []);

  const rejectFriend = useCallback(async (userId, { silent = false } = {}) => {
    try {
      await rejectFriendRequest(userId);
      setNotifications((prev) =>
        prev.filter(
          (n) => !(n.type === "friend_request" && n.userId === userId),
        ),
      );
      if (!silent) toast.success("Friend request declined");
    } catch (err) {
      if (!silent) {
        toast.error(
          err?.response?.data?.message || "Failed to decline friend request",
        );
      }
    }
  }, []);

  // "Clear notifications" = reject every still-open challenge (toast or
  // still-pending bell entry) AND every pending friend request, then wipe
  // the bell. Does NOT touch our own outgoing "challenge sent" banner.
  const clearAll = useCallback(async () => {
    activeChallenges.forEach((c) => {
      if (!c.responding) respondChallenge(c.challengeId, false);
    });

    const pendingBellChallenges = notifications.filter(
      (n) => n.type === "challenge" && n.status === "pending",
    );
    pendingBellChallenges.forEach((n) => {
      if (!n.responding) respondChallenge(n.challengeId, false);
    });

    const pendingFriendRequests = notifications.filter(
      (n) => n.type === "friend_request",
    );

    await Promise.all(
      pendingFriendRequests.map((n) =>
        rejectFriend(n.userId, { silent: true }),
      ),
    );

    setNotifications([]);
    if (
      pendingFriendRequests.length > 0 ||
      activeChallenges.length > 0 ||
      pendingBellChallenges.length > 0
    ) {
      toast.success("Notifications cleared");
    }
  }, [activeChallenges, notifications, respondChallenge, rejectFriend]);

  const unreadCount = notifications.length;

  const value = {
    activeChallenges,
    notifications,
    unreadCount,
    sentChallenge,
    respondChallenge,
    cancelChallenge,
    acceptFriend,
    rejectFriend,
    clearAll,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationContext);