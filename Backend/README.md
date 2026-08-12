# ♟️ Chess App – Backend

The API and real-time server for the Chess App. Built with **Express** and **MongoDB**, it handles authentication, game persistence, player ratings, and live multiplayer gameplay over **Socket.IO**.

---

## 🚀 Features

- 🔐 JWT-based authentication with HTTP-only cookies
- 👥 Real-time multiplayer via Socket.IO (rooms, moves, clocks)
- 🤖 Persistence for in-progress bot games (resume after refresh)
- 📜 Completed-game history storage (PGN, FEN, moves, opening, termination)
- 🏆 Glicko-style rating system, tracked per time control (bullet / blitz / rapid)
- 🌐 Public player profiles and leaderboard endpoints

---

## 🛠️ Tech Stack

- Node.js + Express 5
- MongoDB + Mongoose
- Socket.IO
- JWT (`jsonwebtoken`) + `bcryptjs` for auth
- `cookie-parser`, `cors`, `dotenv`
- `chess.js` for server-side move/position validation
- `nodemon` for development

---

## 📂 Project Structure

```text
Backend/
├── server.js                     # Entry point — boots HTTP + Socket.IO server
├── socket/
│   └── socket.js                 # Socket.IO event handlers (live game rooms)
│
├── src/
│   ├── app.js                    # Express app setup, middleware, route mounting
│   │
│   ├── config/
│   │   └── db.config.js          # MongoDB connection
│   │
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── game.controller.js
│   │   ├── user.controller.js
│   │   └── activeBotGame.controller.js
│   │
│   ├── middlewares/
│   │   └── auth.middleware.js    # authMiddleware, alreadyLoggedIn
│   │
│   ├── models/
│   │   ├── user.model.js         # Username/email/password + per-format stats
│   │   ├── game.model.js         # Completed game records
│   │   └── activeBotGame.model.js # In-progress bot game (one per user)
│   │
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── game.routes.js
│   │   ├── user.routes.js
│   │   └── activeBotGame.routes.js
│   │
│   └── utils/
│       └── elo.util.js           # Glicko-style rating calculation
│
├── package.json
└── .env                          # Not committed — see Environment Variables
```

---

## ⚙️ Installation

```bash
git clone <repository-url>
cd chess-app-main/Backend
npm install
```

---

## 🔧 Environment Variables

Create a `.env` file in `Backend/` (see `.env.example`):

```env
PORT=5000
MONGO_URI=<your-mongodb-connection-string>
JWT_SECRET=<your-jwt-secret>

# Avatar image hosting (Cloudinary) — see "Avatar image hosting" below
CLOUDINARY_CLOUD_NAME=<your-cloud-name>
CLOUDINARY_API_KEY=<your-api-key>
CLOUDINARY_API_SECRET=<your-api-secret>
```

> `server.js` overrides the system DNS resolvers (`1.1.1.1`, `8.8.8.8`) before connecting — useful in environments where the default DNS can't resolve your MongoDB Atlas hostname.

### 🖼️ Avatar image hosting

User-uploaded avatars are stored on **Cloudinary** rather than on the
server's own disk (a normal Node host's filesystem isn't reliably
persistent/shared across instances, so files saved there can vanish on
redeploy). The backend never sees your Cloudinary password — it only ever
uses the API key/secret below to talk to the Cloudinary API directly.

**How to get the three credentials above:**

1. Go to https://cloudinary.com/users/register/free and create a free
   account (email + password, or "Sign up with Google/GitHub"). No credit
   card is required for the free tier.
2. After verifying your email, you'll land on the **Cloudinary Console**
   (`https://console.cloudinary.com`).
3. On the Console's main dashboard page, there's a "Product Environment
   Credentials" / "API Keys" panel showing:
   - **Cloud name** → `CLOUDINARY_CLOUD_NAME`
   - **API Key** → `CLOUDINARY_API_KEY`
   - **API Secret** → `CLOUDINARY_API_SECRET` (click "Reveal" to see it)
4. Copy those three values into `Backend/.env` as shown above.
5. That's it — no further setup is required. Uploaded avatars will appear
   in the Console under **Assets → Media Library → chess-app/avatars**.

The free tier's storage/bandwidth limits are generous enough for avatar
thumbnails; check Cloudinary's current pricing page if you expect heavy
traffic. If you'd rather use a different provider (S3, Supabase Storage,
etc.), swap out `src/config/cloudinary.config.js` and the upload call in
`uploadAvatarImage` (`src/controllers/user.controller.js`) — the rest of
the app only depends on `user.avatar` being a public image URL.

---

## ▶️ Running the Server

```bash
npm run dev      # nodemon, auto-restarts on file changes
npm start        # plain node
```

By default the server runs at `http://localhost:5000` and expects the frontend to be running at `http://localhost:5173` (configured as the allowed CORS origin in `src/app.js`).

A basic health check is available at:

```text
GET /
→ { "success": true, "message": "Chess Backend API Running" }
```

---

## 📡 API Reference

All protected routes expect a JWT, either as an HTTP-only `token` cookie (set automatically on login) or an `Authorization: Bearer <token>` header.

### Auth — `/api/auth`

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/register` | Guest only | Create a new account |
| POST | `/login` | Guest only | Log in, sets `token` cookie |
| POST | `/logout` | — | Clears the auth cookie |
| GET | `/me` | Required | Returns the current authenticated user |

### Games — `/api/games`

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/` | Required | Save a completed game |
| GET | `/my-games` | Required | List the current user's games |
| GET | `/:id` | Required | Get a single game by ID |
| DELETE | `/:id` | Required | Delete a game |
| GET | `/user/:userId` | Required | List games for a specific user |

### Bot Games — `/api/bot-games`

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/` | Required | Fetch the user's in-progress bot game, if any |
| PUT | `/` | Required | Create/update the in-progress bot game |
| DELETE | `/` | Required | Clear the in-progress bot game (e.g. on completion) |

### Users — `/api/users`

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/profile` | Required | Get the current user's own profile |
| GET | `/profile/:username` | Public | Get any user's public profile |
| GET | `/leaderboard` | Public | Ranked list of players |
| GET | `/search?q=` | Required | Search users by username prefix |
| POST | `/avatar` | Required | Upload/replace your avatar (`multipart/form-data`, field `avatar`) |
| DELETE | `/avatar` | Required | Remove your avatar (reverts to the default pawn) |
| GET | `/avatars?usernames=a,b` | Public | Batch-resolve avatars for a list of usernames |
| GET | `/friends/requests` | Required | List pending (received) friend requests |
| POST | `/friends/request/:userId` | Required | Send a friend request |
| POST | `/friends/accept/:userId` | Required | Accept a friend request |
| POST | `/friends/reject/:userId` | Required | Reject a friend request |
| DELETE | `/friends/:userId` | Required | Remove a friend |

---

## 🗄️ Data Models

**`User`** — `username`, `email`, hashed `password`, `avatar` (Cloudinary image URL, `null` until the user uploads one — the frontend shows a default pawn avatar in that case), `avatarPublicId` (internal, used to replace/delete the Cloudinary asset), and a `stats` object with independent `bullet` / `blitz` / `rapid` entries, each tracking `rating` (default `800`), `rd` (rating deviation, default `350`), `gamesPlayed`, `wins`, `losses`, `draws`.

**`Game`** — a completed game record: PGN/FEN snapshot, move list, `result`, detected `opening` (name + ECO code), `timeControl`, `gameType`, per-side time remaining, `opponentType` (`bot`/`human`) with related fields, `rated` flag, and `termination` reason (checkmate, timeout, resignation, etc.). Human games are linked to `whitePlayer`/`blackPlayer` (and `player1`/`player2`) via `User` refs; a `roomId` uniquely ties a record back to its live multiplayer session.

**`ActiveBotGame`** — one document per user representing their current in-progress bot game (`fen`, `moves`, `playerColor`, `difficulty`). It's overwritten on every move and deleted once the game ends, so refreshing the page doesn't lose progress.

---

## 🧮 Rating System

`src/utils/elo.util.js` implements a **Glicko-style** rating update (rating + rating deviation), rather than plain Elo — new players start at `rating: 800`, `rd: 350`, and both values are updated after every rated game based on the opponent's rating and RD, with `rating`/`rd` floors of `100`/`30`. Ratings are tracked independently per `gameType` (bullet / blitz / rapid).

---

## 🔌 Real-Time Multiplayer (Socket.IO)

`socket/socket.js` is initialized alongside the HTTP server in `server.js` and handles the live game layer: joining/creating rooms, broadcasting moves between the two players, syncing clocks, and reporting game-ending events (resignation, timeout, checkmate, etc.) back to the client, which then persists the finished game via `POST /api/games`.

---

## 🔮 Future Enhancements

- Rate limiting / brute-force protection on auth routes
- Refresh tokens
- Spectator support in the socket layer
- Admin/moderation endpoints

---

## 👨‍💻 Developed By

**S ABHISHEK**

---

## 📜 License

This project is intended for educational and portfolio purposes.