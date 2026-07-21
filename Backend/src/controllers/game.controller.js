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
      roomId,
    } = req.body;

    if (!timeControl || typeof timeControl.base !== "number")
      return res
        .status(400)
        .json({ success: false, message: "Invalid time control" });

    const validGameTypes = ["bullet", "blitz", "rapid"];
    if (!validGameTypes.includes(gameType))
      return res
        .status(400)
        .json({ success: false, message: "Invalid game type" });

    if (termination === "abort")
      return res
        .status(400)
        .json({ success: false, message: "Aborted games are not stored" });

    const finalWhitePlayer = whitePlayer || req.user._id;
    const finalBlackPlayer = blackPlayer || req.user._id;

    const finalPlayer1 = opponentType === "human" ? finalWhitePlayer : undefined;
    const finalPlayer2 = opponentType === "human" ? finalBlackPlayer : undefined;

    if (opponentType === "human") {
      if (roomId) {
        const duplicateByRoom = await Game.findOne({ roomId });
        if (duplicateByRoom)
          return res
            .status(200)
            .json({ success: true, game: duplicateByRoom, deduplicated: true });
      } else {
        const thirtySecondsAgo = new Date(Date.now() - 30000);
        const duplicate = await Game.findOne({
          whitePlayer: finalWhitePlayer,
          blackPlayer: finalBlackPlayer,
          gameType,
          result,
          termination,
          createdAt: { $gte: thirtySecondsAgo },
        });
        if (duplicate)
          return res
            .status(200)
            .json({ success: true, game: duplicate, deduplicated: true });
      }
    }

    let game;
    try {
      game = await Game.create({
        whitePlayer: finalWhitePlayer,
        blackPlayer: finalBlackPlayer,
        player1: finalPlayer1,
        player2: finalPlayer2,
        roomId: opponentType === "human" ? roomId || null : null,
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
        rated: opponentType === "bot" ? false : !!rated, // bot games are always unrated
        termination,
        status,
      });
    } catch (error) {
      if (error.code === 11000 && roomId) {
        const existing = await Game.findOne({ roomId });
        if (existing)
          return res
            .status(200)
            .json({ success: true, game: existing, deduplicated: true });
      }
      throw error;
    }

    // ── Bot game: save record only, do NOT touch stats ────────────────────────
    if (opponentType === "bot") {
      return res.status(201).json({ success: true, game });
    }

    // ── Human (multiplayer) game: update stats + ratings ──────────────────────
    const whiteUser = await User.findById(finalWhitePlayer);
    const blackUser = await User.findById(finalBlackPlayer);

    if (!whiteUser || !blackUser)
      return res
        .status(404)
        .json({ success: false, message: "Player account not found" });

    const isSelfPlay = whiteUser._id.toString() === blackUser._id.toString();

    if (isSelfPlay) {
      // Self-play (edge case) — count stats once, no rating change
      const s = whiteUser.stats[gameType];
      s.gamesPlayed += 1;
      if (result === "1-0") s.wins += 1;
      else if (result === "0-1") s.losses += 1;
      else s.draws += 1;
      await whiteUser.save();
    } else {
      const ws = whiteUser.stats[gameType];
      const bs = blackUser.stats[gameType];

      ws.gamesPlayed += 1;
      bs.gamesPlayed += 1;

      if (result === "1-0") {
        ws.wins += 1;
        bs.losses += 1;
      } else if (result === "0-1") {
        bs.wins += 1;
        ws.losses += 1;
      } else {
        ws.draws += 1;
        bs.draws += 1;
      }

      // ── Elo update (rated games only) ─────────────────────────────────────
      if (rated) {
        const whiteScore = result === "1-0" ? 1 : result === "0-1" ? 0 : 0.5;
        const blackScore = 1 - whiteScore;

        ws.rating = calculateNewRating(
          ws.rating,
          bs.rating,
          whiteScore,
          ws.gamesPlayed,
        );
        bs.rating = calculateNewRating(
          bs.rating,
          ws.rating,
          blackScore,
          bs.gamesPlayed,
        );
      }

      await whiteUser.save();
      await blackUser.save();
    }

    res.status(201).json({ success: true, game });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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
      .populate("player1", "username stats")
      .populate("player2", "username stats")
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
      .populate("blackPlayer", "username stats")
      .populate("player1", "username stats")
      .populate("player2", "username stats");

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

/**
 * Get Games By User ID
 */
const getGamesByUserId = async (req, res) => {
  try {
    const { userId } = req.params;
  
    const games = await Game.find({
      $or: [{ whitePlayer: userId }, { blackPlayer: userId }],
    })
      .populate("whitePlayer", "username stats")
      .populate("blackPlayer", "username stats")
      .populate("player1", "username stats")
      .populate("player2", "username stats")
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

module.exports = {
  createGame,
  getMyGames,
  getGameById,
  deleteGame,
  getGamesByUserId,
};