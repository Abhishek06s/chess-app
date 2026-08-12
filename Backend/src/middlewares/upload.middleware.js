const multer = require("multer");

// Files are kept in memory (req.file.buffer) and streamed straight to
// Cloudinary in the controller — never written to local disk. 
const storage = multer.memoryStorage();

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const fileFilter = (req, file, cb) => {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    return cb(
      new Error("Only JPG, PNG, WEBP, or GIF images are allowed"),
      false,
    );
  }
  cb(null, true);
};

const uploadAvatar = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

module.exports = { uploadAvatar };