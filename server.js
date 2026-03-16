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

    if (!rooms[roomId]) {
      rooms[roomId] = [];
    }

    rooms[roomId].push(socket.id);

    const isHost = rooms[roomId][0] === socket.id;

    socket.emit("host-status", isHost);

    io.to(roomId).emit("system-message", `${username} joined the room`);

  });


  socket.on("send-message", ({ roomId, message }) => {

    io.to(roomId).emit("receive-message", {
      username: socket.username,
      message
    });

  });


  socket.on("set-video", ({ roomId, videoId }) => {

    io.to(roomId).emit("load-video", videoId);

  });


  socket.on("disconnect", () => {

    const roomId = socket.roomId;

    if (!roomId || !rooms[roomId]) return;

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