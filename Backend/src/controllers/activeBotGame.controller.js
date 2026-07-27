const ActiveBotGame = require("../models/activeBotGame.model");

/**
 * Get the logged-in user's in-progress bot game, if any.
 */
const getActiveBotGame = async (req, res) => {
  try {
    const activeGame = await ActiveBotGame.findOne({ user: req.user._id });

    res.status(200).json({
      success: true,
      activeGame: activeGame || null,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Create or overwrite the logged-in user's in-progress bot game.
 * Called after every move so the game can be resumed on refresh or from
 * another browser. One document per user — a fresh call always replaces
 * whatever was there before.
 */
const saveActiveBotGame = async (req, res) => {
  try {
    const { fen, moves, playerColor, difficulty } = req.body;

    if (!fen)
      return res
        .status(400)
        .json({ success: false, message: "fen is required" });

    if (!["white", "black"].includes(playerColor))
      return res
        .status(400)
        .json({ success: false, message: "Invalid playerColor" });

    const activeGame = await ActiveBotGame.findOneAndUpdate(
      { user: req.user._id },
      {
        user: req.user._id,
        fen,
        moves: Array.isArray(moves) ? moves : [],
        playerColor,
        ...(typeof difficulty === "string" && difficulty && { difficulty }),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    res.status(200).json({
      success: true,
      activeGame,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Clear the logged-in user's in-progress bot game (called once it ends).
 */
const deleteActiveBotGame = async (req, res) => {
  try {
    await ActiveBotGame.deleteOne({ user: req.user._id });

    res.status(200).json({
      success: true,
      message: "Active bot game cleared",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  getActiveBotGame,
  saveActiveBotGame,
  deleteActiveBotGame,
};