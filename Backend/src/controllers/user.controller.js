const User = require("../models/user.model");

/**
 * Get Profile
 */

const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get Leaderboard
 *
 * Query Params:
 * ?mode=bullet
 * ?mode=blitz
 * ?mode=rapid
 */

const getLeaderboard = async (req, res) => {
  try {
    const mode = req.query.mode || "rapid";

    const validModes = ["bullet", "blitz", "rapid"];

    if (!validModes.includes(mode)) {
      return res.status(400).json({
        success: false,
        message: "Invalid leaderboard mode",
      });
    }

    const users = await User.find()
      .select("-password")
      .sort({
        [`stats.${mode}.rating`]: -1,
      })
      .limit(50);

    res.status(200).json({
      success: true,
      mode,
      count: users.length,
      users,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  getProfile,
  getLeaderboard,
};