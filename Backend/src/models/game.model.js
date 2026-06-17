const mongoose = require("mongoose");

const gameSchema = new mongoose.Schema(
  {
    whitePlayer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    blackPlayer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    pgn: {
      type: String,
      required: true,
    },

    fen: {
      type: String,
      required: true,
    },

    moves: [
      {
        type: String,
      },
    ],

    result: {
      type: String,
      enum: ["1-0", "0-1", "1/2-1/2"],
      required: true,
    },

    opening: {
      name: {
        type: String,
        default: "Unknown",
      },

      eco: {
        type: String,
        default: "",
      },
    },

    timeControl: {
      type: Number,
      default: 600,
    },

    whiteTimeRemaining: {
      type: Number,
      default: 0,
    },

    blackTimeRemaining: {
      type: Number,
      default: 0,
    },

    gameMode: {
      type: String,
      enum: ["bot", "casual", "ranked"],
      default: "bot",
    },

    status: {
      type: String,
      enum: ["completed", "abandoned"],
      default: "completed",
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Game", gameSchema);
