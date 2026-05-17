const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const rooms = {};

const WORDS = ["Pizza", "Ocean", "School", "Phone", "Car", "Movie"];

const PHASES = {
  LOBBY: "lobby",
  ROLE: "role",
  CLUE: "clue",
  VOTE: "vote",
  RESULTS: "results"
};

function randomWord() {
  return WORDS[Math.floor(Math.random() * WORDS.length)];
}

function startTimer(roomId, seconds, next) {
  const room = rooms[roomId];
  clearInterval(room.timer);

  room.timeLeft = seconds;

  room.timer = setInterval(() => {
    room.timeLeft--;
    io.to(roomId).emit("timer", room.timeLeft);

    if (room.timeLeft <= 0) {
      clearInterval(room.timer);
      next();
    }
  }, 1000);
}

function startClue(roomId) {
  const room = rooms[roomId];
  room.phase = PHASES.CLUE;
  io.to(roomId).emit("phase", room.phase);

  startTimer(roomId, 60, () => startVote(roomId));
}

function startVote(roomId) {
  const room = rooms[roomId];
  room.phase = PHASES.VOTE;
  room.votes = {};

  io.to(roomId).emit("phase", room.phase);

  startTimer(roomId, 30, () => showResults(roomId));
}

function showResults(roomId) {
  const room = rooms[roomId];
  room.phase = PHASES.RESULTS;

  io.to(roomId).emit("results", {
    imposter: room.imposter,
    votes: room.votes
  });
}

io.on("connection", (socket) => {
  socket.on("createRoom", (name, cb) => {
    const id = Math.random().toString(36).substring(2, 6).toUpperCase();

    rooms[id] = {
      host: socket.id,
      players: [],
      phase: PHASES.LOBBY,
      votes: {},
      word: "",
      imposter: null,
      timer: null
    };

    socket.join(id);
    rooms[id].players.push({ id: socket.id, name });

    cb(id);
    io.to(id).emit("players", rooms[id].players);
  });

  socket.on("joinRoom", (roomId, name, cb) => {
    const room = rooms[roomId];
    if (!room) return cb({ error: "Room not found" });

    socket.join(roomId);
    room.players.push({ id: socket.id, name });

    cb({ ok: true });
    io.to(roomId).emit("players", room.players);
  });

  socket.on("startGame", (roomId) => {
    const room = rooms[roomId];

    room.phase = PHASES.ROLE;
    room.word = randomWord();

    const imp = Math.floor(Math.random() * room.players.length);
    room.imposter = room.players[imp].id;

    room.players.forEach(p => {
      io.to(p.id).emit("role", {
        isImposter: p.id === room.imposter,
        word: p.id === room.imposter ? null : room.word
      });
    });

    io.to(roomId).emit("phase", room.phase);

    startTimer(roomId, 5, () => startClue(roomId));
  });

  socket.on("message", ({ roomId, msg, name }) => {
    io.to(roomId).emit("message", { msg, name });
  });

  socket.on("vote", ({ roomId, target }) => {
    const room = rooms[roomId];
    room.votes[target] = (room.votes[target] || 0) + 1;
    io.to(roomId).emit("votes", room.votes);
  });

  // simple reconnect support
  socket.on("rejoin", ({ roomId, name }) => {
    const room = rooms[roomId];
    if (!room) return;

    socket.join(roomId);
    room.players.push({ id: socket.id, name });

    io.to(roomId).emit("players", room.players);
  });
});

server.listen(3000, () => console.log("Phantom running on 3000"));
