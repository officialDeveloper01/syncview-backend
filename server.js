const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

/*
Room structure:
rooms = {
  roomId: {
    host: socketId,
    password: string | null,
    users: [{ id, username }]
  }
}
*/

const rooms = {};

io.on("connection", (socket) => {

  // ================= CHECK ROOM =================
  socket.on("check-room", ({ roomId }) => {

    const room = rooms[roomId];

    if (!room) {
      socket.emit("room-check-result", {
        exists: false
      });
      return;
    }

    socket.emit("room-check-result", {
      exists: true,
      requiresPassword: !!room.password
    });

  });

  // ================= CREATE ROOM =================
  socket.on("create-room", ({ roomId, username, password }) => {

    if (rooms[roomId]) {
      socket.emit("room-error", "Room already exists");
      return;
    }

    rooms[roomId] = {
      host: socket.id,
      password: password || null,
      users: []
    };

    socket.join(roomId);
    socket.roomId = roomId;
    socket.username = username;

    rooms[roomId].users.push({
      id: socket.id,
      username
    });

    socket.emit("room-created", { roomId });
    socket.emit("host-status", true);

    io.to(roomId).emit("room-users", {
      users: rooms[roomId].users,
      host: rooms[roomId].host
    });

  });

  // ================= JOIN ROOM =================
  socket.on("join-room", ({ roomId, username, password }) => {

    const room = rooms[roomId];

    if (!room) {
      socket.emit("room-error", "Room does not exist");
      return;
    }

    if (room.password && room.password !== password) {
      socket.emit("room-error", "Incorrect password");
      return;
    }

    socket.join(roomId);
    socket.roomId = roomId;
    socket.username = username;

    room.users.push({
      id: socket.id,
      username
    });

    const isHost = room.host === socket.id;
    socket.emit("host-status", isHost);

    io.to(roomId).emit("system-message", `${username} joined`);

    io.to(roomId).emit("room-users", {
      users: room.users,
      host: room.host
    });

    // 🔥 instant sync
    const hostSocket = io.sockets.sockets.get(room.host);
    if (hostSocket && hostSocket.id !== socket.id) {
      hostSocket.emit("request-sync", socket.id);
    }

  });

  // ================= CHAT =================
  socket.on("send-message", ({ roomId, message }) => {
    io.to(roomId).emit("receive-message", {
      username: socket.username,
      message
    });
  });

  // ================= VIDEO =================
  socket.on("set-video", ({ roomId, videoId }) => {
    if (rooms[roomId]?.host !== socket.id) return;
    io.to(roomId).emit("load-video", videoId);
  });

  socket.on("video-play", ({ roomId, time, timestamp }) => {
    if (rooms[roomId]?.host !== socket.id) return;
    socket.to(roomId).emit("video-play", { time, timestamp });
  });

  socket.on("video-pause", ({ roomId, time, timestamp }) => {
    if (rooms[roomId]?.host !== socket.id) return;
    socket.to(roomId).emit("video-pause", { time, timestamp });
  });

  socket.on("video-seek", ({ roomId, time }) => {
    if (rooms[roomId]?.host !== socket.id) return;
    socket.to(roomId).emit("video-seek", time);
  });

  socket.on("video-buffering", ({ roomId, time, timestamp }) => {
    socket.to(roomId).emit("video-buffering", { time, timestamp });
  });

  // ================= SYNC =================
  socket.on("sync-response", ({ target, time }) => {
    io.to(target).emit("sync-video", { time });
  });

  // ================= DISCONNECT =================
  socket.on("disconnect", () => {

    const roomId = socket.roomId;
    if (!roomId || !rooms[roomId]) return;

    const room = rooms[roomId];

    room.users = room.users.filter(u => u.id !== socket.id);

    io.to(roomId).emit("system-message", `${socket.username} left`);

    if (room.host === socket.id) {
      const newHost = room.users[0];
      if (newHost) {
        room.host = newHost.id;
        io.to(newHost.id).emit("host-status", true);
      }
    }

    io.to(roomId).emit("room-users", {
      users: room.users,
      host: room.host
    });

    if (room.users.length === 0) {
      delete rooms[roomId];
    }

  });

});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log("Server running on", PORT);
});