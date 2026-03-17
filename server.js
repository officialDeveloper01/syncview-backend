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

// Room structure:
// {
//   roomId: {
//     host: socketId,
//     users: [socketId]
//   }
// }

const rooms = {};

io.on("connection", (socket) => {

  // ========================
  // JOIN ROOM
  // ========================
  socket.on("join-room", ({ roomId, username }) => {

    socket.join(roomId);
    socket.roomId = roomId;
    socket.username = username;

    if (!rooms[roomId]) {
      rooms[roomId] = {
        host: socket.id,
        users: []
      };
    }

    rooms[roomId].users.push(socket.id);

    const isHost = rooms[roomId].host === socket.id;

    socket.emit("host-status", isHost);

    io.to(roomId).emit(
      "system-message",
      `${username} joined the room`
    );
  });

  // ========================
  // CHAT
  // ========================
  socket.on("send-message", ({ roomId, message }) => {

    io.to(roomId).emit("receive-message", {
      username: socket.username,
      message
    });

  });

  // ========================
  // SET VIDEO (HOST ONLY)
  // ========================
  socket.on("set-video", ({ roomId, videoId }) => {

    if (rooms[roomId]?.host !== socket.id) return;

    io.to(roomId).emit("load-video", videoId);

  });

  // ========================
  // PLAY
  // ========================
  socket.on("video-play", ({ roomId, time, timestamp }) => {

    if (rooms[roomId]?.host !== socket.id) return;

    socket.to(roomId).emit("video-play", {
      time,
      timestamp
    });

  });

  // ========================
  // PAUSE
  // ========================
  socket.on("video-pause", ({ roomId, time, timestamp }) => {

    if (rooms[roomId]?.host !== socket.id) return;

    socket.to(roomId).emit("video-pause", {
      time,
      timestamp
    });

  });

  // ========================
  // SEEK
  // ========================
  socket.on("video-seek", ({ roomId, time }) => {

    if (rooms[roomId]?.host !== socket.id) return;

    socket.to(roomId).emit("video-seek", time);

  });

  // ========================
  // DRIFT CORRECTION (REQUEST SYNC)
  // ========================
  socket.on("request-sync", ({ roomId }) => {

    const room = rooms[roomId];

    if (!room) return;

    const hostSocket = io.sockets.sockets.get(room.host);

    if (!hostSocket) return;

    // ask host to send current time to requester
    hostSocket.emit("send-sync", socket.id);

  });

  // ========================
  // HOST SENDS SYNC DATA
  // ========================
  socket.on("send-sync-data", ({ target, time }) => {

    io.to(target).emit("sync-data", { time });

  });

  // ========================
  // DISCONNECT
  // ========================
  socket.on("disconnect", () => {

    const roomId = socket.roomId;

    if (!roomId || !rooms[roomId]) return;

    rooms[roomId].users =
      rooms[roomId].users.filter(id => id !== socket.id);

    io.to(roomId).emit(
      "system-message",
      `${socket.username} left the room`
    );

    // Host leaves → assign new host
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