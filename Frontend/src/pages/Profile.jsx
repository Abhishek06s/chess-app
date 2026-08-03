import React, { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getProfile,
  getUserByUsername,
  searchUsers,
  getPendingRequests,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  removeFriend,
} from "../services/user.service";
import { getMyGames, getGamesByUserId } from "../services/game.service";
import { useAuth } from "../context/authContext";
import { socket } from "../services/socket.service";
import usePresence from "../hooks/usePresence";
import StatusIndicator from "../components/StatusIndicator";
import { ChallengeButton, ChallengeModal } from "../components/Challenge";
import { getHighestElo } from "../utils/highestElo";
import {
  Trophy,
  Swords,
  Target,
  Hash,
  Mail,
  Star,
  ChevronDown,
  ChevronUp,
  Sword,
  Calendar,
  ExternalLink,
  Clock,
  ArrowUpRight,
  Bot,
  Users,
  UserPlus,
  UserMinus,
  UserCheck,
  Search,
  Check,
  X,
  Bell,
  Loader2,
} from "lucide-react";

const formatGameDate = (dateString) => {
  if (!dateString) return "";

  const date = new Date(dateString);

  if (isNaN(date.getTime())) {
    console.warn("Invalid date provided:", dateString);
    return "Invalid date";
  }

  const now = new Date();
  const diffInMs = now - date;

  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInMinutes < 1) return "Just now";
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  if (diffInHours < 24) return `${diffInHours}h ago`;
  if (diffInDays < 7) return `${diffInDays}d ago`;

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const formatTimeControl = (timeControl) => {
  if (!timeControl) return "";
  const minutes = timeControl.base / 60;
  const increment = timeControl.increment;
  return `${minutes}+${increment}`;
};

const getResultDetails = (game, userId) => {
  const isWhite =
    game.whitePlayer?._id === userId || game.whitePlayer === userId;

  if (game.result === "1/2-1/2") {
    return {
      text: "Draw",
      bg: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
      bar: "bg-zinc-500/60",
      glow: "",
      isWhite,
    };
  }

  const userWon =
    (game.result === "1-0" && isWhite) || (game.result === "0-1" && !isWhite);

  return userWon
    ? {
        text: "Victory",
        bg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        bar: "bg-emerald-500/60",
        glow: "",
        isWhite,
      }
    : {
        text: "Defeat",
        bg: "bg-rose-500/10 text-rose-400 border-rose-500/20",
        bar: "bg-rose-500/60",
        glow: "",
        isWhite,
      };
};

const getOpponent = (game, userId) => {
  if (game.opponentType === "bot") {
    return { username: game.opponentName || "Stockfish Bot", isBot: true };
  }

  const matchesUser = (player) =>
    player && (player._id === userId || player === userId);

  if (game.player1 && game.player2) {
    return matchesUser(game.player1) ? game.player2 : game.player1;
  }

  if (game.whitePlayer && game.blackPlayer) {
    return matchesUser(game.whitePlayer) ? game.blackPlayer : game.whitePlayer;
  }

  return game.opponentName
    ? { username: game.opponentName, isBot: false }
    : null;
};

const terminationLabels = {
  checkmate: "Checkmate",
  timeout: "Time Out",
  resignation: "Resignation",
  draw: "Draw",
  stalemate: "Stalemate",
  "insufficient-material": "Insufficient Material",
  "threefold-repetition": "Threefold Repetition",
};

const ToastStack = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 items-end">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          onClick={() => onDismiss(toast.id)}
          className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-2xl backdrop-blur-sm cursor-pointer animate-in fade-in slide-in-from-bottom-2 duration-200 ${
            toast.type === "error"
              ? "bg-rose-950/90 border-rose-500/30 text-rose-200"
              : "bg-emerald-950/90 border-emerald-500/30 text-emerald-200"
          }`}
        >
          {toast.type === "error" ? (
            <X className="w-4 h-4 shrink-0" />
          ) : (
            <Check className="w-4 h-4 shrink-0" />
          )}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      ))}
    </div>
  );
};

const Profile = () => {
  const navigate = useNavigate();
  const { username } = useParams();
  const isPublicProfile = !!username;
  const { user: authUser } = useAuth();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState("rapid");

  // Game states
  const [games, setGames] = useState([]);
  const [showGames, setShowGames] = useState(false);
  const [visibleGames, setVisibleGames] = useState(10);

  // Friend states
  const [friends, setFriends] = useState([]);
  const [showFriends, setShowFriends] = useState(false);

  // Add-friend search states
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [requestingIds, setRequestingIds] = useState([]);

  // Pending friend request states
  const [pendingRequests, setPendingRequests] = useState([]);
  const [showPendingRequests, setShowPendingRequests] = useState(false);
  const [requestActionIds, setRequestActionIds] = useState([]);

  // Toasts
  const [toasts, setToasts] = useState([]);

  // Challenge popup — the user currently being challenged (or null if closed)
  const [challengeTarget, setChallengeTarget] = useState(null);

  // Live presence (online / offline / in-game) for the friends list, the
  // "search & add friends" results, and — when viewing someone else's
  // profile — the profile owner themself.
  const isViewingSelf =
    isPublicProfile && authUser && user && authUser._id === user._id;

  const presenceIds = useMemo(() => {
    const ids = new Set();
    friends.forEach((friend) => friend._id && ids.add(friend._id));
    searchResults.forEach((result) => result._id && ids.add(result._id));
    if (isPublicProfile && user?._id && !isViewingSelf) {
      ids.add(user._id);
    }
    return Array.from(ids);
  }, [friends, searchResults, user, isPublicProfile, isViewingSelf]);

  const statusMap = usePresence(presenceIds);

  const showToast = (message, type = "success") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  const dismissToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        let profileData;
        let gameData;

        if (username) {
          profileData = await getUserByUsername(username);
          if (profileData?.user) {
            gameData = await getGamesByUserId(profileData.user._id);
            setGames(gameData.games || []);
          }
        } else {
          profileData = await getProfile();
          gameData = await getMyGames();
          setGames(gameData.games || []);
        }

        if (profileData?.user) {
          setUser(profileData.user);
          setFriends(profileData.user.friends || []);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [username]);

  // Pending requests only apply to the logged-in user's own profile
  useEffect(() => {
    if (isPublicProfile) return;

    const fetchPendingRequests = async () => {
      try {
        const response = await getPendingRequests();
        setPendingRequests(response.requests || []);
      } catch (error) {
        console.error("Failed to fetch pending requests:", error);
      }
    };

    fetchPendingRequests();
  }, [isPublicProfile]);

  // Debounced live search for the "Add Friends" panel
  useEffect(() => {
    if (isPublicProfile || !searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    const timeout = setTimeout(async () => {
      try {
        const response = await searchUsers(searchQuery.trim());
        setSearchResults(response.users || []);
      } catch (error) {
        console.error("Failed to search users:", error);
      } finally {
        setSearchLoading(false);
      }
    }, 350);

    return () => clearTimeout(timeout);
  }, [searchQuery, isPublicProfile]);

  // Friend Handlers
  const handleSendRequest = async (targetUser) => {
    setRequestingIds((prev) => [...prev, targetUser._id]);
    try {
      await sendFriendRequest(targetUser._id);
      showToast(`Friend request sent to ${targetUser.username}`);
      setSearchResults((prev) =>
        prev.map((u) =>
          u._id === targetUser._id ? { ...u, requestSentByMe: true } : u,
        ),
      );
    } catch (error) {
      console.error("Failed to send friend request:", error);
      showToast(
        error?.response?.data?.message || "Failed to send friend request",
        "error",
      );
    } finally {
      setRequestingIds((prev) => prev.filter((id) => id !== targetUser._id));
    }
  };

  const handleAcceptRequest = async (requestUser) => {
    setRequestActionIds((prev) => [...prev, requestUser._id]);
    try {
      const response = await acceptFriendRequest(requestUser._id);
      setPendingRequests((prev) =>
        prev.filter((r) => r._id !== requestUser._id),
      );
      setFriends((prev) => [
        ...prev,
        response.friend || {
          _id: requestUser._id,
          username: requestUser.username,
        },
      ]);
      showToast(`You and ${requestUser.username} are now friends`);
    } catch (error) {
      console.error("Failed to accept friend request:", error);
      showToast(
        error?.response?.data?.message || "Failed to accept friend request",
        "error",
      );
    } finally {
      setRequestActionIds((prev) =>
        prev.filter((id) => id !== requestUser._id),
      );
    }
  };

  const handleRejectRequest = async (requestUser) => {
    setRequestActionIds((prev) => [...prev, requestUser._id]);
    try {
      await rejectFriendRequest(requestUser._id);
      setPendingRequests((prev) =>
        prev.filter((r) => r._id !== requestUser._id),
      );
      showToast(`Friend request from ${requestUser.username} rejected`);
    } catch (error) {
      console.error("Failed to reject friend request:", error);
      showToast(
        error?.response?.data?.message || "Failed to reject friend request",
        "error",
      );
    } finally {
      setRequestActionIds((prev) =>
        prev.filter((id) => id !== requestUser._id),
      );
    }
  };

  const handleRemoveFriend = async (friendId) => {
    try {
      await removeFriend(friendId);
      setFriends((prev) => prev.filter((f) => f._id !== friendId));
    } catch (error) {
      console.error("Failed to remove friend:", error);
      showToast("Failed to remove friend", "error");
    }
  };

  // Challenge Handlers
  const handleOpenChallenge = (targetUser) => {
    setChallengeTarget(targetUser);
  };

  const handleCloseChallenge = () => {
    setChallengeTarget(null);
  };

  const handleConfirmChallenge = ({ targetUser, rated, timeControl }) => {
    socket.emit("send-challenge", {
      targetUserId: targetUser._id,
      targetUsername: targetUser.username,
      username: authUser?.username,
      rating: authUser?.stats,
      timeControl,
      isRated: rated,
    });
    setChallengeTarget(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-zinc-400 font-medium animate-pulse">
          Loading your profile...
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-6 py-4 rounded-xl">
          Failed to load profile. Please try again later.
        </div>
      </div>
    );
  }

  const stats = user.stats[mode];

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-4 md:p-8 flex flex-col items-center justify-start gap-6">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <ChallengeModal
        isOpen={!!challengeTarget}
        targetUser={challengeTarget}
        onClose={handleCloseChallenge}
        onConfirm={handleConfirmChallenge}
      />

      {/* Profile Header Card */}
      <div className="w-full max-w-4xl bg-zinc-900/80 backdrop-blur-sm rounded-3xl overflow-hidden border border-zinc-800 shadow-2xl">
        <div className="h-36 bg-linear-to-r from-indigo-600 via-purple-600 to-emerald-600"></div>

        <div className="px-6 pb-6 md:px-8 md:pb-8 relative">
          <div className="flex flex-col md:flex-row items-center md:items-end justify-between gap-6 -mt-12 mb-8">
            <div className="flex flex-col md:flex-row items-center md:items-end gap-4 text-center md:text-left">
              <div className="bg-zinc-900 p-2 rounded-full border border-zinc-800 shadow-xl z-10">
                <div className="w-24 h-24 bg-linear-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-3xl font-bold uppercase shadow-inner">
                  {user.username.charAt(0)}
                </div>
              </div>

              <div className="space-y-1 md:-mb-1">
                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-linear-to-r from-white to-zinc-400 flex items-center flex-wrap gap-3">
                  {user.username}
                  {isPublicProfile && !isViewingSelf && (
                    <span className="-mt-1.5">
                      <StatusIndicator status={statusMap[user._id]} />
                    </span>
                  )}
                  {isPublicProfile && !isViewingSelf && (
                    <ChallengeButton
                      status={statusMap[user._id]}
                      onClick={() => handleOpenChallenge(user)}
                      className="mt-2"
                    />
                  )}
                </h1>
                <div className="flex items-center justify-center md:justify-start gap-2 text-zinc-400">
                  <Mail className="w-4 h-4" />
                  <span className="text-sm">{user.email}</span>
                </div>
                <p className="text-zinc-400/90 text-sm mt-2">
                  Joined {new Date(user.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="bg-zinc-800/50 px-6 py-3 rounded-2xl border border-zinc-700/50 flex items-center gap-3 mt-12.5 md:mb-2">
              <Star className="w-6 h-6 text-yellow-400 fill-yellow-400" />
              <div>
                <p className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">
                  {mode} Rating
                </p>
                <p className="text-2xl font-bold">{stats.rating}</p>
              </div>
            </div>
          </div>

          <div className="flex justify-center md:justify-start md:ml-1 gap-2 border-b border-zinc-800 pb-6">
            {["bullet", "blitz", "rapid"].map((gameMode) => (
              <button
                key={gameMode}
                onClick={() => setMode(gameMode)}
                className={`px-5 py-2 rounded-xl text-sm font-medium capitalize transition-all cursor-pointer duration-150 ${
                  mode === gameMode
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"
                    : "bg-zinc-800/60 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                }`}
              >
                {gameMode}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <StatCard
              icon={<Hash className="w-5 h-5 text-indigo-400" />}
              label="Games"
              value={stats.gamesPlayed}
              hoverClass="hover:border-indigo-500/50 hover:bg-indigo-500/5"
            />
            <StatCard
              icon={<Trophy className="w-5 h-5 text-emerald-400" />}
              label="Wins"
              value={stats.wins}
              valueClass="text-emerald-400"
              hoverClass="hover:border-emerald-500/50 hover:bg-emerald-500/5"
            />
            <StatCard
              icon={<Swords className="w-5 h-5 text-red-400" />}
              label="Losses"
              value={stats.losses}
              valueClass="text-red-400"
              hoverClass="hover:border-red-500/50 hover:bg-red-500/5"
            />
            <StatCard
              icon={<Target className="w-5 h-5 text-yellow-400" />}
              label="Draws"
              value={stats.draws}
              valueClass="text-yellow-400"
              hoverClass="hover:border-yellow-500/50 hover:bg-yellow-500/5"
            />
          </div>
        </div>
      </div>

      {/* Friend Requests Section — only visible on the logged-in user's own profile */}
      {!isPublicProfile && (
        <div className="w-full max-w-4xl">
          <div className="bg-zinc-900/60 backdrop-blur-md border border-zinc-800/80 rounded-3xl overflow-hidden shadow-xl mb-2">
            <button
              onClick={() => setShowPendingRequests(!showPendingRequests)}
              className="w-full flex items-center justify-between p-6 cursor-pointer hover:bg-zinc-800/20 transition-all duration-200"
            >
              <div className="flex items-center gap-3">
                <div className="relative p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                  <Bell className="w-5 h-5 text-amber-400" />
                  {pendingRequests.length > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-rose-500 text-white text-[10px] font-bold rounded-full border-2 border-zinc-900 shadow-md">
                      {pendingRequests.length > 9
                        ? "9+"
                        : pendingRequests.length}
                    </span>
                  )}
                </div>
                <div className="text-left">
                  <h2 className="text-xl font-bold text-zinc-100">
                    Friend Requests
                  </h2>
                  <p className="text-xs text-zinc-400 font-medium">
                    {pendingRequests.length === 0
                      ? "No pending requests"
                      : `${pendingRequests.length} pending ${
                          pendingRequests.length === 1 ? "request" : "requests"
                        }`}
                  </p>
                </div>
              </div>
              <div className="p-2 rounded-xl bg-zinc-800/60 border border-zinc-700/40 text-zinc-400">
                {showPendingRequests ? (
                  <ChevronUp className="w-5 h-5" />
                ) : (
                  <ChevronDown className="w-5 h-5" />
                )}
              </div>
            </button>

            {showPendingRequests && (
              <div className="border-t border-zinc-800/80 bg-zinc-950/40 p-4 md:p-6">
                {pendingRequests.length === 0 ? (
                  <div className="py-8 text-center text-zinc-500 flex flex-col items-center gap-2">
                    <Bell className="w-8 h-8 opacity-20" />
                    <p className="text-sm">You're all caught up.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {pendingRequests.map((requestUser) => {
                      const isActing = requestActionIds.includes(
                        requestUser._id,
                      );
                      return (
                        <div
                          key={requestUser._id}
                          className="flex items-center justify-between gap-3 p-3 bg-zinc-900/50 border border-zinc-800/70 rounded-xl"
                        >
                          <button
                            onClick={() =>
                              navigate(`/profile/${requestUser.username}`)
                            }
                            className="flex items-center gap-3 hover:opacity-80 transition-opacity flex-1 text-left min-w-0"
                          >
                            <div className="w-9 h-9 shrink-0 bg-linear-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 text-amber-400 rounded-full flex items-center justify-center font-bold text-sm uppercase shadow-inner">
                              {requestUser.username.charAt(0)}
                            </div>
                            <span className="min-w-0">
                              <span className="font-medium text-zinc-200 text-sm truncate block">
                                {requestUser.username}
                              </span>
                              {getHighestElo(requestUser.stats) !== null && (
                                <span className="block text-[11px] font-mono text-zinc-500">
                                  Highest Elo:{" "}
                                  <span className="text-zinc-400">
                                    {getHighestElo(requestUser.stats)}
                                  </span>
                                </span>
                              )}
                            </span>
                          </button>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => handleAcceptRequest(requestUser)}
                              disabled={isActing}
                              title="Accept"
                              className="p-2 bg-emerald-500/10 hover:bg-emerald-600 border border-emerald-500/30 hover:border-emerald-600 text-emerald-400 hover:text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            >
                              {isActing ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Check className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={() => handleRejectRequest(requestUser)}
                              disabled={isActing}
                              title="Reject"
                              className="p-2 bg-rose-500/10 hover:bg-rose-600 border border-rose-500/30 hover:border-rose-600 text-rose-400 hover:text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Friends Section */}
      <div className="w-full max-w-4xl">
        <div className="bg-zinc-900/60 backdrop-blur-md border border-zinc-800/80 rounded-3xl overflow-hidden shadow-xl mb-6">
          <button
            onClick={() => setShowFriends(!showFriends)}
            className="w-full flex items-center justify-between p-6 cursor-pointer hover:bg-zinc-800/20 transition-all duration-200"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <Users className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="text-left">
                <h2 className="text-xl font-bold text-zinc-100 mt-1">
                  Friends
                  <span className="text-xs text-zinc-300 font-xl -mt-2 ml-4 rounded-full px-2 py-0.5 bg-zinc-800/50 border border-zinc-700/40">
                    {friends.length}{" "}
                  </span>
                </h2>
              </div>
            </div>
            <div className="p-2 rounded-xl bg-zinc-800/60 border border-zinc-700/40 text-zinc-400">
              {showFriends ? (
                <ChevronUp className="w-5 h-5" />
              ) : (
                <ChevronDown className="w-5 h-5" />
              )}
            </div>
          </button>

          {showFriends && (
            <div className="border-t border-zinc-800/80 bg-zinc-950/40 p-4 md:p-6 space-y-6">
              {/* Sub-section: Search & Add Friends — only on the logged-in user's own profile */}
              {!isPublicProfile && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">
                    Search &amp; Add Friends
                  </h3>
                  <div className="relative mb-3">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input
                      type="text"
                      placeholder="Search by username..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-700/60 rounded-xl pl-10 pr-4 py-2.5 text-zinc-200 text-sm focus:outline-none focus:border-emerald-500/50 transition-colors placeholder:text-zinc-500"
                    />
                    {searchLoading && (
                      <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 animate-spin" />
                    )}
                  </div>

                  {searchQuery.trim() && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      {!searchLoading && searchResults.length === 0 ? (
                        <div className="col-span-full py-6 text-center text-zinc-500 text-sm">
                          No users found matching "{searchQuery}".
                        </div>
                      ) : (
                        searchResults.map((result) => {
                          const isRequesting = requestingIds.includes(
                            result._id,
                          );
                          return (
                            <div
                              key={result._id}
                              className="flex items-center justify-between gap-3 p-3 bg-zinc-900/50 border border-zinc-800/70 rounded-xl"
                            >
                              <button
                                onClick={() =>
                                  navigate(`/profile/${result.username}`)
                                }
                                className="flex items-center gap-3 hover:opacity-80 transition-opacity flex-1 text-left min-w-0"
                              >
                                <div className="w-9 h-9 shrink-0 bg-linear-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 text-indigo-400 rounded-full flex items-center justify-center font-bold text-sm uppercase shadow-inner">
                                  {result.username.charAt(0)}
                                </div>
                                <span className="min-w-0">
                                  <span className="flex items-center gap-2">
                                    <span className="font-medium text-zinc-200 text-sm truncate">
                                      {result.username}
                                    </span>
                                    <StatusIndicator
                                      status={statusMap[result._id]}
                                      className="ml-2 mt-1.5 shrink-0 whitespace-nowrap"
                                    />
                                  </span>
                                  {getHighestElo(result.stats) !== null && (
                                    <span className="block text-[11px] font-mono text-zinc-400">
                                      Rating:{" "}
                                      <span className="text-zinc-300">
                                        {getHighestElo(result.stats)}
                                      </span>
                                    </span>
                                  )}
                                </span>
                              </button>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <ChallengeButton
                                  status={statusMap[result._id]}
                                  onClick={() => handleOpenChallenge(result)}
                                />

                                {result.isFriend ? (
                                  <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-400">
                                    <UserCheck className="w-4 h-4" />
                                    Friends
                                  </span>
                                ) : result.requestSentByMe ? (
                                  <span className="px-3 py-1.5 text-xs font-medium text-zinc-500">
                                    Requested
                                  </span>
                                ) : result.requestReceivedFromThem ? (
                                  <span className="px-3 py-1.5 text-xs font-medium text-amber-400">
                                    Sent you a request
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => handleSendRequest(result)}
                                    disabled={isRequesting}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/10 hover:bg-emerald-600 border border-emerald-500/30 hover:border-emerald-600 text-emerald-400 hover:text-white rounded-lg font-medium text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                  >
                                    {isRequesting ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <UserPlus className="w-3.5 h-3.5" />
                                    )}
                                    Add
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Sub-section: Friends list */}
              <div>
                {!isPublicProfile && (
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">
                    Your Friends
                  </h3>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {friends.length === 0 ? (
                    <div className="col-span-full py-8 text-center text-zinc-500 flex flex-col items-center gap-2">
                      <Users className="w-8 h-8 opacity-20" />
                      <p className="text-sm">No friends added yet.</p>
                    </div>
                  ) : (
                    friends.map((friend) => (
                      <div
                        key={friend._id || friend.username}
                        className="flex items-center justify-between p-3 bg-zinc-900/50 border border-zinc-800/70 hover:border-zinc-700 rounded-xl transition-colors group"
                      >
                        <button
                          onClick={() =>
                            navigate(`/profile/${friend.username}`)
                          }
                          className="flex items-center gap-3 hover:opacity-80 transition-opacity flex-1 text-left min-w-0"
                        >
                          <div className="w-9 h-9 shrink-0 bg-linear-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 text-emerald-400 rounded-full flex items-center justify-center font-bold text-sm uppercase shadow-inner">
                            {friend.username.charAt(0)}
                          </div>
                          <span className="min-w-0">
                            <span className="flex items-center gap-2">
                              <span className="font-medium text-zinc-200 text-sm truncate cursor-pointer">
                                {friend.username}
                              </span>
                              <StatusIndicator
                                status={statusMap[friend._id]}
                                className="ml-2 mt-1.5 shrink-0 whitespace-nowrap"
                              />
                            </span>
                            {getHighestElo(friend.stats) !== null && (
                              <span className="block text-[11px] font-mono text-zinc-400">
                                Rating:{" "}
                                <span className="text-zinc-300">
                                  {getHighestElo(friend.stats)}
                                </span>
                              </span>
                            )}
                          </span>
                        </button>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <ChallengeButton
                            status={statusMap[friend._id]}
                            onClick={() => handleOpenChallenge(friend)}
                          />

                          {!isPublicProfile && (
                            <button
                              onClick={() => handleRemoveFriend(friend._id)}
                              className="p-2 text-zinc-600 hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                              title="Remove friend"
                            >
                              <UserMinus className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Game History Section */}
        <div className="bg-zinc-900/60 backdrop-blur-md border border-zinc-800/80 rounded-3xl overflow-hidden shadow-2xl">
          <button
            onClick={() => setShowGames(!showGames)}
            className="w-full flex items-center justify-between p-6 cursor-pointer hover:bg-zinc-800/20 transition-all duration-200"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
                <Sword className="w-5 h-5 text-indigo-400" />
              </div>
              <div className="text-left">
                <h2 className="text-xl font-bold text-zinc-100">
                  Game History
                </h2>
                <p className="text-xs text-zinc-400 font-medium">
                  Recent matches and analytical breakdown
                </p>
              </div>
            </div>
            <div className="p-2 rounded-xl bg-zinc-800/60 border border-zinc-700/40 text-zinc-400">
              {showGames ? (
                <ChevronUp className="w-5 h-5" />
              ) : (
                <ChevronDown className="w-5 h-5" />
              )}
            </div>
          </button>

          {showGames && (
            <div className="border-t border-zinc-800/80 bg-zinc-950/40">
              {games.length === 0 ? (
                <div className="p-16 text-center text-zinc-500 flex flex-col items-center gap-3">
                  <Swords className="w-10 h-10 opacity-30 text-zinc-400" />
                  <p className="font-medium">No recorded games found.</p>
                </div>
              ) : (
                <div className="p-4 md:p-6 space-y-3">
                  {games.slice(0, visibleGames).map((game) => {
                    const resultInfo = getResultDetails(game, user._id);
                    const opponent = getOpponent(game, user._id);
                    const termination =
                      terminationLabels[game.termination] || game.termination;

                    const opponentRating = resultInfo.isWhite
                      ? game.blackRating
                      : game.whiteRating;

                    const isBotGame = opponent?.isBot;

                    return (
                      <div
                        key={game._id}
                        className={`group relative overflow-hidden bg-zinc-900/40 border ${
                          isBotGame
                            ? "border-amber-500/20 hover:border-amber-500/40"
                            : "border-zinc-800/70 hover:border-indigo-500/30"
                        } ${resultInfo.glow} hover:bg-zinc-800/40 rounded-2xl transition-all duration-200 p-4 md:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4`}
                      >
                        <div
                          className={`absolute left-0 top-0 bottom-0 w-1 ${resultInfo.bar}`}
                        />

                        <div className="flex items-start md:items-center gap-4 pl-2">
                          <div
                            className={`p-3 rounded-xl border flex items-center justify-center font-bold text-lg ${
                              resultInfo.isWhite
                                ? "bg-zinc-100 text-zinc-900 border-white shadow-md"
                                : "bg-zinc-900 text-zinc-300 border-zinc-700 shadow-inner"
                            }`}
                            title={
                              resultInfo.isWhite
                                ? "Played as White"
                                : "Played as Black"
                            }
                          >
                            {resultInfo.isWhite ? "♔" : "♚"}
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2.5">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md border ${resultInfo.bg}`}
                                >
                                  {resultInfo.text}
                                </span>
                              </div>

                              <div
                                className={`flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md border ${
                                  isBotGame
                                    ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                    : "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                                }`}
                              >
                                {isBotGame ? (
                                  <>
                                    <Bot className="w-3 h-3" />
                                    <span>Bot Match</span>
                                  </>
                                ) : (
                                  <>
                                    <Users className="w-3 h-3" />
                                    <span>
                                      {game.rated ? "Rated" : "Unrated"}
                                    </span>
                                  </>
                                )}
                              </div>

                              {isBotGame && game.botDifficulty?.label && (
                                <div className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md border bg-purple-500/10 text-purple-400 border-purple-500/20">
                                  <Target className="w-3 h-3" />
                                  <span>
                                    {game.botDifficulty.label}
                                    {game.botDifficulty.elo
                                      ? ` (${game.botDifficulty.elo})`
                                      : ""}
                                  </span>
                                </div>
                              )}

                              <span className="text-zinc-400 text-sm font-medium">
                                vs
                              </span>

                              <div className="flex items-center gap-1.5">
                                {opponent && !opponent.isBot ? (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate(`/profile/${opponent.username}`);
                                    }}
                                    className="text-white font-semibold text-base hover:text-indigo-400 hover:underline transition-all flex items-center gap-1 cursor-pointer group"
                                  >
                                    {opponent.username}
                                    <ExternalLink className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 transition-opacity" />
                                  </button>
                                ) : (
                                  <span className="text-zinc-300 font-medium">
                                    {opponent?.username || "Engine Bot"}
                                  </span>
                                )}

                                {opponentRating !== null &&
                                  opponentRating !== undefined && (
                                    <span className="text-[12px] font-mono font-medium text-zinc-200 bg-zinc-800/50 px-1.5 py-0.5 rounded border border-zinc-700/50">
                                      {opponentRating}
                                    </span>
                                  )}
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                              <span className="bg-zinc-800/80 border border-zinc-700/50 px-2 py-0.5 rounded font-mono font-medium text-indigo-300">
                                {game.opening?.eco || "ECO"}
                              </span>
                              <span className="font-medium text-zinc-300 truncate max-w-[200px] sm:max-w-[300px]">
                                {game.opening?.name || "Custom Match"}
                              </span>
                              {termination && (
                                <span className="text-zinc-500 hidden sm:inline">
                                  • {termination}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between md:justify-end w-full md:w-auto gap-4 pt-3 md:pt-0 border-t md:border-t-0 border-zinc-800/50 pl-2 md:pl-0">
                          <div className="flex md:flex-col items-center md:items-end justify-between md:justify-center text-xs text-zinc-400 gap-2 md:gap-1">
                            {!opponent.isBot && (
                              <div className="flex items-center gap-1.5 font-medium text-zinc-300 bg-zinc-800/40 px-2.5 py-1 rounded-lg border border-zinc-800">
                                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                                <span>
                                  {formatTimeControl(game.timeControl)}
                                </span>
                              </div>
                            )}
                            <div className="flex items-center gap-1 text-zinc-500">
                              <Calendar className="w-3 h-3" />
                              <span>{formatGameDate(game.createdAt)}</span>
                            </div>
                          </div>

                          <button
                            onClick={() =>
                              navigate("/analysis", {
                                state: { pgn: game.pgn },
                              })
                            }
                            className="px-4 py-2 bg-indigo-600/10 hover:bg-indigo-600 border border-indigo-500/30 hover:border-indigo-600 text-indigo-300 hover:text-white font-medium rounded-xl text-xs transition-all duration-200 flex items-center gap-1.5 shadow-sm group/btn cursor-pointer"
                          >
                            <span>Review</span>
                            <ArrowUpRight className="w-3.5 h-3.5 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {visibleGames < games.length && (
                    <div className="pt-4 text-center">
                      <button
                        onClick={() => setVisibleGames((prev) => prev + 10)}
                        className="px-6 py-2.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white font-medium text-xs rounded-xl transition-all duration-200 cursor-pointer shadow-md"
                      >
                        Load More Games ({games.length - visibleGames}{" "}
                        remaining)
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ icon, label, value, valueClass = "", hoverClass = "" }) => (
  <div
    className={`bg-zinc-800/30 border border-zinc-800/60 rounded-2xl p-5 flex flex-col items-center justify-center transition-all duration-300 transform hover:-translate-y-1 ${hoverClass}`}
  >
    <div className="bg-zinc-900/60 p-3 rounded-xl mb-3 border border-zinc-800">
      {icon}
    </div>

    <p className="text-zinc-400 text-sm font-medium mb-1">{label}</p>

    <p className={`text-3xl font-bold ${valueClass}`}>{value}</p>
  </div>
);

export default Profile;