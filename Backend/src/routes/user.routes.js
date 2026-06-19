const express = require("express");

const {
  getProfile,
  getLeaderboard,
  getUserByUsername
} = require("../controllers/user.controller");

const authMiddleware = require("../middlewares/auth.middleware");

const router = express.Router();

router.get("/profile", authMiddleware.authMiddleware, getProfile);

router.get("/profile/:username", getUserByUsername);

router.get("/leaderboard", getLeaderboard);

module.exports = router;