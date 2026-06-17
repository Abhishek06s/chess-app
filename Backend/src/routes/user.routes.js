const express = require("express");

const {
  getProfile,
  getLeaderboard,
} = require("../controllers/user.controller");

const authMiddleware = require("../middlewares/auth.middleware");

const router = express.Router();

router.get("/profile", authMiddleware.authMiddleware, getProfile);

router.get("/leaderboard", getLeaderboard);

module.exports = router;