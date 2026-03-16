const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

app.get("/", (req, res) => {
  res.send("SyncView backend running");
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

const rooms = {};

io.on("connection", (socket) => {

  socket.on("join-room", ({ roomId, username }) => {

    socket.join(roomId);

    socket.roomId = roomId;
    socket.username = username;

    // Create room if it doesn't exist
    if (!rooms[roomId]) {
      rooms[roomId] = {
        host: socket.id,
        users: []
      };
    }

    rooms[roomId].users.push(socket.id);

    // Check if this user is the host
    const isHost = rooms[roomId].host === socket.id;

    socket.emit("host-status", isHost);

    io.to(roomId).emit(
      "system-message",
      `${username} joined the room`
    );

  });

  socket.on("send-message", ({ roomId, message }) => {

    io.to(roomId).emit("receive-message", {
      username: socket.username,
      message
    });

  });

  socket.on("set-video", ({ roomId, videoId }) => {

    // Only host can set video
    if (rooms[roomId]?.host !== socket.id) return;

    io.to(roomId).emit("load-video", videoId);

  });

  socket.on("disconnect", () => {

    const roomId = socket.roomId;

    if (!roomId || !rooms[roomId]) return;

    rooms[roomId].users =
      rooms[roomId].users.filter(id => id !== socket.id);

    io.to(roomId).emit(
      "system-message",
      `${socket.username} left the room`
    );

    // If host leaves, assign new host
    if (rooms[roomId].host === socket.id) {

      const newHost = rooms[roomId].users[0];

      if (newHost) {
        rooms[roomId].host = newHost;

        io.to(newHost).emit("host-status", true);
      }

    }

    // Delete empty room
    if (rooms[roomId].users.length === 0) {
      delete rooms[roomId];
    }

  });

});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});