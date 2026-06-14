# ♟️ Chess App – Frontend

A modern chess application built with **React** and **Vite**, featuring interactive gameplay, Stockfish-powered analysis, opening recognition, game reviews, leaderboards, and player profiles.

---

## 🚀 Features

- 🎮 Interactive chess gameplay
- 🤖 Stockfish engine integration for analysis
- 📊 Detailed game review system
- ✨ Brilliant and Great move detection
- 📚 ECO opening database support
- ⏱️ Chess clock functionality
- 🔊 Chess sound effects
- 🏆 Leaderboard page
- 👤 Player profile interface
- 📱 Responsive user interface
- 🎨 Smooth animations using Framer Motion

---

## 🛠️ Tech Stack

### Frontend
- React 18
- Vite
- React Router DOM
- Tailwind CSS
- Framer Motion

### Chess Libraries
- Chess.js
- React Chessboard
- Stockfish Engine

### Additional Libraries
- Lucide React
- React Feather
- React Hot Toast

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
│   │   ├── Navbar.jsx
│   │   └── PlayerCard.jsx
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
│   │   └── Profile.jsx
│   │
│   ├── routes/
│   │   └── AppRoutes.jsx
│   │
│   ├── services/
│   │   └── stockfishService.js
│   │
│   ├── utils/
│   │   ├── brilliantMoveDetector.js
│   │   ├── gameReview.js
│   │   ├── greatMoveDetector.js
│   │   └── moveTree.js
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
cd Frontend
```

Install dependencies:

```bash
npm install
```

---

## ▶️ Running the Application

Start the development server:

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

The application uses **Stockfish 18 Lite** for:

- Position evaluation
- Move analysis
- Game review generation
- Identifying strong moves
- Supporting post-game insights

Stockfish assets are located in:

```text
public/stockfish/
```

---

## 📖 Opening Database

The application includes **ECO (Encyclopaedia of Chess Openings)** datasets to recognize common opening lines.

Supported categories:

- ECO A
- ECO B
- ECO C
- ECO D
- ECO E

---

## 🔮 Future Enhancements

- Backend integration
- User authentication
- Online multiplayer gameplay
- Match history storage
- Rating and ranking system
- Cloud-based game analysis
- Social features and friend system

---

## 👨‍💻 Developed By

**S ABHISHEK**

A passion project aimed at combining modern web technologies with the strategic depth of chess.

---

## 📜 License

This project is intended for educational and portfolio purposes.
