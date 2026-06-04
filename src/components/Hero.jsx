import React from 'react'
import { NavLink } from 'react-router-dom'

const Hero = () => {
  return (
    <section className="flex flex-col items-center justify-center text-center h-[80vh]">
      <h1 className="text-6xl font-bold mb-6">
        Play Chess Online
      </h1>

      <p className="text-zinc-400 text-xl max-w-2xl">
        Challenge players, improve your skills, and
        analyze your games in a modern chess platform.
      </p>

      <NavLink
        to="/play"
        className="mt-8 px-8 py-4 rounded-xl bg-green-600 hover:bg-green-500 transition"
      >
        Play Now
      </NavLink>
    </section>
  )
}

export default Hero
