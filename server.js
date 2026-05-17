const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

// 🔑 Render port fix
const PORT = process.env.PORT || 3000;

// GAME STATE
const rooms = {};

const WORDS = ["Pizza", "Ocean", "School", "Phone", "Car", "Movie"];

const PHASES = {
  LOBBY: "lobby",
  ROLE: "role",
  CLUE: "clue",
  VOTE: "vote",
  RESULTS: "results"
};

// 🎲 random word
function randomWord() {
  return WORDS[Math.floor(Math.random() * WORDS.length)];
}

// ⏱️ timer system
function startTimer(roomId, seconds, next) {
  const room = rooms[roomId];
  if (!room) return;

  clearInterval(room.timer);

  room.timeLeft = seconds;

  room.timer = setInterval(() => {
    if (!rooms[roomId]) return clearInterval(room.timer);

    room.timeLeft--;
    io.to(roomId).emit("timer", room.timeLeft);

    if (room.timeLeft <= 0) {
      clearInterval(room.timer);
      next();
    }
  }, 1000);
}

// 🎮 PHASES
function startClue(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  room.phase = PHASES.CLUE;
  io.to(roomId).emit("phase", room.phase);

  startTimer(roomId, 60, () => startVote(roomId));
}

function startVote(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  room.phase = PHASES.VOTE;
  room.votes = {};

  io.to(roomId).emit("phase", room.phase);

  startTimer(roomId, 30, () => showResults(roomId));
}

function showResults(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  room.phase = PHASES.RESULTS;

  io.to(roomId).emit("results", {
    imposter: room.imposter,
    votes: room.votes
  });
}

// 🔌 SOCKET CONNECTION
io.on("connection", (socket) => {

  // CREATE ROOM
  socket.on("createRoom", (name, cb) => {
    const roomId = Math.random().toString(36).substring(2, 6).toUpperCase();

    rooms[roomId] = {
      host: socket.id,
      players: [],
      phase: PHASES.LOBBY,
      votes: {},
      word: "",
      imposter: null,
      timer: null
    };

    socket.join(roomId);

    rooms[roomId].players.push({
      id: socket.id,
      name
    });

    cb(roomId);
    io.to(roomId).emit("players", rooms[roomId].players);
  });

  // JOIN ROOM
  socket.on("joinRoom", (roomId, name, cb) => {
    const room = rooms[roomId];
    if (!room) return cb({ error: "Room not found" });

    socket.join(roomId);

    room.players.push({
      id: socket.id,
      name
    });

    cb({ ok: true });
    io.to(roomId).emit("players", room.players);
  });

  // START GAME
  socket.on("startGame", (roomId) => {
    const room = rooms[roomId];
    if (!room) return;

    room.phase = PHASES.ROLE;
    room.word = randomWord();

    const impIndex = Math.floor(Math.random() * room.players.length);
    room.imposter = room.players[impIndex]?.id;

    room.players.forEach(p => {
      io.to(p.id).emit("role", {
        isImposter: p.id === room.imposter,
        word: p.id === room.imposter ? null : room.word
      });
    });

    io.to(roomId).emit("phase", room.phase);

    startTimer(roomId, 5, () => startClue(roomId));
  });

  // CHAT
  socket.on("message", ({ roomId, msg, name }) => {
    if (!rooms[roomId]) return;
    io.to(roomId).emit("message", { msg, name });
  });

  // VOTE
  socket.on("vote", ({ roomId, target }) => {
    const room = rooms[roomId];
    if (!room) return;

    room.votes[target] = (room.votes[target] || 0) + 1;

    io.to(roomId).emit("votes", room.votes);
  });

  // REJOIN (basic safety)
  socket.on("rejoin", ({ roomId, name }) => {
    const room = rooms[roomId];
    if (!room) return;

    socket.join(roomId);

    room.players.push({
      id: socket.id,
      name
    });

    io.to(roomId).emit("players", room.players);
  });

  // DISCONNECT CLEANUP
  socket.on("disconnect", () => {
    for (const roomId in rooms) {
      rooms[roomId].players = rooms[roomId].players.filter(
        p => p.id !== socket.id
      );

      io.to(roomId).emit("players", rooms[roomId].players);
    }
  });
});

// 🚀 START SERVER (Render-ready)
server.listen(PORT, () => {
  console.log("Phantom running on port " + PORT);
});
