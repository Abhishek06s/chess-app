import { Routes, Route } from "react-router-dom";

import Home from "../pages/Home";
import Play from "../pages/Play";
import Profile from "../pages/Profile";
import Leaderboard from "../pages/Leaderboard";
import Navbar from "../components/Navbar";
import Analysis from "../pages/Analysis";
import GameReview from "../pages/GameReview";

import Login from "../pages/Login";
import Register from "../pages/Register";
import ProtectedRoute from "./ProtectedRoutes";
import GuestRoute from "./GuestRoutes";

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
        path="/analysis"
        element={
          <ProtectedRoute>
            {" "}
            <div className="min-h-screen bg-zinc-950 text-white">
              <Navbar />
              <Analysis />
            </div>
          </ProtectedRoute>
        }
      />
      <Route
        path="/review"
        element={
          <ProtectedRoute>
            {" "}
            <div className="min-h-screen bg-zinc-950 text-white">
              <Navbar />
              <GameReview />
            </div>
          </ProtectedRoute>
        }
      />

      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <div className="min-h-screen bg-zinc-950 text-white">
              <Navbar />
              <Profile />
            </div>
          </ProtectedRoute>
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

      <Route
        path="/login"
        element={
          <GuestRoute>
            <div className="min-h-screen bg-zinc-950 text-white">
              <Navbar />
              <Login />
            </div>
          </GuestRoute>
        }
      />
      <Route
        path="/register"
        element={
          <GuestRoute>
            <div className="min-h-screen bg-zinc-950 text-white">
              <Navbar />
              <Register />
            </div>
          </GuestRoute>
        }
      />
    </Routes>
  );
}
