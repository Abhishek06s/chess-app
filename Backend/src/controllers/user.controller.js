const User = require("../models/user.model");
const { emitToUser } = require("../../socket/socket");
const cloudinary = require("../config/cloudinary.config");

// Fields every user-facing list/lookup should carry so the frontend can
// render an avatar (or fall back to the default pawn) without extra calls.
const PUBLIC_USER_FIELDS = "username stats avatar";

/**
 * Get Profile
 */

const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select("-password")
      .populate("friends", PUBLIC_USER_FIELDS)
      .populate("friendRequests.received", PUBLIC_USER_FIELDS)
      .populate("friendRequests.sent", PUBLIC_USER_FIELDS);

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get Leaderboard
 *
 * Query Params:
 * ?mode=bullet
 * ?mode=blitz
 * ?mode=rapid
 */

const getLeaderboard = async (req, res) => {
  try {
    const mode = req.query.mode || "rapid";

    const validModes = ["bullet", "blitz", "rapid"];

    if (!validModes.includes(mode)) {
      return res.status(400).json({
        success: false,
        message: "Invalid leaderboard mode",
      });
    }

    const users = await User.find()
      .select("-password")
      .sort({
        [`stats.${mode}.rating`]: -1,
      })
      .limit(50);

    res.status(200).json({
      success: true,
      mode,
      count: users.length,
      users,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get Profile by Username
 *
 * Params:
 * /magnus_carlsen
 * /hikaru_nakamura
 * /fabiano_caruana
 */

const getUserByUsername = async (req, res) => {
  try {
    const user = await User.findOne({
      username: req.params.username,
    })
      .select("-password")
      .populate("friends", PUBLIC_USER_FIELDS);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Search Users
 *
 * Query Params:
 * ?q=magnus
 */

const searchUsers = async (req, res) => {
  try {
    const query = (req.query.q || "").trim();

    if (!query) {
      return res.status(200).json({
        success: true,
        users: [],
      });
    }

    const users = await User.find({
      username: { $regex: `^${query}`, $options: "i" },
      _id: { $ne: req.user._id },
    })
      .select("username stats avatar friends friendRequests")
      .limit(10);

    const currentUserId = req.user._id.toString();

    const results = users.map((user) => {
      const isFriend = user.friends?.some(
        (id) => id.toString() === currentUserId,
      );
      const requestSentByMe = user.friendRequests?.received?.some(
        (id) => id.toString() === currentUserId,
      );
      const requestReceivedFromThem = user.friendRequests?.sent?.some(
        (id) => id.toString() === currentUserId,
      );

      return {
        _id: user._id,
        username: user.username,
        avatar: user.avatar || null,
        rating: user.stats?.rapid?.rating,
        stats: user.stats,
        isFriend,
        requestSentByMe,
        requestReceivedFromThem,
      };
    });

    res.status(200).json({
      success: true,
      users: results,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get Pending Friend Requests (received)
 */

const getPendingRequests = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select("friendRequests")
      .populate("friendRequests.received", PUBLIC_USER_FIELDS);

    res.status(200).json({
      success: true,
      count: user.friendRequests.received.length,
      requests: user.friendRequests.received,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Send Friend Request
 *
 * Params:
 * /friends/request/:userId  (userId of the user to send a request to)
 */

const sendFriendRequest = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id.toString();

    if (userId === currentUserId) {
      return res.status(400).json({
        success: false,
        message: "You cannot send a friend request to yourself",
      });
    }

    const [currentUser, targetUser] = await Promise.all([
      User.findById(currentUserId),
      User.findById(userId),
    ]);

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (currentUser.friends.some((id) => id.toString() === userId)) {
      return res.status(400).json({
        success: false,
        message: "You are already friends with this user",
      });
    }

    if (
      currentUser.friendRequests.sent.some((id) => id.toString() === userId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Friend request already sent",
      });
    }

    if (
      currentUser.friendRequests.received.some(
        (id) => id.toString() === userId,
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "This user already sent you a friend request — accept it instead",
      });
    }

    currentUser.friendRequests.sent.push(userId);
    targetUser.friendRequests.received.push(currentUserId);

    await Promise.all([currentUser.save(), targetUser.save()]);

    // Push a real-time notification to the target user if they're
    // currently online, so it shows up instantly in their notification bell.
    emitToUser(userId, "friend-request-received", {
      from: {
        _id: currentUser._id,
        username: currentUser.username,
        avatar: currentUser.avatar || null,
        stats: currentUser.stats,
      },
    });

    res.status(200).json({
      success: true,
      message: "Friend request sent",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Accept Friend Request
 *
 * Params:
 * /friends/accept/:userId  (userId of the user whose request you're accepting)
 */

const acceptFriendRequest = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id.toString();

    const [currentUser, senderUser] = await Promise.all([
      User.findById(currentUserId),
      User.findById(userId),
    ]);

    if (!senderUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (
      !currentUser.friendRequests.received.some(
        (id) => id.toString() === userId,
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "No pending friend request from this user",
      });
    }

    currentUser.friendRequests.received =
      currentUser.friendRequests.received.filter(
        (id) => id.toString() !== userId,
      );
    senderUser.friendRequests.sent = senderUser.friendRequests.sent.filter(
      (id) => id.toString() !== currentUserId,
    );

    currentUser.friends.push(userId);
    senderUser.friends.push(currentUserId);

    await Promise.all([currentUser.save(), senderUser.save()]);

    // Let the original sender know (in real time) that their request was
    // accepted, in case they're currently online.
    emitToUser(userId, "friend-request-accepted", {
      by: {
        _id: currentUser._id,
        username: currentUser.username,
        avatar: currentUser.avatar || null,
      },
    });

    res.status(200).json({
      success: true,
      message: "Friend request accepted",
      friend: {
        _id: senderUser._id,
        username: senderUser.username,
        avatar: senderUser.avatar || null,
        stats: senderUser.stats,
      },
      pendingCount: currentUser.friendRequests.received.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Reject Friend Request
 *
 * Params:
 * /friends/reject/:userId  (userId of the user whose request you're rejecting)
 */

const rejectFriendRequest = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id.toString();

    const currentUser = await User.findById(currentUserId);

    if (
      !currentUser.friendRequests.received.some(
        (id) => id.toString() === userId,
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "No pending friend request from this user",
      });
    }

    currentUser.friendRequests.received =
      currentUser.friendRequests.received.filter(
        (id) => id.toString() !== userId,
      );

    await currentUser.save();

    const senderUser = await User.findById(userId);
    if (senderUser) {
      senderUser.friendRequests.sent = senderUser.friendRequests.sent.filter(
        (id) => id.toString() !== currentUserId,
      );
      await senderUser.save();
    }

    res.status(200).json({
      success: true,
      message: "Friend request rejected",
      pendingCount: currentUser.friendRequests.received.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Remove Friend (mutual)
 *
 * Params:
 * /friends/:userId  (userId of the friend to remove)
 */

const removeFriend = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id.toString();

    const currentUser = await User.findById(currentUserId);

    if (!currentUser.friends.some((id) => id.toString() === userId)) {
      return res.status(400).json({
        success: false,
        message: "User is not in your friends list",
      });
    }

    currentUser.friends = currentUser.friends.filter(
      (id) => id.toString() !== userId,
    );
    await currentUser.save();

    const friendUser = await User.findById(userId);
    if (friendUser) {
      friendUser.friends = friendUser.friends.filter(
        (id) => id.toString() !== currentUserId,
      );
      await friendUser.save();
    }

    res.status(200).json({
      success: true,
      message: "Friend removed successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Upload / replace the logged-in user's avatar
 */

const uploadAvatarImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image file was provided",
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Re-uses the same public_id (namespaced under the user's id) every
    // time, so a re-upload simply overwrites the previous asset in
    // Cloudinary instead of leaking orphaned images.
    const publicId = `chess-app/avatars/${user._id}`;

    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          public_id: publicId,
          overwrite: true,
          resource_type: "image",
          folder: undefined,
          transformation: [
            { width: 512, height: 512, crop: "fill", gravity: "face" },
          ],
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        },
      );
      uploadStream.end(req.file.buffer);
    });

    user.avatar = uploadResult.secure_url;
    user.avatarPublicId = uploadResult.public_id;
    await user.save();

    res.status(200).json({
      success: true,
      avatar: user.avatar,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to upload avatar",
    });
  }
};

/**
 * Remove the logged-in user's avatar (reverts to the default pawn avatar)
 */

const removeAvatarImage = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.avatarPublicId) {
      try {
        await cloudinary.uploader.destroy(user.avatarPublicId);
      } catch (destroyError) {
        // Not fatal — worst case an orphaned asset is left in Cloudinary.
        console.error("Cloudinary destroy failed:", destroyError.message);
      }
    }

    user.avatar = null;
    user.avatarPublicId = null;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Avatar removed",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Batch-resolve avatars for a list of usernames.

 * Query Params:
 * ?usernames=magnus_carlsen,hikaru_nakamura
 */

const getAvatarsByUsernames = async (req, res) => {
  try {
    const raw = (req.query.usernames || "").toString();
    const usernames = [
      ...new Set(
        raw
          .split(",")
          .map((u) => u.trim())
          .filter(Boolean),
      ),
    ].slice(0, 50);

    if (usernames.length === 0) {
      return res.status(200).json({
        success: true,
        avatars: {},
      });
    }

    const users = await User.find({ username: { $in: usernames } }).select(
      "username avatar",
    );

    const avatars = {};
    users.forEach((u) => {
      avatars[u.username] = u.avatar || null;
    });

    res.status(200).json({
      success: true,
      avatars,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  getProfile,
  getLeaderboard,
  getUserByUsername,
  searchUsers,
  getPendingRequests,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  removeFriend,
  uploadAvatarImage,
  removeAvatarImage,
  getAvatarsByUsernames,
};