import React, { useEffect, useState } from "react";

import { getProfile } from "../services/user.service";

const Profile = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

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
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        Loading Profile...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        Failed to load profile
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8">
      <div className="max-w-4xl mx-auto bg-zinc-900 rounded-2xl p-8 border border-zinc-800">
        <h1 className="text-3xl font-bold mb-8">Profile</h1>

        <div className="space-y-4">
          <div>
            <span className="text-zinc-400">Username:</span>
            <p className="text-xl font-semibold">{user.username}</p>
          </div>

          <div>
            <span className="text-zinc-400">Email:</span>
            <p className="text-xl">{user.email}</p>
          </div>

          <div>
            <span className="text-zinc-400">Rating:</span>
            <p className="text-xl">{user.rating}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-10">
          <div className="bg-zinc-800 rounded-xl p-4 text-center">
            <p className="text-zinc-400 text-sm">Games</p>
            <p className="text-2xl font-bold">{user.gamesPlayed}</p>
          </div>

          <div className="bg-zinc-800 rounded-xl p-4 text-center">
            <p className="text-zinc-400 text-sm">Wins</p>
            <p className="text-2xl font-bold text-green-400">{user.wins}</p>
          </div>

          <div className="bg-zinc-800 rounded-xl p-4 text-center">
            <p className="text-zinc-400 text-sm">Losses</p>
            <p className="text-2xl font-bold text-red-400">{user.losses}</p>
          </div>

          <div className="bg-zinc-800 rounded-xl p-4 text-center">
            <p className="text-zinc-400 text-sm">Draws</p>
            <p className="text-2xl font-bold text-yellow-400">{user.draws}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
