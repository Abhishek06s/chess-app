import { useEffect, useState, useMemo } from "react";
import { getLeaderboard } from "../services/user.service";
import { Trophy, Medal, ChevronDown } from "lucide-react";
import { NavLink } from "react-router-dom";
import usePresence from "../hooks/usePresence";
import StatusIndicator from "../components/StatusIndicator";

const Leaderboard = () => {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState("rapid");
  const [visibleCount, setVisibleCount] = useState(5);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      try {
        const data = await getLeaderboard(mode);
        setPlayers(data.users);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
    // Reset visible count when switching modes
    setVisibleCount(5);
  }, [mode]);

  const handleViewMore = () => {
    setVisibleCount((prev) => {
      // If currently 5, add 5 to reach 10. Otherwise, add 10. Max out at 100.
      if (prev === 5) return 10;
      return Math.min(prev + 10, 100);
    });
  };

  // Hooks must run unconditionally on every render, so this is computed
  // before the loading early-return below (not after it).
  const presenceIds = useMemo(
    () => players.slice(0, visibleCount).map((player) => player._id),
    [players, visibleCount],
  );
  const statusMap = usePresence(presenceIds);

  if (loading && players.length === 0) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-zinc-400 font-medium animate-pulse">
          Loading Leaderboard...
        </p>
      </div>
    );
  }

  const getRankStyle = (index) => {
    switch (index) {
      case 0:
        return "text-yellow-400 bg-yellow-400/10 border-yellow-400/20";
      case 1:
        return "text-zinc-300 bg-zinc-300/10 border-zinc-300/20";
      case 2:
        return "text-amber-600 bg-amber-600/10 border-amber-600/20";
      default:
        return "text-zinc-500 border-transparent";
    }
  };

  // Only slice the array up to the visible count
  const visiblePlayers = players.slice(0, visibleCount);
  const showViewMore = visibleCount < players.length && visibleCount < 100;

  return (
    <div className="min-h-screen bg-zinc-950 text-white py-12 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center p-3 bg-emerald-500/10 rounded-2xl mb-4 border border-emerald-500/20">
            <Trophy className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold bg-clip-text text-transparent bg-linear-to-r from-emerald-400 to-cyan-400">
            Global Leaderboard
          </h1>
          <p className="text-zinc-400 mt-3 font-medium">
            Top players ranked by{" "}
            <span className="text-red-500 font-semibold font-sans">
              {mode.toUpperCase()}
            </span>{" "}
            rating
          </p>
        </div>

        <div className="flex justify-center gap-3 mb-8">
          {["bullet", "blitz", "rapid"].map((gameMode) => (
            <button
              key={gameMode}
              onClick={() => setMode(gameMode)}
              className={`px-4 py-2 rounded-xl capitalize transition cursor-pointer ${
                mode === gameMode
                  ? "bg-emerald-600 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              }`}
            >
              {gameMode}
            </button>
          ))}
        </div>

        {/* Table Container */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-900/80 border-b border-zinc-800 text-xs uppercase tracking-wider text-zinc-400 font-semibold">
                  <th className="p-5 w-24 text-center">Rank</th>
                  <th className="p-5">Player</th>
                  <th className="p-5 text-right">Rating</th>
                  <th className="p-5 text-right">Games</th>
                  <th className="p-5 text-right">Wins</th>
                  <th className="p-5 text-right">Losses</th>
                  <th className="p-5 text-right">Draws</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-zinc-800/50">
                {visiblePlayers.map((player, index) => (
                  <tr
                    key={player._id}
                    className="group hover:bg-zinc-800/30 transition-colors duration-200"
                  >
                    {/* Rank Badge */}
                    <td className="p-5 text-center">
                      <div
                        className={`inline-flex items-center justify-center w-8 h-8 rounded-full border text-sm font-bold ${getRankStyle(
                          index,
                        )}`}
                      >
                        {index < 3 ? <Medal className="w-4 h-4" /> : index + 1}
                      </div>
                    </td>

                    {/* Player Name */}
                    <td className="p-5 font-medium text-zinc-100 group-hover:text-emerald-400 transition-colors">
                      <div className="flex items-center gap-3">
                        <NavLink
                          to={`/profile/${player.username}`}
                          className="hover:text-indigo-400 transition-colors"
                        >
                          {player.username}
                        </NavLink>
                        <StatusIndicator status={statusMap[player._id]} />
                      </div>
                    </td>

                    {/* Rating */}
                    <td className="p-5 text-right font-bold text-emerald-400">
                      {player.stats[mode].rating}
                    </td>

                    {/* Games */}
                    <td className="p-5 text-right text-zinc-400">
                      {player.stats[mode].gamesPlayed}
                    </td>

                    {/* Wins */}
                    <td className="p-5 text-right text-emerald-500/80 font-medium">
                      {player.stats[mode].wins}
                    </td>

                    {/* Losses */}
                    <td className="p-5 text-right text-red-500/80 font-medium">
                      {player.stats[mode].losses}
                    </td>

                    {/* Draws */}
                    <td className="p-5 text-right text-yellow-500/80 font-medium">
                      {player.stats[mode].draws}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* View More Button */}
          {showViewMore && (
            <div className="p-4 border-t border-zinc-800 flex justify-center bg-zinc-900/30">
              <button
                onClick={handleViewMore}
                className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-all text-sm font-medium cursor-pointer"
              >
                View More
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;