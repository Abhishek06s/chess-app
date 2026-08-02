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

export const CHALLENGE_TTL_MS = 15000;

/**
 * Central place for everything that shows up in the notification bell
*/

export const NotificationProvider = ({ children }) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Floating top-of-screen challenge toasts (15s TTL)
  const [activeChallenges, setActiveChallenges] = useState([]);
  // Persistent bell notifications: friend requests (until actioned) +
  // expired/auto-declined challenges (until the site is closed/reloaded)
  const [notifications, setNotifications] = useState([]);

  // Reset everything on logout, and seed pending friend requests on login.
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setActiveChallenges([]);
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

    const moveChallengeToNotifications = (challenge) => {
      setNotifications((prev) => {
        if (
          prev.some(
            (n) =>
              n.type === "challenge" && n.challengeId === challenge.challengeId,
          )
        )
          return prev;
        return [
          {
            id: `challenge_${challenge.challengeId}`,
            type: "challenge",
            challengeId: challenge.challengeId,
            challenger: challenge.challenger,
            isRated: challenge.isRated,
            timeControl: challenge.timeControl,
            gameType: challenge.gameType,
            receivedAt: Date.now(),
          },
          ...prev,
        ];
      });
    };

    // Challenge auto-expired server-side with no response -> default
    // reject. If the toast was still showing (i.e. nobody had already
    // accepted/declined it), surface a read-only record in the bell.
    const handleExpired = ({ challengeId }) => {
      setActiveChallenges((prev) => {
        const found = prev.find((c) => c.challengeId === challengeId);
        if (found && !found.responding) {
          moveChallengeToNotifications(found);
        }
        return prev.filter((c) => c.challengeId !== challengeId);
      });
    };

    const handleSent = () => toast.success("Challenge sent");

    const handleDeclined = ({ targetUsername }) => {
      toast.error(`${targetUsername || "Opponent"} declined your challenge`);
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
    };

    socket.on("challenge-received", handleChallengeReceived);
    socket.on("challenge-expired", handleExpired);
    socket.on("challenge-sent", handleSent);
    socket.on("challenge-declined", handleDeclined);
    socket.on("challenge-error", handleChallengeError);
    socket.on("game-started", handleGameStarted);
    socket.on("friend-request-received", addFriendRequestNotification);
    socket.on("friend-request-accepted", handleFriendRequestAccepted);

    return () => {
      socket.off("challenge-received", handleChallengeReceived);
      socket.off("challenge-expired", handleExpired);
      socket.off("challenge-sent", handleSent);
      socket.off("challenge-declined", handleDeclined);
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
      }
    },
    [user],
  );

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

  // "Clear notifications" = reject every still-open challenge toast AND
  // every pending friend request, then wipe the bell.
  const clearAll = useCallback(async () => {
    activeChallenges.forEach((c) => {
      if (!c.responding) respondChallenge(c.challengeId, false);
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
    if (pendingFriendRequests.length > 0 || activeChallenges.length > 0) {
      toast.success("Notifications cleared");
    }
  }, [activeChallenges, notifications, respondChallenge, rejectFriend]);

  const unreadCount = notifications.length;

  const value = {
    activeChallenges,
    notifications,
    unreadCount,
    respondChallenge,
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
