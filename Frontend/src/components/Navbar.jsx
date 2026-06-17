import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { logoutUser } from "../services/auth.service";
import { useAuth } from "../context/authContext";

const Navbar = () => {
  const { user, logout, loading } = useAuth();

  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout(logoutUser);

      toast.success("Logged out successfully");
      navigate("/login");
    } catch (err) {
      toast.error("Logout failed");
    }
  };

  return (
    <nav className="flex items-center justify-between px-8 py-5 border-b border-zinc-800">
      <h1 className="text-2xl font-bold text-green-500">ChessHub</h1>

      <div className="flex gap-6 items-center">
        <NavLink to="/">Home</NavLink>
        <NavLink to="/play">Play</NavLink>
        <NavLink to="/leaderboard">Leaderboard</NavLink>

        {!loading && user && <NavLink to="/profile">Profile</NavLink>}

        {loading ? null : user ? (
          <button
            onClick={handleLogout}
            className="text-red-400 cursor-pointer"
          >
            Logout
          </button>
        ) : (
          <>
            <NavLink to="/register">Register</NavLink>
            <NavLink to="/login">Login</NavLink>
          </>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
