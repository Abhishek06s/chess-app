import { Routes, Route } from "react-router-dom";

import Home from "../pages/Home";
import Play from "../pages/Play";
import Profile from "../pages/Profile";
import Leaderboard from "../pages/Leaderboard";
import Navbar from "../components/Navbar";

export default function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <div className="min-h-screen bg-zinc-950 text-white">
            <Navbar />
            <Home />
          </div>
        }
      />
      <Route
        path="/play"
        element={
          <div className="min-h-screen bg-zinc-950 text-white">
            <Navbar />
            <Play />
          </div>
        }
      />
      <Route
        path="/profile"
        element={
          <div className="min-h-screen bg-zinc-950 text-white">
            <Navbar />
            <Profile />
          </div>
        }
      />
      <Route
        path="/leaderboard"
        element={
          <div className="min-h-screen bg-zinc-950 text-white">
            <Navbar />
            <Leaderboard />
          </div>
        }
      />
    </Routes>
  );
}
