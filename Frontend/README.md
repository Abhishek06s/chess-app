# ♟️ Chess App – Frontend

A modern chess application built with **React** and **Vite**, featuring live multiplayer over WebSockets, bot play powered by **Stockfish**, post-game analysis, opening recognition, leaderboards, and player profiles.

---

## 🚀 Features

- 🎮 Interactive chess gameplay (drag-and-drop board)
- 👥 Real-time multiplayer via Socket.IO
- 🤖 Stockfish engine integration for bot opponents and analysis
- 📊 Detailed game review system with move classification
- ✨ Brilliant and Great move detection
- 📚 ECO opening database support (auto opening recognition)
- ⏱️ Chess clocks with configurable time controls
- 🔊 Chess sound effects (move, capture, check, castle, promote, game end)
- 🔐 Authentication (login / register) with protected and guest-only routes
- 🏆 Leaderboard page
- 👤 Player profile pages
- 📱 Responsive UI with smooth animations

---

## 🛠️ Tech Stack

### Core
- React 18
- Vite 5
- React Router DOM
- Tailwind CSS 4
- Framer Motion

### Chess & Realtime
- Chess.js
- React Chessboard
- Stockfish (WASM engine)
- Socket.IO Client

### Networking & UX
- Axios
- React Hot Toast
- Lucide React / React Feather (icons)

---

## 📂 Project Structure

```text
Frontend/
├── public/
│   └── stockfish/
│       ├── stockfish-18-lite-single.js
│       └── stockfish-18-lite-single.wasm
│
├── src/
│   ├── assets/
│   │   └── sounds/
│   │       ├── capture.mp3
│   │       ├── castle.mp3
│   │       ├── check.mp3
│   │       ├── game-end.mp3
│   │       ├── move.mp3
│   │       └── promote.mp3
│   │
│   ├── components/
│   │   ├── ChessBoard.jsx
│   │   ├── Footer.jsx
│   │   ├── GameSidebar.jsx
│   │   ├── Hero.jsx
│   │   ├── MultiplayerTester.jsx
│   │   ├── Navbar.jsx
│   │   └── PlayerCard.jsx
│   │
│   ├── context/
│   │   └── authContext.jsx      # Global auth state/provider
│   │
│   ├── data/
│   │   ├── openings.js
│   │   └── openings/
│   │       ├── ecoA.json
│   │       ├── ecoB.json
│   │       ├── ecoC.json
│   │       ├── ecoD.json
│   │       └── ecoE.json
│   │
│   ├── hooks/
│   │   ├── useCapturedPieces.js
│   │   ├── useChessClock.js
│   │   ├── useChessSounds.js
│   │   └── useStockFish.js
│   │
│   ├── pages/
│   │   ├── Home.jsx
│   │   ├── Play.jsx
│   │   ├── Analysis.jsx
│   │   ├── GameReview.jsx
│   │   ├── Leaderboard.jsx
│   │   ├── Login.jsx
│   │   ├── Register.jsx
│   │   └── Profile.jsx
│   │
│   ├── routes/
│   │   ├── AppRoutes.jsx        # Top-level route definitions
│   │   ├── GuestRoutes.jsx      # Routes only accessible when logged out
│   │   └── ProtectedRoutes.jsx  # Routes that require authentication
│   │
│   ├── services/
│   │   ├── activeBotGame.service.js
│   │   ├── api.service.js       # Axios instance / base config
│   │   ├── auth.service.js
│   │   ├── bot.service.js
│   │   ├── game.service.js
│   │   ├── socket.service.js
│   │   ├── stockfishService.js
│   │   └── user.service.js
│   │
│   ├── utils/
│   │   ├── botDifficulty.js
│   │   ├── brilliantMoveDetector.js
│   │   ├── gameReview.js
│   │   ├── greatMoveDetector.js
│   │   ├── guestUtil.js
│   │   ├── moveTree.js
│   │   └── timeControls.js
│   │
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
│
├── package.json
├── vite.config.js
└── eslint.config.js
```

---

## ⚙️ Installation

Clone the repository and navigate to the frontend directory:

```bash
git clone <repository-url>
cd chess-app-main/Frontend
```

Install dependencies:

```bash
npm install
```

---

## 🔧 Environment Variables

Create a `.env` file in the `Frontend/` directory (if not already present) pointing to your running backend:

```env
VITE_API_URL=http://localhost:5000
VITE_SOCKET_URL=http://localhost:5000
```

> Adjust the values to match wherever your Backend server is deployed. See the Backend README for server-side configuration.

---

## ▶️ Running the Application

Make sure the [Backend](../Backend) is running first (it provides authentication, game persistence, and the multiplayer WebSocket server), then start the frontend dev server:

```bash
npm run dev
```

The application will be available at:

```text
http://localhost:5173
```

---

## 📦 Available Scripts

```bash
npm run dev      # Starts development server
npm run build    # Builds the project for production
npm run preview  # Previews the production build
npm run lint     # Runs ESLint checks
```

---

## 🧠 Stockfish Integration

The application uses **Stockfish 18 Lite** (WASM) for:

- Bot opponents at multiple difficulty levels
- Position evaluation
- Move analysis
- Game review generation
- Identifying brilliant / great moves
- Supporting post-game insights

Stockfish assets are located in:

```text
public/stockfish/
```

The `useStockFish` hook and `services/stockfishService.js` handle communication with the engine worker.

---

## 🔌 Real-Time Multiplayer

`services/socket.service.js` manages the Socket.IO connection to the Backend for live human-vs-human games (moves, clocks, resignations, room management). The `MultiplayerTester` component can be used during development to exercise socket events.

---

## 🔐 Authentication & Routing

- `context/authContext.jsx` exposes the current user and auth actions across the app.
- `routes/ProtectedRoutes.jsx` guards pages that require a logged-in user (e.g. Profile).
- `routes/GuestRoutes.jsx` guards pages only meant for logged-out visitors (e.g. Login, Register).
- Guests can also play without an account via `utils/guestUtil.js`.

---

## 📖 Opening Database

The application includes **ECO (Encyclopaedia of Chess Openings)** datasets to recognize common opening lines as they're played.

Supported categories:

- ECO A
- ECO B
- ECO C
- ECO D
- ECO E

---

## 🔮 Future Enhancements

- Spectator mode for live games
- Puzzle/training mode
- Friend system and challenges
- Mobile app wrapper

---

## 👨‍💻 Developed By

**S ABHISHEK**

A passion project aimed at combining modern web technologies with the strategic depth of chess.

---

## 📜 License

This project is intended for educational and portfolio purposes.