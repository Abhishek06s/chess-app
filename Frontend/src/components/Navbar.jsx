import React from 'react'
import { NavLink } from 'react-router-dom'

const Navbar = () => {
  return (
    <nav className="flex items-center justify-between px-8 py-5 border-b border-zinc-800">
      <h1 className="text-2xl font-bold text-green-500">
        ChessHub
      </h1>

      <div className="flex gap-6">
        <NavLink to="/">Home</NavLink>
        <NavLink to="/play">Play</NavLink>
        <NavLink to="/leaderboard">Leaderboard</NavLink>
        <NavLink to="/profile">Profile</NavLink>
      </div>
    </nav>
  )
}

export default Navbar
