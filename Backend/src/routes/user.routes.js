const express = require("express");

const {
  getProfile,
  getLeaderboard,
  getUserByUsername,
  searchUsers,
  getPendingRequests,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  removeFriend,
} = require("../controllers/user.controller");

const authMiddleware = require("../middlewares/auth.middleware");

const router = express.Router();

router.get("/profile", authMiddleware.authMiddleware, getProfile);

router.get("/search", authMiddleware.authMiddleware, searchUsers);

router.get(
  "/friends/requests",
  authMiddleware.authMiddleware,
  getPendingRequests,
);

router.post(
  "/friends/request/:userId",
  authMiddleware.authMiddleware,
  sendFriendRequest,
);

router.post(
  "/friends/accept/:userId",
  authMiddleware.authMiddleware,
  acceptFriendRequest,
);

router.post(
  "/friends/reject/:userId",
  authMiddleware.authMiddleware,
  rejectFriendRequest,
);

router.delete("/friends/:userId", authMiddleware.authMiddleware, removeFriend);

router.get("/profile/:username", getUserByUsername);

router.get("/leaderboard", getLeaderboard);

module.exports = router;