const gameArea = document.getElementById("game-area");
const player = document.getElementById("player");
const startBtn = document.getElementById("start-btn");
const levelSpan = document.getElementById("level");
const timeSpan = document.getElementById("time");
const attemptsSpan = document.getElementById("attempts");
const messageP = document.getElementById("message");

let gameRunning = false;
let currentLevel = 1;
const maxLevel = 30;
let attempts = 0;

let timeLeft = 0;
let timerInterval = null;
let animationFrameId = null;

// Joueur
let playerX = 0;
let playerY = 0;
const playerSize = 26;
let playerSpeed = 3.2;

// Ennemis
let enemies = [];

// Détection tactile
const isTouchDevice =
  "ontouchstart" in window || navigator.maxTouchPoints > 0;

// Entrées clavier (PC)
const keysPressed = {
  ArrowUp: false,
  ArrowDown: false,
  ArrowLeft: false,
  ArrowRight: false,
};

// CONFIG NIVEAUX
function getLevelConfig(level) {
  const isRush = level % 5 === 0;

  const enemyCount = Math.min(3 + Math.floor(level * 0.7) + (isRush ? 2 : 0), 16);
  const baseSpeed = 1.8 + level * 0.25 + (isRush ? 1.0 : 0);
  const duration = isRush ? 8 + Math.floor(level / 4) : 10 + Math.floor(level / 3);
  const enemySize = Math.max(26 - Math.floor(level / 2), 12);
  const playerSpeedBoost = 3.2 + level * 0.06;
  const chaserCount = level >= 5 ? Math.min(1 + Math.floor(level / 5), enemyCount - 1) : 0;

  return {
    enemyCount,
    enemyMinSpeed: baseSpeed * 0.8,
    enemyMaxSpeed: baseSpeed * 1.3,
    duration,
    enemySize,
    playerSpeed: playerSpeedBoost,
    chaserCount,
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

// clavier
function updatePlayerFromKeys() {
  if (!gameRunning) return;

  const rect = gameArea.getBoundingClientRect();
  let dx = 0;
  let dy = 0;

  if (keysPressed.ArrowUp) dy -= playerSpeed;
  if (keysPressed.ArrowDown) dy += playerSpeed;
  if (keysPressed.ArrowLeft) dx -= playerSpeed;
  if (keysPressed.ArrowRight) dx += playerSpeed;

  playerX += dx;
  playerY += dy;

  clampPlayer(rect);
  updatePlayerPosition();
}

// tactile
function handleTouchMove(e) {
  if (!gameRunning) return;
  e.preventDefault();

  const rect = gameArea.getBoundingClientRect();
  const touch = e.touches[0];
  if (!touch) return;

  const x = touch.clientX - rect.left - playerSize / 2;
  const y = touch.clientY - rect.top - playerSize / 2;

  playerX = x;
  playerY = y;

  clampPlayer(rect);
  updatePlayerPosition();
}

function clampPlayer(rect) {
  if (playerX < 0) playerX = 0;
  if (playerY < 0) playerY = 0;
  if (playerX > rect.width - playerSize) playerX = rect.width - playerSize;
  if (playerY > rect.height - playerSize) playerY = rect.height - playerSize;
}

// ENNEMIS
function createEnemy(config, type = "bouncer") {
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
    maxSpeed: config.enemyMaxSpeed * (type === "chaser" ? 1.4 : 1.0),
    type,
  });
}

function createEnemies(config) {
  enemies.forEach((e) => e.el.remove());
  enemies = [];

  for (let i = 0; i < config.chaserCount; i++) {
    createEnemy(config, "chaser");
  }
  const remaining = config.enemyCount - config.chaserCount;
  for (let i = 0; i < remaining; i++) {
    createEnemy(config, "bouncer");
  }
}

function updateEnemies() {
  const rect = gameArea.getBoundingClientRect();

  enemies.forEach((enemy) => {
    if (enemy.type === "chaser") {
      const targetX = playerX + playerSize / 2;
      const targetY = playerY + playerSize / 2;
      const enemyCenterX = enemy.x + enemy.size / 2;
      const enemyCenterY = enemy.y + enemy.size / 2;

      let dx = targetX - enemyCenterX;
      let dy = targetY - enemyCenterY;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;

      dx /= dist;
      dy /= dist;

      const accel = 0.05 + currentLevel * 0.004;
      enemy.vx += dx * accel;
      enemy.vy += dy * accel;

      const speed = Math.sqrt(enemy.vx * enemy.vx + enemy.vy * enemy.vy);
      if (speed > enemy.maxSpeed) {
        enemy.vx = (enemy.vx / speed) * enemy.maxSpeed;
        enemy.vy = (enemy.vy / speed) * enemy.maxSpeed;
      }
    }

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

// COLLISIONS
function checkCollisions() {
  const playerRect = player.getBoundingClientRect();
  const playerCenterX = playerRect.left + playerRect.width / 2;
  const playerCenterY = playerRect.top + playerRect.height / 2;
  const playerRadius = playerRect.width / 2;

  for (const enemy of enemies) {
    const enemyRect = enemy.el.getBoundingClientRect();
    const enemyCenterX = enemyRect.left + enemyRect.width / 2;
    const enemyCenterY = enemyRect.top + enemyRect.height / 2;
    const enemyRadius = enemyRect.width / 2;

    const dx = playerCenterX - enemyCenterX;
    const dy = playerCenterY - enemyCenterY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < playerRadius + enemyRadius * 0.9) {
      onPlayerHit();
      break;
    }
  }
}

function onPlayerHit() {
  if (!gameRunning) return;

  attempts++;
  attemptsSpan.textContent = attempts.toString();
  endLevel(false);
}

// GAME LOOP
function gameLoop() {
  if (!gameRunning) return;

  if (!isTouchDevice) {
    updatePlayerFromKeys();
  }

  updateEnemies();
  checkCollisions();

  animationFrameId = requestAnimationFrame(gameLoop);
}

// NIVEAUX
function startLevel(level) {
  const config = getLevelConfig(level);

  levelSpan.textContent = level.toString();
  timeLeft = config.duration;
  timeSpan.textContent = timeLeft.toString();

  messageP.textContent = isTouchDevice
    ? `Niveau ${level} — Survis ${config.duration}s. Déplace la boule avec ton doigt.`
    : `Niveau ${level} — Survis ${config.duration}s. Déplace la boule avec les flèches.`;

  playerSpeed = config.playerSpeed;

  centerPlayer();
  createEnemies(config);

  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (!gameRunning) return;
    timeLeft--;
    timeSpan.textContent = timeLeft.toString();

    if (timeLeft <= 0) {
      endLevel(true);
    }
  }, 1000);

  cancelAnimationFrame(animationFrameId);
  gameRunning = true;
  animationFrameId = requestAnimationFrame(gameLoop);
}

function endLevel(success) {
  gameRunning = false;
  clearInterval(timerInterval);
  cancelAnimationFrame(animationFrameId);

  if (success) {
    if (currentLevel >= maxLevel) {
      messageP.textContent = "INCROYABLE 😱 Tu as terminé le niveau 30 !";
      startBtn.disabled = false;
      startBtn.textContent = "Rejouer au niveau 1";
      currentLevel = 1;
    } else {
      currentLevel++;
      messageP.textContent = `Bravo ! Niveau ${currentLevel} débloqué. Clique sur START pour continuer.`;
      startBtn.disabled = false;
      startBtn.textContent = "Niveau suivant";
    }
  } else {
    messageP.textContent = `Touché... Tu dois recommencer le niveau ${currentLevel}. 😈`;
    startBtn.disabled = false;
    startBtn.textContent = "Recommencer le niveau";
  }
}

// ÉVÈNEMENTS
startBtn.addEventListener("click", () => {
  startBtn.disabled = true;
  messageP.textContent = "";
  startLevel(currentLevel);
});

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

// Tactile
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

// Init
window.addEventListener("load", () => {
  centerPlayer();
  levelSpan.textContent = currentLevel.toString();
  timeSpan.textContent = "0";
  attemptsSpan.textContent = attempts.toString();

  messageP.textContent = isTouchDevice
    ? "Clique sur START puis déplace la boule avec ton doigt."
    : "Clique sur START pour commencer au niveau 1 (flèches du clavier).";
});

