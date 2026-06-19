require("dotenv").config();

const app = require("./src/app");
const connectDB = require("./src/config/db.config");
const { initializeSocket } = require("./socket/socket")

const PORT = process.env.PORT || 5000;

connectDB();

const http = require("http");
const server = http.createServer(app);

initializeSocket(server);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});