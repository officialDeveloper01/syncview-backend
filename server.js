const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

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

    if (!rooms[roomId]) {
      rooms[roomId] = [];
    }

    rooms[roomId].push(socket.id);

    io.to(roomId).emit("system-message", `${username} joined the room`);

  });

  socket.on("send-message", (data) => {

    io.to(data.roomId).emit("receive-message", {
      username: socket.username,
      message: data.message
    });

  });

  socket.on("disconnect", () => {

    const roomId = socket.roomId;

    if (!roomId) return;

    rooms[roomId] = rooms[roomId].filter(id => id !== socket.id);

    io.to(roomId).emit(
      "system-message",
      `${socket.username} left the room`
    );

    if (rooms[roomId].length === 0) {
      delete rooms[roomId];
    }

  });

});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});