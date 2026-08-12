const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const multer = require("multer");

const authRoutes = require("./routes/auth.routes");
const gameRoutes = require("./routes/game.routes");
const userRoutes = require("./routes/user.routes");
const activeBotGameRoutes = require("./routes/activeBotGame.routes");

const app = express();

app.use(
    cors({
        origin: "http://localhost:5173",
        credentials: true,
    })
);

app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api/games", gameRoutes);
app.use("/api/users", userRoutes);
app.use("/api/bot-games", activeBotGameRoutes);

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Chess Backend API Running",
  });
});


app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "Image must be 5MB or smaller"
        : err.message;
    return res.status(400).json({ success: false, message });
  }

  if (err) {
    return res.status(err.status || 500).json({
      success: false,
      message: err.message || "Something went wrong",
    });
  }

  next();
});

module.exports = app;