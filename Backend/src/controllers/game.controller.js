const Game = require("../models/game.model");
const User = require("../models/user.model");

/**
 * -Create_Game
 */

const createGame = async (req, res) => {
  try {
    const {
      blackPlayer,
      pgn,
      fen,
      moves,
      result,
      opening,
      timeControl,
      whiteTimeRemaining,
      blackTimeRemaining,
      gameMode,
    } = req.body;

    const game = await Game.create({
      whitePlayer: req.user._id,

      // temporary fallback until multiplayer is built
      blackPlayer: blackPlayer || req.user._id,

      pgn,
      fen,
      moves,
      result,
      opening,
      timeControl,
      whiteTimeRemaining,
      blackTimeRemaining,
      gameMode,
    });

    const whiteUser = await User.findById(game.whitePlayer);
    const blackUser = await User.findById(game.blackPlayer);

    if (whiteUser._id.toString() === blackUser._id.toString()) {
      whiteUser.gamesPlayed += 1;

      if (result === "1-0") {
        whiteUser.wins += 1;
      } else if (result === "0-1") {
        whiteUser.losses += 1;
      } else {
        whiteUser.draws += 1;
      }

      await whiteUser.save();
    } else {
      whiteUser.gamesPlayed += 1;
      blackUser.gamesPlayed += 1;

      if (result === "1-0") {
        whiteUser.wins += 1;
        blackUser.losses += 1;
      } else if (result === "0-1") {
        blackUser.wins += 1;
        whiteUser.losses += 1;
      } else {
        whiteUser.draws += 1;
        blackUser.draws += 1;
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
 *- Get_My_Games
 */

const getMyGames = async (req, res) => {
  try {
    const games = await Game.find({
      $or: [{ whitePlayer: req.user._id }, { blackPlayer: req.user._id }],
    })
      .populate("whitePlayer", "username rating")
      .populate("blackPlayer", "username rating")
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
 *- Get_ParticularGame
 */

const getGameById = async (req, res) => {
  try {
    const game = await Game.findById(req.params.id)
      .populate("whitePlayer", "username rating")
      .populate("blackPlayer", "username rating");

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
 *- Delete_ParticularGame
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
