# ♟️ Chess App

A full-stack, real-time chess platform. Play against **Stockfish** bots or challenge other players live over WebSockets, then dig into a **post-game analysis and review engine** to see where the game turned. Built with a React/Vite frontend and a Node.js/Express + MongoDB backend.

---

## ✨ Highlights

- 👥 **Live multiplayer** — real-time games over Socket.IO, with rooms, clocks, and reconnection handling
- 🤖 **Bot play** — Stockfish 18 (WASM) opponents at multiple difficulty levels
- 📊 **Game review** — automatic move classification, brilliant/great move detection, and opening recognition (ECO database)
- 🔐 **Accounts & ratings** — JWT-based auth with per-format stats (bullet / blitz / rapid) and a Glicko-style rating field
- 🏆 **Leaderboard & profiles** — public player profiles and a global leaderboard
- 🕹️ **Guest play** — jump into a game without creating an account

---

## 🗂️ Repository Structure

```text
chess-app-main/
├── Frontend/     # React + Vite client (UI, board, Stockfish worker, sockets)
│   └── README.md
│
└── Backend/      # Express + MongoDB API and Socket.IO server
    └── README.md
```

Each half of the app has its own detailed README — see [`Frontend/README.md`](./Frontend/README.md) and [`Backend/README.md`](./Backend/README.md) for setup specifics. This document covers the project as a whole.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS 4, Framer Motion, React Router |
| Chess logic | Chess.js, React Chessboard, Stockfish (WASM) |
| Realtime | Socket.IO (client + server) |
| Backend | Node.js, Express 5 |
| Database | MongoDB (Mongoose) |
| Auth | JWT, bcrypt, HTTP-only cookies |

---

## ⚙️ Getting Started

### Prerequisites

- Node.js (LTS recommended)
- npm
- A MongoDB instance (local or Atlas)

### 1. Clone the repository

```bash
git clone <repository-url>
cd chess-app-main
```

### 2. Set up the Backend

```bash
cd Backend
npm install
```

Create a `.env` file in `Backend/` with at least:

```env
PORT=5000
MONGO_URI=<your-mongodb-connection-string>
JWT_SECRET=<your-jwt-secret>
```

Start the API and socket server:

```bash
npm run dev
```

The backend runs at `http://localhost:5000` by default and exposes:

- `POST /api/auth/register`, `/login`, `/logout`, `GET /api/auth/me`
- `GET/POST/DELETE /api/games` — game history CRUD
- `GET /api/users/profile`, `/api/users/profile/:username`, `/api/users/leaderboard`
- `GET/PUT/DELETE /api/bot-games` — resumable in-progress bot games
- A Socket.IO server for live multiplayer moves, clocks, and room management

### 3. Set up the Frontend

In a separate terminal:

```bash
cd Frontend
npm install
```

Create a `.env` file in `Frontend/` pointing at the backend:

```env
VITE_API_URL=http://localhost:5000
VITE_SOCKET_URL=http://localhost:5000
```

Start the dev server:

```bash
npm run dev
```

The app runs at `http://localhost:5173`.

### 4. Play

Open `http://localhost:5173`, register or continue as a guest, and start a game against the bot or another player.

---

## 🧩 How It Fits Together

1. **Auth** — the frontend's `authContext` calls the backend's `/api/auth` routes; a JWT is stored in an HTTP-only cookie and validated by `authMiddleware` on protected backend routes and `ProtectedRoutes`/`GuestRoutes` on the frontend.
2. **Bot games** — played entirely client-side using the bundled Stockfish WASM engine; in-progress bot games can be persisted via `/api/bot-games` so they survive a refresh.
3. **Human vs. human games** — moves are exchanged in real time through the Socket.IO server in `Backend/socket/socket.js`; completed games are saved via `/api/games` and reflected in player `stats` on the `User` model.
4. **Game review & ratings** — after a game ends, the frontend's move-classification utilities (brilliant/great move detectors, opening lookup) generate the review, while the backend tracks per-format (`bullet`/`blitz`/`rapid`) rating, win/loss/draw stats, and leaderboard standing.

---

## 🔮 Roadmap

- Puzzle / training mode
- Spectator mode for live games
- Friends and challenge system
- Deployment guides (Docker / cloud hosting)

---

## 👨‍💻 Developed By

**S ABHISHEK**

A passion project combining modern web technologies with the strategic depth of chess.

---

## 📜 License

This project is intended for educational and portfolio purposes.
