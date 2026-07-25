const mongoose = require("mongoose");

const statsSchema = {
  rating: {
    type: Number,
    default: 800,
  },

  rd: { 
    type: Number,
    default: 350 
  },

  gamesPlayed: {
    type: Number,
    default: 0,
  },

  wins: {
    type: Number,
    default: 0,
  },

  losses: {
    type: Number,
    default: 0,
  },

  draws: {
    type: Number,
    default: 0,
  },
};

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },

    password: {
      type: String,
      required: true,
    },

    stats: {
      bullet: statsSchema,
      blitz: statsSchema,
      rapid: statsSchema,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("User", userSchema);
