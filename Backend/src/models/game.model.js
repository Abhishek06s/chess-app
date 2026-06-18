const mongoose = require("mongoose");

const gameSchema = new mongoose.Schema(
  {
    whitePlayer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: function() { return this.opponentType === "human"; }
    },

    blackPlayer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: function() { return this.opponentType === "human"; }
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
      base: {
        type: Number,
        required: true,
      },

      increment: {
        type: Number,
        default: 0,
      },
    },

    gameType: {
      type: String,
      enum: ["bullet", "blitz", "rapid"],
      required: true,
    },

    whiteTimeRemaining: {
      type: Number,
      default: 0,
    },

    blackTimeRemaining: {
      type: Number,
      default: 0,
    },

    opponentType: {
      type: String,
      enum: ["bot", "human"],
      required: true,
    },

    rated: {
      type: Boolean,
      default: false,
    },

    termination: {
      type: String,
      enum: [
        "checkmate",
        "timeout",
        "resignation",
        "draw",
        "stalemate",
        "insufficient-material",
        "threefold-repetition",
        "abort",
      ],
      required: true,
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
