import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getProfile, getUserByUsername } from "../services/user.service";
import { getMyGames, getGamesByUserId } from "../services/game.service";
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
    };
  }

  const userWon =
    (game.result === "1-0" && isWhite) || (game.result === "0-1" && !isWhite);

  return userWon
    ? {
        text: "Victory",
        bg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      }
    : {
        text: "Defeat",
        bg: "bg-rose-500/10 text-rose-400 border-rose-500/20",
      };
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

const Profile = () => {
  const navigate = useNavigate();
  const { username } = useParams();
  const isPublicProfile = !!username;

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState("rapid");
  const [games, setGames] = useState([]);
  const [showGames, setShowGames] = useState(false);
  const [visibleGames, setVisibleGames] = useState(10);

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
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [username]);

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
                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-linear-to-r from-white to-zinc-400">
                  {user.username}
                  {isPublicProfile && username !== user.username && (
                    <span className="text-sm bg-zinc-900 px-2 py-1 ml-5 rounded-md text-zinc-300/60">
                      Public Profile
                    </span>
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

      <div className="w-full max-w-4xl">
        <div className="bg-zinc-900/80 backdrop-blur-sm border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl">
          <button
            onClick={() => setShowGames(!showGames)}
            className="w-full flex items-center justify-between p-6 cursor-pointer hover:bg-zinc-800/30 transition-all duration-200"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-zinc-800 rounded-xl">
                <Sword className="w-5 h-5 text-indigo-400" />
              </div>
              <h2 className="text-xl font-bold text-zinc-100">Game History</h2>
            </div>
            <div className="p-1.5 rounded-full bg-zinc-800/50">
              {showGames ? (
                <ChevronUp className="w-5 h-5" />
              ) : (
                <ChevronDown className="w-5 h-5" />
              )}
            </div>
          </button>

          {showGames && (
            <div className="border-t border-zinc-800 bg-zinc-950/20">
              {games.length === 0 ? (
                <div className="p-12 text-center text-zinc-500">
                  No games played yet.
                </div>
              ) : (
                <div className="divide-y divide-zinc-800/40">
                  {games.slice(0, visibleGames).map((game) => {
                    const resultInfo = getResultDetails(game, user._id);

                    const borderColors = {
                      Victory: "border-l-emerald-500",
                      Defeat: "border-l-rose-500",
                      Draw: "border-l-zinc-500",
                    };

                    return (
                      <div
                        key={game._id}
                        className={`group p-5 border-l-4 transition-all duration-200 hover:bg-zinc-900/50 ${borderColors[resultInfo.text] || "border-l-transparent"}`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-3">
                              <span
                                className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded ${resultInfo.bg.replace("/10", "")} bg-opacity-10`}
                              >
                                {resultInfo.text}
                              </span>

                              {/* Clickable Username */}
                              <div className="flex items-center gap-1 text-zinc-300 font-medium">
                                <span>vs</span>
                                {game.opponentName ? (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate(`/profile/${game.opponentName}`);
                                    }}
                                    className="hover:text-indigo-400 hover:underline transition-all flex items-center gap-1 ml-4"
                                  >
                                    {game.opponentName}
                                    <ExternalLink className="w-3 h-3 opacity-50" />
                                  </button>
                                ) : (
                                  <span className="italic text-zinc-600">
                                    Bot
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-3 text-sm text-zinc-400 ml-1">
                              <span className="bg-zinc-800 px-2 py-0.5 rounded text-xs font-mono">
                                {game.opening?.eco || "???"}
                              </span>
                              <span className="font-medium text-zinc-300">
                                {game.opening?.name || "Custom Game"}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 text-xs text-zinc-400 ml-2">
                              <span>{formatTimeControl(game.timeControl)}</span>
                              <span>•</span>
                              <span>{formatGameDate(game.createdAt)}</span>
                            </div>
                          </div>

                          <button
                            onClick={() =>
                              navigate("/analysis", {
                                state: { pgn: game.pgn },
                              })
                            }
                            className="px-4 py-2 bg-zinc-800 hover:bg-indigo-600 hover:text-white transition-colors text-zinc-300 font-medium rounded-xl text-sm"
                          >
                            Review
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
