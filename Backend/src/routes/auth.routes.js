const express = require("express");

const {
  register,
  login,
  logout,
} = require("../controllers/auth.controller");

const {authMiddleware , alreadyLoggedIn} = require("../middlewares/auth.middleware");

const router = express.Router();

router.post("/register", alreadyLoggedIn, register);
router.post("/login", alreadyLoggedIn, login);
router.post("/logout", logout);

router.get("/me", authMiddleware, (req, res) => {
  res.json({
    success: true,
    user: req.user,
  });
});

module.exports = router;