const jwt = require("jsonwebtoken");
const User = require("../models/user.model");

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.cookies.token || req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Not authorized",
      });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    req.user = await User.findById(decoded.id).select(
      "-password"
    );

    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: "Invalid token",
    });
  }
};

const alreadyLoggedIn = (req, res, next) => {
  const token = req.cookies?.token;

  if (token) {
    return res.status(400).json({
      success: false,
      message: "Already logged in",
    });
  }

  next();
};

module.exports = {authMiddleware , alreadyLoggedIn}