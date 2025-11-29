// RÉFÉRENCES DOM
const gameArea = document.getElementById("game-area");
const player = document.getElementById("player");
const startBtn = document.getElementById("start-btn");
const levelSpan = document.getElementById("level");
const timeSpan = document.getElementById("time");
const attemptsSpan = document.getElementById("attempts");
const messageP = document.getElementById("message");

// ÉTAT GLOBAL
let gameRunning = false;
let maxLevel = 60;
let attempts = 0;
let enemies = [];
let timeLeft = 0;
let timerInterval = null;
let animationFrameId = null;

// Joueur
let playerX = 0;
let playerY = 0;
const playerSize = 26;
let playerSpeed = 3.2;
let basePlayerSpeed = 3.2;

// clavier
const keysPressed = {
  ArrowUp: false,
  ArrowDown: false,
  ArrowLeft: false,
  ArrowRight: false,
};

// Touch
const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;

// Power-ups
let powerUpEl = null;
let powerActive = false;
let activePower = null;
let powerTimerId = null;
let shieldActive = false;

// NIVEAU SAUVEGARDÉ (localStorage)
function loadSavedLevel() {
  const stored = localStorage.getItem("arcadeDodgeLevel");
  const n = parseInt(stored, 10);
  if (!isNaN(n) && n >= 1 && n <= maxLevel) return n;
  return 1;
}
let currentLevel = loadSavedLevel();

// CONFIG DE NIVEAU
function getLevelConfig(level) {
  const isRush = level % 5 === 0;
  const enemyCount = Math.min(4 + Math.floor(level * 0.9) + (isRush ? 2 : 0), 35);
  const enemyMinSpeed = 1.8 + level * 0.3;
  const enemyMaxSpeed = 2.2 + level * 0.35 + (isRush ? 1.2 : 0);
  const duration = 10 + Math.floor(level / 2) + (isRush ? 4 : 0);
  const enemySize = Math.max(26 - Math.floor(level / 2), 11);
  const pSpeed = 3.2 + level * 0.07;

  return {
    enemyCount,
    enemyMinSpeed,
    enemyMaxSpeed,
    duration,
    enemySize,
    playerSpeed: pSpeed,
  };
}

// JOUEUR
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
  if (keysPressed.ArrowUp) dy -= playerSpeed;
  if (keysPressed.ArrowDown) dy += playerSpeed;
  if (keysPressed.ArrowLeft) dx -= playerSpeed;
  if (keysPressed.ArrowRight) dx += playerSpeed;

  playerX += dx;
  playerY += dy;
  clampPlayer();
  updatePlayerPosition();
}

// Touch
function handleTouchMove(e) {
  if (!gameRunning) return;
  e.preventDefault();
  const rect = gameArea.getBoundingClientRect();
  const touch = e.touches[0];
  if (!touch) return;

  playerX = touch.clientX - rect.left - playerSize / 2;
  playerY = touch.clientY - rect.top - playerSize / 2;
  clampPlayer();
  updatePlayerPosition();
}

// ENNEMIS
function createEnemy(config) {
  const rect = gameArea.getBoundingClientRect();
  const enemyEl = document.createElement("div");
  enemyEl.className = "enemy";
  enemyEl.style.width = `${config.enemySize}px`;
  enemyEl.style.height = `${config.enemySize}px`;

  const side = Math.floor(Math.random() * 4);
  let x, y;

  if (side === 0) {
    x = -config.enemySize;
    y = Math.random() * (rect.height - config.enemySize);
  } else if (side === 1) {
    x = rect.width + config.enemySize;
    y = Math.random() * (rect.height - config.enemySize);
  } else if (side === 2) {
    x = Math.random() * (rect.width - config.enemySize);
    y = -config.enemySize;
  } else {
    x = Math.random() * (rect.width - config.enemySize);
    y = rect.height + config.enemySize;
  }

  enemyEl.style.left = `${x}px`;
  enemyEl.style.top = `${y}px`;
  gameArea.appendChild(enemyEl);

  const angle = Math.random() * Math.PI * 2;
  const speed =
    config.enemyMinSpeed +
    Math.random() * (config.enemyMaxSpeed - config.enemyMinSpeed);

  const vx = Math.cos(angle) * speed;
  const vy = Math.sin(angle) * speed;

  enemies.push({
    el: enemyEl,
    x,
    y,
    vx,
    vy,
    size: config.enemySize,
  });
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
  enemies.forEach((enemy) => {
    enemy.x += enemy.vx;
    enemy.y += enemy.vy;

    if (enemy.x <= 0) {
      enemy.x = 0;
      enemy.vx *= -1;
    }
    if (enemy.x >= rect.width - enemy.size) {
      enemy.x = rect.width - enemy.size;
      enemy.vx *= -1;
    }
    if (enemy.y <= 0) {
      enemy.y = 0;
      enemy.vy *= -1;
    }
    if (enemy.y >= rect.height - enemy.size) {
      enemy.y = rect.height - enemy.size;
      enemy.vy *= -1;
    }

    enemy.el.style.left = `${enemy.x}px`;
    enemy.el.style.top = `${enemy.y}px`;
  });
}

// POWER-UPS
function clearPowerState() {
  powerActive = false;
  activePower = null;
  shieldActive = false;
  playerSpeed = basePlayerSpeed;
  player.style.boxShadow = "";
  if (powerUpEl) {
    powerUpEl.remove();
    powerUpEl = null;
  }
  if (powerTimerId) {
    clearInterval(powerTimerId);
    powerTimerId = null;
  }
}

function spawnPowerUp() {
  if (!gameRunning) return;
  if (powerUpEl) return;
  if (Math.random() > 0.01) return; // ~1% par frame

  const rect = gameArea.getBoundingClientRect();
  const size = 22;
  const pu = document.createElement("div");
  pu.className = "powerup";

  const types = ["shield", "slow", "speed"];
  const type = types[Math.floor(Math.random() * types.length)];
  pu.dataset.type = type;

  if (type === "shield") pu.style.background = "#4ade80";
  if (type === "slow") pu.style.background = "#3b82f6";
  if (type === "speed") pu.style.background = "#f97316";

  pu.style.left = `${Math.random() * (rect.width - size)}px`;
  pu.style.top = `${Math.random() * (rect.height - size)}px`;

  gameArea.appendChild(pu);
  powerUpEl = pu;
}

function activatePower(type) {
  powerActive = true;
  activePower = type;
  powerTimerId && clearInterval(powerTimerId);

  // reset joueur
  playerSpeed = basePlayerSpeed;
  player.style.boxShadow = "";

  if (type === "shield") {
    shieldActive = true;
    player.style.boxShadow = "0 0 18px #22c55e";
  } else if (type === "slow") {
    enemies.forEach((e) => {
      e.vx *= 0.5;
      e.vy *= 0.5;
    });
  } else if (type === "speed") {
    playerSpeed = basePlayerSpeed * 1.8;
    player.style.boxShadow = "0 0 18px #f97316";
  }

  let remaining = 6; // secondes
  powerTimerId = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(powerTimerId);
      powerTimerId = null;
      powerActive = false;
      activePower = null;
      shieldActive = false;
      playerSpeed = basePlayerSpeed;
      player.style.boxShadow = "";
    }
  }, 1000);
}

function checkPowerUpPickup() {
  if (!powerUpEl) return;
  const pRect = player.getBoundingClientRect();
  const puRect = powerUpEl.getBoundingClientRect();

  const overlap =
    !(pRect.right < puRect.left ||
      pRect.left > puRect.right ||
      pRect.bottom < puRect.top ||
      pRect.top > puRect.bottom);

  if (overlap) {
    const type = powerUpEl.dataset.type;
    powerUpEl.remove();
    powerUpEl = null;
    activatePower(type);
  }
}

// COLLISION JOUEUR / ENNEMIS
function checkCollisions() {
  const playerRect = player.getBoundingClientRect();
  const pCX = playerRect.left + playerRect.width / 2;
  const pCY = playerRect.top + playerRect.height / 2;
  const pR = playerRect.width / 2;

  for (const enemy of enemies) {
    const eRect = enemy.el.getBoundingClientRect();
    const eCX = eRect.left + eRect.width / 2;
    const eCY = eRect.top + eRect.height / 2;
    const eR = eRect.width / 2;

    const dx = pCX - eCX;
    const dy = pCY - eCY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxDist = (pR + eR) * 0.9;

    if (dist < maxDist) {
      if (shieldActive) {
        // on consomme le shield et on enlève l'ennemi touché
        shieldActive = false;
        player.style.boxShadow = "";
        enemy.el.remove();
        enemies = enemies.filter((e) => e !== enemy);
        return; // pas de game over
      } else {
        endLevel(false);
        return;
      }
    }
  }
}

// GAME LOOP
function gameLoop() {
  if (!gameRunning) return;

  if (!isTouchDevice) {
    updatePlayerFromKeys();
  }
  updateEnemies();
  spawnPowerUp();
  checkPowerUpPickup();
  checkCollisions();

  animationFrameId = requestAnimationFrame(gameLoop);
}

// DÉMARRER UN NIVEAU
function startLevel(level) {
  const config = getLevelConfig(level);

  clearInterval(timerInterval);
  cancelAnimationFrame(animationFrameId);
  clearPowerState();

  const saved = loadSavedLevel();
  if (saved > level) {
    currentLevel = saved;
    level = saved;
  }

  levelSpan.textContent = level.toString();
  timeLeft = config.duration;
  timeSpan.textContent = timeLeft.toString();
  basePlayerSpeed = config.playerSpeed;
  playerSpeed = config.playerSpeed;

  centerPlayer();
  createEnemies(config);

  gameRunning = true;
  messageP.textContent = isTouchDevice
    ? `Niveau ${level} — Survis ${config.duration}s. (Doigt pour bouger)`
    : `Niveau ${level} — Survis ${config.duration}s. (Flèches pour bouger)`;

  timerInterval = setInterval(() => {
    if (!gameRunning) return;
    timeLeft--;
    timeSpan.textContent = timeLeft.toString();
    if (timeLeft <= 0) {
      endLevel(true);
    }
  }, 1000);

  animationFrameId = requestAnimationFrame(gameLoop);
}

// FIN DE NIVEAU
function endLevel(success) {
  if (!gameRunning) return;
  gameRunning = false;
  clearInterval(timerInterval);
  cancelAnimationFrame(animationFrameId);

  clearPowerState();

  if (success) {
    // sauvegarde du niveau atteint
    if (currentLevel < maxLevel) {
      currentLevel++;
      localStorage.setItem("arcadeDodgeLevel", String(currentLevel));
    }

    const winLines = [
      "EZ clap 🔥",
      "Tu l’as fumé ce niveau 😂",
      "Winnnn 🥶",
      "Le skill est certifié validé 💪",
      "SIGMA MOVE 😈",
      "Autoroute du talent 🚀",
      "Tu files comme Sonic 🌀",
      "Arcade Dodge : tu commences à le dominer 🔥"
    ];
    const msg = winLines[Math.floor(Math.random() * winLines.length)];
    messageP.textContent = msg;

    if (currentLevel > maxLevel) {
      messageP.textContent = "Tu as terminé tous les niveaux… boss du game 😈";
      currentLevel = maxLevel;
    }

    startBtn.disabled = false;
    startBtn.textContent = currentLevel > maxLevel
      ? "Rejouer au niveau 1"
      : "Niveau suivant";

  } else {
    attempts++;
    attemptsSpan.textContent = attempts.toString();

    const loseLines = [
      "😱 skill issue",
      "💀 retour lobby",
      "🧍… déconnexion du skill",
      "Tu t'es fait clip 4K 📹",
      "Ratio par une boule 🤡",
      "La boule : 1 – toi : 0",
      "Encore ? 😭",
      "Le mental est où là ? 🤨",
      "Mdr dash dans l’ennemi 😂",
      "Ton iPhone a soufflé 😮‍💨",
      "BOOM fin de run 💥",
      "Tu viens d'inventer une nouvelle façon de perdre 😂",
      "Respect la persévérance, pas le skill 😭",
      "T’as glissé c’est ça ? 😏",
      "Le niveau t’a éteint lumière comprise 😭",
      "Plus rapide qu’un ghosting 💀",
      "Arcade Dodge : 60 – toi : 0 😬",
      "Toucher = mourir, tu touches quand même 💀",
      "Game Over mais avec style 💅"
    ];
    const msg = loseLines[Math.floor(Math.random() * loseLines.length)];
    messageP.textContent = msg;

    startBtn.disabled = false;
    startBtn.textContent = "Recommencer le niveau";
  }
}

// EVENTS
window.addEventListener("keydown", (e) => {
  if (e.key in keysPressed) {
    keysPressed[e.key] = true;
  }
});

window.addEventListener("keyup", (e) => {
  if (e.key in keysPressed) {
    keysPressed[e.key] = false;
  }
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
  startBtn.disabled = true;
  startLevel(currentLevel);
});

// INIT
window.addEventListener("load", () => {
  centerPlayer();
  levelSpan.textContent = currentLevel.toString();
  timeSpan.textContent = "0";
  attemptsSpan.textContent = attempts.toString();

  const saved = loadSavedLevel();
  if (saved > 1) {
    currentLevel = saved;
    levelSpan.textContent = currentLevel.toString();
    messageP.textContent = `Progression retrouvée : niveau ${currentLevel}. Clique sur START.`;
  } else {
    messageP.textContent = "Clique sur START pour commencer au niveau 1.";
  }
});





