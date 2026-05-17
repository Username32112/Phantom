const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const rooms = {};

const words = ["Pizza", "School", "Ocean", "Phone", "Car", "Movie"];

function getRandomWord() {
  return words[Math.floor(Math.random() * words.length)];
}

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("createRoom", (name, cb) => {
    const roomId = Math.random().toString(36).substring(2, 6).toUpperCase();

    rooms[roomId] = {
      host: socket.id,
      players: [],
      gameStarted: false,
      word: "",
      imposter: null,
      votes: {}
    };

    socket.join(roomId);
    rooms[roomId].players.push({ id: socket.id, name });

    cb(roomId);
    io.to(roomId).emit("updatePlayers", rooms[roomId].players);
  });

  socket.on("joinRoom", (roomId, name, cb) => {
    const room = rooms[roomId];
    if (!room) return cb({ error: "Room not found" });

    socket.join(roomId);
    room.players.push({ id: socket.id, name });

    cb({ success: true });
    io.to(roomId).emit("updatePlayers", room.players);
  });

  socket.on("startGame", (roomId) => {
    const room = rooms[roomId];
    if (!room) return;

    room.word = getRandomWord();
    room.gameStarted = true;
    room.votes = {};

    const imposterIndex = Math.floor(Math.random() * room.players.length);
    room.imposter = room.players[imposterIndex].id;

    room.players.forEach((p) => {
      socket.to(p.id).emit("role", {
        isImposter: p.id === room.imposter,
        word: p.id === room.imposter ? null : room.word
      });
    });

    io.to(roomId).emit("gameStarted");
  });

  socket.on("sendMessage", ({ roomId, message, name }) => {
    io.to(roomId).emit("message", { message, name });
  });

  socket.on("vote", ({ roomId, targetId }) => {
    const room = rooms[roomId];
    if (!room) return;

    room.votes[targetId] = (room.votes[targetId] || 0) + 1;

    io.to(roomId).emit("voteUpdate", room.votes);
  });
});

server.listen(3000, () => console.log("Server running on port 3000"));
