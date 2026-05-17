const socket = io();

let roomId = "";
let playerName = "";

function createRoom() {
  playerName = document.getElementById("name").value;

  socket.emit("createRoom", playerName, (id) => {
    roomId = id;
    showLobby();
  });
}

function joinRoom() {
  playerName = document.getElementById("name").value;
  roomId = document.getElementById("roomId").value;

  socket.emit("joinRoom", roomId, playerName, (res) => {
    if (res.error) return alert(res.error);
    showLobby();
  });
}

function showLobby() {
  document.getElementById("menu").classList.add("hidden");
  document.getElementById("lobby").classList.remove("hidden");
  document.getElementById("code").innerText = roomId;
}

function startGame() {
  socket.emit("startGame", roomId);
}

socket.on("updatePlayers", (players) => {
  const div = document.getElementById("players");
  div.innerHTML = players.map(p => `<p>${p.name}</p>`).join("");

  const voteBox = document.getElementById("voteBox");
  voteBox.innerHTML = players.map(p =>
    `<button onclick="vote('${p.id}')">${p.name}</button>`
  ).join("");
});

socket.on("gameStarted", () => {
  document.getElementById("lobby").classList.add("hidden");
  document.getElementById("game").classList.remove("hidden");
});

socket.on("role", (data) => {
  const roleText = data.isImposter
    ? "You are the IMPOSTER"
    : `Word: ${data.word}`;

  document.getElementById("role").innerText = roleText;
});

function sendMsg() {
  const msg = document.getElementById("msg").value;
  socket.emit("sendMessage", { roomId, message: msg, name: playerName });
}

socket.on("message", (data) => {
  const chat = document.getElementById("chat");
  chat.innerHTML += `<p><b>${data.name}:</b> ${data.message}</p>`;
});

function vote(targetId) {
  socket.emit("vote", { roomId, targetId });
}
