const express = require("express");

const {
  createGame,
  getMyGames,
  getGameById,
  deleteGame,
} = require("../controllers/game.controller");

const authMiddleware = require("../middlewares/auth.middleware");

const router = express.Router();

router.post("/", authMiddleware.authMiddleware, createGame);

router.get("/my-games", authMiddleware.authMiddleware, getMyGames);

router.get("/:id", authMiddleware.authMiddleware, getGameById);

router.delete("/:id", authMiddleware.authMiddleware, deleteGame);

module.exports = router;
