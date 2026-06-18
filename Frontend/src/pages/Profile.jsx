import React, { useEffect, useState } from "react";
import { getProfile } from "../services/user.service";
import {
  Trophy,
  Swords,
  Target,
  Hash,
  Mail,
  Star,
} from "lucide-react";

const Profile = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState("rapid");

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await getProfile();
        setUser(data.user);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

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
    <div className="min-h-screen bg-zinc-950 text-white p-4 md:p-8 flex items-center justify-center">
      <div className="w-full max-w-4xl bg-zinc-900/80 backdrop-blur-sm rounded-3xl overflow-hidden border border-zinc-800 shadow-2xl">
        <div className="h-32 bg-linear-to-r from-indigo-600 via-purple-600 to-emerald-600"></div>

        <div className="px-8 pb-8 relative">
          <div className="absolute -top-16 left-8 bg-zinc-900 p-2 rounded-full border border-zinc-800 shadow-xl">
            <div className="w-24 h-24 bg-linear-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-3xl font-bold uppercase shadow-inner">
              {user.username.charAt(0)}
            </div>
          </div>

          <div className="mt-12 mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="relative left-40 -top-9">
              <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-linear-to-r from-white to-zinc-400">
                {user.username}
              </h1>

              <div className="flex items-center gap-2 text-zinc-400 mt-2">
                <Mail className="w-4 h-4" />
                <span>{user.email}</span>
              </div>
            </div>

            <div className="bg-zinc-800/50 px-6 py-3 rounded-2xl border border-zinc-700/50 flex items-center gap-3 relative -top-7">
              <Star className="w-6 h-6 text-yellow-400 fill-yellow-400" />
              <div>
                <p className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">
                  {mode} Rating
                </p>
                <p className="text-2xl font-bold">{stats.rating}</p>
              </div>
            </div>
          </div>

          <div className="flex justify-center gap-3 mb-8">
            {["bullet", "blitz", "rapid"].map((gameMode) => (
              <button
                key={gameMode}
                onClick={() => setMode(gameMode)}
                className={`px-4 py-2 rounded-xl capitalize transition cursor-pointer ${
                  mode === gameMode
                    ? "bg-indigo-600 text-white"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                }`}
              >
                {gameMode}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            <StatCard
              icon={<Hash className="w-5 h-5 text-indigo-400" />}
              label="Games"
              value={stats.gamesPlayed}
              hoverClass="hover:border-indigo-500/50 hover:bg-indigo-500/10"
            />

            <StatCard
              icon={<Trophy className="w-5 h-5 text-emerald-400" />}
              label="Wins"
              value={stats.wins}
              valueClass="text-emerald-400"
              hoverClass="hover:border-emerald-500/50 hover:bg-emerald-500/10"
            />

            <StatCard
              icon={<Swords className="w-5 h-5 text-red-400" />}
              label="Losses"
              value={stats.losses}
              valueClass="text-red-400"
              hoverClass="hover:border-red-500/50 hover:bg-red-500/10"
            />

            <StatCard
              icon={<Target className="w-5 h-5 text-yellow-400" />}
              label="Draws"
              value={stats.draws}
              valueClass="text-yellow-400"
              hoverClass="hover:border-yellow-500/50 hover:bg-yellow-500/10"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({
  icon,
  label,
  value,
  valueClass = "",
  hoverClass = "",
}) => (
  <div
    className={`bg-zinc-800/40 border border-zinc-800/80 rounded-2xl p-5 flex flex-col items-center justify-center transition-all duration-300 transform hover:-translate-y-1 ${hoverClass}`}
  >
    <div className="bg-zinc-900/50 p-3 rounded-xl mb-3 border border-zinc-800">
      {icon}
    </div>

    <p className="text-zinc-400 text-sm font-medium mb-1">{label}</p>

    <p className={`text-3xl font-bold ${valueClass}`}>{value}</p>
  </div>
);

export default Profile;