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

    // URL of the user's custom-uploaded avatar (Cloudinary secure_url).
    // null/empty means "no custom avatar yet" — the frontend falls back to
    // the default pawn avatar in that case.
    avatar: {
      type: String,
      default: null,
    },

    // Cloudinary public_id for the current avatar asset, kept so we can
    // cleanly delete/replace the old image when a new one is uploaded.
    avatarPublicId: {
      type: String,
      default: null,
    },

    stats: {
      bullet: statsSchema,
      blitz: statsSchema,
      rapid: statsSchema,
    },

    friends: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    friendRequests: {
      sent: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      ],
      received: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      ],
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("User", userSchema);