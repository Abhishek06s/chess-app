const Game = require("../models/game.model");
const User = require("../models/user.model");
const { calculateNewRating } = require("../utils/elo.util");

/**
 * Create Game
 */
const createGame = async (req, res) => {
  try {
    const {
      whitePlayer,
      blackPlayer,
      pgn,
      fen,
      moves,
      result,
      opening,
      timeControl,
      gameType,
      whiteTimeRemaining,
      blackTimeRemaining,
      opponentType,
      opponentName,
      rated,
      termination,
      status,
    } = req.body;

    
    if (!timeControl || typeof timeControl.base !== "number") {
      return res
      .status(400)
      .json({ success: false, message: "Invalid time control" });
    }
    
    const validGameTypes = ["bullet", "blitz", "rapid"];
    if (!validGameTypes.includes(gameType)) {
      return res
      .status(400)
      .json({ success: false, message: "Invalid game type" });
    }
    
    if (termination === "abort") {
      return res.status(400).json({
        success: false,
        message: "Aborted games are not stored",
      });
    }

    const finalWhitePlayer = whitePlayer || req.user._id;
    const finalBlackPlayer = blackPlayer || req.user._id;

    const game = await Game.create({
      whitePlayer: finalWhitePlayer,
      blackPlayer: finalBlackPlayer,
      pgn,
      fen,
      moves,
      result,
      opening,
      timeControl,
      gameType,
      whiteTimeRemaining,
      blackTimeRemaining,
      opponentType,
      opponentName,
      rated,
      termination,
      status,
    });

    const whiteUser = await User.findById(finalWhitePlayer);
    const blackUser = await User.findById(finalBlackPlayer);

    if (!whiteUser || !blackUser) {
      return res.status(404).json({
        success: false,
        message: "Player account profile not found",
      });
    }

    /**
     * SELF-PLAY HANDLING (White ID matches Black ID)
     */
    if (whiteUser._id.toString() === blackUser._id.toString()) {
      const userStats = whiteUser.stats[gameType];
      userStats.gamesPlayed += 1;

      if (result === "1-0") {
        userStats.wins += 1;
      } else if (result === "0-1") {
        userStats.losses += 1;
      } else {
        userStats.draws += 1;
      }

      await whiteUser.save();
    } else {
      /**
       * MULTIPLAYER HANDLING (Different Player IDs)
       */
      const whiteStats = whiteUser.stats[gameType];
      const blackStats = blackUser.stats[gameType];

      whiteStats.gamesPlayed += 1;
      blackStats.gamesPlayed += 1;

      if (result === "1-0") {
        whiteStats.wins += 1;
        blackStats.losses += 1;
      } else if (result === "0-1") {
        blackStats.wins += 1;
        whiteStats.losses += 1;
      } else {
        whiteStats.draws += 1;
        blackStats.draws += 1;
      }

      await whiteUser.save();
      await blackUser.save();
    }

    res.status(201).json({
      success: true,
      game,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get My Games
 */

const getMyGames = async (req, res) => {
  try {
    const games = await Game.find({
      $or: [{ whitePlayer: req.user._id }, { blackPlayer: req.user._id }],
    })
      .populate("whitePlayer", "username stats")
      .populate("blackPlayer", "username stats")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: games.length,
      games,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get Particular Game
 */

const getGameById = async (req, res) => {
  try {
    const game = await Game.findById(req.params.id)
      .populate("whitePlayer", "username stats")
      .populate("blackPlayer", "username stats");

    if (!game) {
      return res.status(404).json({
        success: false,
        message: "Game not found",
      });
    }

    res.status(200).json({
      success: true,
      game,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Delete Particular Game
 */

const deleteGame = async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);

    if (!game) {
      return res.status(404).json({
        success: false,
        message: "Game not found",
      });
    }

    const isParticipant =
      game.whitePlayer.toString() === req.user._id.toString() ||
      game.blackPlayer.toString() === req.user._id.toString();

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    await game.deleteOne();

    res.status(200).json({
      success: true,
      message: "Game deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  createGame,
  getMyGames,
  getGameById,
  deleteGame,
};