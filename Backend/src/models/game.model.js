const mongoose = require("mongoose");

const gameSchema = new mongoose.Schema(
  {
    whitePlayer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: function () {
        return this.opponentType === "human";
      },
    },

    blackPlayer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: function () {
        return this.opponentType === "human";
      },
    },

    player1: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: function () {
        return this.opponentType === "human";
      },
    },

    player2: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: function () {
        return this.opponentType === "human";
      },
    },

    whiteRating: {
      type: Number,
      default: null,
      required: function () {
        return this.opponentType === "human";
      },
    },

    blackRating: {
      type: Number,
      default: null,
      required: function () {
        return this.opponentType === "human";
      },
    },

    roomId: {
      type: String,
      default: null,
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
      required: function () {
        return this.opponentType === "human";
      },
    },

    blackTimeRemaining: {
      type: Number,
      default: 0,
      required: function () {
        return this.opponentType === "human";
      },
    },

    opponentType: {
      type: String,
      enum: ["bot", "human"],
      required: true,
    },

    opponentName: {
      type: String,
      default: "Stockfish Bot",
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
        "abandonment",
        "draw",
        "stalemate",
        "insufficient-material",
        "threefold-repetition",
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

gameSchema.index(
  { roomId: 1 },
  { unique: true, partialFilterExpression: { roomId: { $type: "string" } } },
);

module.exports = mongoose.model("Game", gameSchema);
