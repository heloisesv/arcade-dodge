// ----- RÉFÉRENCES DOM -----
const gameArea = document.getElementById("game-area");

// On supprime TOUTE ancienne sauvegarde de niveau (ancienne version du jeu)
try {
  localStorage.removeItem("arcadeDodgeLevel");
} catch (e) {
  // ignore si localStorage n'existe pas
}

const player = document.getElementById("player");
const startBtn = document.getElementById("start-btn");
const levelSpan = document.getElementById("level");
const timeSpan = document.getElementById("time");
const attemptsSpan = document.getElementById("attempts");
const messageP = document.getElementById("message");
const overlayMessage = document.getElementById("overlay-message");

// ----- CONSTANTES -----
const MAX_LEVEL = 60;

// ----- ÉTAT GLOBAL -----
let currentLevel = 1;
let attempts = 0;
let gameRunning = false;

let timeLeft = 0;
let timerInterval = null;
let animationFrameId = null;

let enemies = [];

// Joueur
const playerSize = 26;
let playerX = 0;
let playerY = 0;
let basePlayerSpeed = 3.2;
let playerSpeed = basePlayerSpeed;

// clavier / touch
const keys = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };
const isTouchDevice =
  "ontouchstart" in window || navigator.maxTouchPoints > 0;

// ----- CONFIG NIVEAU -----
function getLevelConfig(level) {
  const isRush = level % 5 === 0;

  const enemyCount = Math.min(
    3 + Math.floor(level * 0.9) + (isRush ? 2 : 0),
    35
  );
  const enemyMinSpeed = 1.8 + level * 0.3;
  const enemyMaxSpeed = 2.2 + level * 0.35 + (isRush ? 1.2 : 0);
  const duration = 10 + Math.floor(level / 2) + (isRush ? 4 : 0);
  const enemySize = Math.max(26 - Math.floor(level / 2), 11);
  const playerSpeed = 3.2 + level * 0.07;

  return { enemyCount, enemyMinSpeed, enemyMaxSpeed, duration, enemySize, playerSpeed };
}

// ----- JOUEUR -----
function centerPlayer() {
  const rect = gameArea.getBoundingClientRect();
  playerX = rect.width / 2 - playerSize / 2;
  playerY = rect.height / 2 - playerSize / 2;
  updatePlayerPosition();
}

function updatePlayerPosition() {
  player.style.left = `${playerX}px`;
  player.style.top = `${playerY}px`;
}

function clampPlayer() {
  const rect = gameArea.getBoundingClientRect();
  if (playerX < 0) playerX = 0;
  if (playerY < 0) playerY = 0;
  if (playerX > rect.width - playerSize) playerX = rect.width - playerSize;
  if (playerY > rect.height - playerSize) playerY = rect.height - playerSize;
}

function updatePlayerFromKeys() {
  if (!gameRunning) return;

  let dx = 0;
  let dy = 0;

  if (keys.ArrowUp) dy -= playerSpeed;
  if (keys.ArrowDown) dy += playerSpeed;
  if (keys.ArrowLeft) dx -= playerSpeed;
  if (keys.ArrowRight) dx += playerSpeed;

  playerX += dx;
  playerY += dy;

  clampPlayer();
  updatePlayerPosition();
}

function handleTouchMove(e) {
  if (!gameRunning) return;
  e.preventDefault();

  const rect = gameArea.getBoundingClientRect();
  const t = e.touches[0];
  if (!t) return;

  playerX = t.clientX - rect.left - playerSize / 2;
  playerY = t.clientY - rect.top - playerSize / 2;
  clampPlayer();
  updatePlayerPosition();
}

// ----- ENNEMIS -----
function createEnemy(config) {
  const rect = gameArea.getBoundingClientRect();
  const el = document.createElement("div");
  el.className = "enemy";
  el.style.width = `${config.enemySize}px`;
  el.style.height = `${config.enemySize}px`;

  const side = Math.floor(Math.random() * 4);
  let x, y;

  // spawn sur les bords mais DANS l'arène
  if (side === 0) {
    // gauche
    x = 0;
    y = Math.random() * (rect.height - config.enemySize);
  } else if (side === 1) {
    // droite
    x = rect.width - config.enemySize;
    y = Math.random() * (rect.height - config.enemySize);
  } else if (side === 2) {
    // haut
    x = Math.random() * (rect.width - config.enemySize);
    y = 0;
  } else {
    // bas
    x = Math.random() * (rect.width - config.enemySize);
    y = rect.height - config.enemySize;
  }

  const angle = Math.random() * Math.PI * 2;
  const speed =
    config.enemyMinSpeed +
    Math.random() * (config.enemyMaxSpeed - config.enemyMinSpeed);

  let vx = Math.cos(angle) * speed;
  let vy = Math.sin(angle) * speed;

  // forcer le mouvement vers l'intérieur au départ
  if (side === 0 && vx < 0) vx = -vx;
  if (side === 1 && vx > 0) vx = -vx;
  if (side === 2 && vy < 0) vy = -vy;
  if (side === 3 && vy > 0) vy = -vy;

  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  gameArea.appendChild(el);

  enemies.push({ el, x, y, vx, vy, size: config.enemySize });
}

function createEnemies(config) {
  enemies.forEach((e) => e.el.remove());
  enemies = [];
  for (let i = 0; i < config.enemyCount; i++) {
    createEnemy(config);
  }
}

function updateEnemies() {
  const rect = gameArea.getBoundingClientRect();
  enemies.forEach((e) => {
    e.x += e.vx;
    e.y += e.vy;

    // rebonds propres sur les bords
    if (e.x < 0) {
      e.x = 0;
      e.vx = Math.abs(e.vx);
    } else if (e.x > rect.width - e.size) {
      e.x = rect.width - e.size;
      e.vx = -Math.abs(e.vx);
    }

    if (e.y < 0) {
      e.y = 0;
      e.vy = Math.abs(e.vy);
    } else if (e.y > rect.height - e.size) {
      e.y = rect.height - e.size;
      e.vy = -Math.abs(e.vy);
    }

    e.el.style.left = `${e.x}px`;
    e.el.style.top = `${e.y}px`;
  });
}

// ----- COLLISIONS (plus de shield, plus de power-ups) -----
function checkCollisions() {
  const pRect = player.getBoundingClientRect();
  const pCX = pRect.left + pRect.width / 2;
  const pCY = pRect.top + pRect.height / 2;
  const pR = pRect.width / 2;

  for (const e of enemies) {
    const eRect = e.el.getBoundingClientRect();
    const eCX = eRect.left + eRect.width / 2;
    const eCY = eRect.top + eRect.height / 2;
    const eR = eRect.width / 2;

    const dx = pCX - eCX;
    const dy = pCY - eCY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxDist = (pR + eR) * 0.9;

    if (dist < maxDist) {
      // contact = mort directe, pas de bouclier
      endLevel(false);
      return;
    }
  }
}

// ----- GAME LOOP -----
function gameLoop() {
  if (!gameRunning) return;

  if (!isTouchDevice) updatePlayerFromKeys();

  updateEnemies();
  checkCollisions();

  animationFrameId = requestAnimationFrame(gameLoop);
}

// ----- NIVEAU -----
function startLevel(level) {
  const config = getLevelConfig(level);

  clearInterval(timerInterval);
  cancelAnimationFrame(animationFrameId);

  overlayMessage.textContent = "";
  overlayMessage.classList.remove("visible");

  timeLeft = config.duration;
  timeSpan.textContent = String(timeLeft);

  basePlayerSpeed = config.playerSpeed;
  playerSpeed = basePlayerSpeed;

  levelSpan.textContent = String(level);

  centerPlayer();
  createEnemies(config);

  gameRunning = true;

  messageP.textContent = isTouchDevice
    ? `Niveau ${level} — Survis ${config.duration}s (déplace la boule avec ton doigt).`
    : `Niveau ${level} — Survis ${config.duration}s (flèches du clavier).`;

  timerInterval = setInterval(() => {
    if (!gameRunning) return;
    timeLeft--;
    timeSpan.textContent = String(timeLeft);
    if (timeLeft <= 0) {
      endLevel(true);
    }
  }, 1000);

  animationFrameId = requestAnimationFrame(gameLoop);
}

function endLevel(success) {
  if (!gameRunning) return;
  gameRunning = false;
  clearInterval(timerInterval);
  cancelAnimationFrame(animationFrameId);

  let msg = "";

  if (success) {
    if (currentLevel < MAX_LEVEL) currentLevel++;

    const wins = [
      "EZ clap 🔥",
      "Tu l’as fumé ce niveau 😂",
      "Winnnn 🥶",
      "Le skill est certifié validé 💪",
      "SIGMA MOVE 😈",
      "Autoroute du talent 🚀",
      "Arcade Dodge commence à te respecter.",
      "Ok, t’es officiellement chaud·e."
    ];
    msg = wins[Math.floor(Math.random() * wins.length)];

    messageP.textContent = msg;
    overlayMessage.textContent = msg;
    overlayMessage.classList.add("visible");

    if (currentLevel > MAX_LEVEL) currentLevel = MAX_LEVEL;

    startBtn.disabled = false;
    startBtn.textContent =
      currentLevel >= MAX_LEVEL ? "Rejouer au niveau 1" : "Niveau suivant";
  } else {
    attempts++;
    attemptsSpan.textContent = String(attempts);

    const loses = [
      "😱 skill issue",
      "💀 retour lobby",
      "Touché… Tu dois recommencer ce niveau. 😈",
      "Tu t'es fait clip 4K 📹",
      "Ratio par une boule 🤡",
      "Encore ? 😭",
      "Le mental est où là ? 🤨",
      "Dash droit dans l’ennemi 😂",
      "BOOM fin de run 💥",
      "Game Over mais avec style 💅"
    ];
    msg = loses[Math.floor(Math.random() * loses.length)];

    messageP.textContent = msg;
    overlayMessage.textContent = msg;
    overlayMessage.classList.add("visible");

    startBtn.disabled = false;
    startBtn.textContent = "Recommencer le niveau";
  }
}

// ----- EVENTS -----
window.addEventListener("keydown", (e) => {
  if (e.key in keys) keys[e.key] = true;
});
window.addEventListener("keyup", (e) => {
  if (e.key in keys) keys[e.key] = false;
});

gameArea.addEventListener(
  "touchstart",
  (e) => {
    if (!gameRunning) return;
    handleTouchMove(e);
  },
  { passive: false }
);
gameArea.addEventListener(
  "touchmove",
  (e) => {
    if (!gameRunning) return;
    handleTouchMove(e);
  },
  { passive: false }
);

startBtn.addEventListener("click", () => {
  if (startBtn.textContent.includes("Rejouer au niveau 1")) {
    currentLevel = 1;
  }
  startBtn.disabled = true;
  startLevel(currentLevel);
});

// ----- INIT -----
window.addEventListener("load", () => {
  centerPlayer();
  levelSpan.textContent = String(currentLevel);
  timeSpan.textContent = "0";
  attemptsSpan.textContent = String(attempts);
  messageP.textContent = "Clique sur START pour commencer au niveau 1.";
});

















