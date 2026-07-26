const mongoose = require("mongoose");

// One document per user: the bot game currently in progress, if any.
// This is intentionally separate from the `Game` collection, which only
// stores completed games — this one is overwritten on every move and
// deleted once the game ends.
const activeBotGameSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
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

    playerColor: {
      type: String,
      enum: ["white", "black"],
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("ActiveBotGame", activeBotGameSchema);
