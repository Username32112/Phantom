const socket = io();

let roomId = "";
let name = "";

function create() {
  name = document.getElementById("name").value;

  socket.emit("createRoom", name, (id) => {
    roomId = id;
    showLobby();
  });
}

function join() {
  name = document.getElementById("name").value;
  roomId = document.getElementById("room").value;

  socket.emit("joinRoom", roomId, name, () => {
    showLobby();
  });
}

function showLobby() {
  document.getElementById("menu").classList.add("hidden");
  document.getElementById("lobby").classList.remove("hidden");
  document.getElementById("code").innerText = roomId;
}

function start() {
  socket.emit("startGame", roomId);
}

socket.on("players", (p) => {
  document.getElementById("players").innerHTML =
    p.map(x => `<p>${x.name}</p>`).join("");

  document.getElementById("vote").innerHTML =
    p.map(x => `<button onclick="vote('${x.id}')">${x.name}</button>`).join("");
});

socket.on("phase", (phase) => {
  if (phase !== "lobby") {
    document.getElementById("lobby").classList.add("hidden");
    document.getElementById("game").classList.remove("hidden");
  }
});

socket.on("timer", (t) => {
  document.getElementById("timer").innerText = t;
});

socket.on("role", (data) => {
  document.getElementById("role").innerText =
    data.isImposter ? "IMPOSTER" : data.word;

  document.getElementById("card").querySelector(".inner")
    .classList.add("flipped");
});

function send() {
  const msg = document.getElementById("msg").value;

  socket.emit("message", {
    roomId,
    msg,
    name
  });
}

socket.on("message", (d) => {
  document.getElementById("chat").innerHTML +=
    `<p><b>${d.name}:</b> ${d.msg}</p>`;
});

function vote(id) {
  socket.emit("vote", { roomId, target: id });
}
