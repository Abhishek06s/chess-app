const express = require("express");

const {
  getActiveBotGame,
  saveActiveBotGame,
  deleteActiveBotGame,
} = require("../controllers/activeBotGame.controller");

const authMiddleware = require("../middlewares/auth.middleware");

const router = express.Router();

router.get("/", authMiddleware.authMiddleware, getActiveBotGame);

router.put("/", authMiddleware.authMiddleware, saveActiveBotGame);

router.delete("/", authMiddleware.authMiddleware, deleteActiveBotGame);

module.exports = router;
