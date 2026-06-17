import { useEffect, useState } from "react";
import { getLeaderboard } from "../services/user.service";
import { Trophy, Medal } from "lucide-react";

const Leaderboard = () => {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const data = await getLeaderboard();
        setPlayers(data.users);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-zinc-400 font-medium animate-pulse">Loading Leaderboard...</p>
      </div>
    );
  }

  // Helper to colorize top 3 ranks
  const getRankStyle = (index) => {
    switch (index) {
      case 0: return "text-yellow-400 bg-yellow-400/10 border-yellow-400/20";
      case 1: return "text-zinc-300 bg-zinc-300/10 border-zinc-300/20";
      case 2: return "text-amber-600 bg-amber-600/10 border-amber-600/20";
      default: return "text-zinc-500 border-transparent";
    }
  };

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
          <p className="text-zinc-400 mt-3 font-medium">Top players ranked by total rating</p>
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
                {players.map((player, index) => (
                  <tr
                    key={player._id}
                    className="group hover:bg-zinc-800/30 transition-colors duration-200"
                  >
                    {/* Rank Badge */}
                    <td className="p-5 text-center">
                      <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full border text-sm font-bold ${getRankStyle(index)}`}>
                        {index < 3 ? <Medal className="w-4 h-4" /> : index + 1}
                      </div>
                    </td>

                    {/* Player Name */}
                    <td className="p-5 font-medium text-zinc-100 group-hover:text-emerald-400 transition-colors">
                      {player.username}
                    </td>

                    {/* Rating */}
                    <td className="p-5 text-right font-bold text-emerald-400">
                      {player.rating}
                    </td>

                    {/* Games */}
                    <td className="p-5 text-right text-zinc-400">
                      {player.gamesPlayed}
                    </td>

                    {/* Wins */}
                    <td className="p-5 text-right text-emerald-500/80 font-medium">
                      {player.wins}
                    </td>

                    {/* Losses */}
                    <td className="p-5 text-right text-red-500/80 font-medium">
                      {player.losses}
                    </td>

                    {/* Draws */}
                    <td className="p-5 text-right text-yellow-500/80 font-medium">
                      {player.draws}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Leaderboard;