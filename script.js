// ----- RÉFÉRENCES DOM -----
const gameArea = document.getElementById("game-area");

// Reset ancien stockage
try { localStorage.removeItem("arcadeDodgeLevel"); } catch (e) {}

const player = document.getElementById("player");
const startBtn = document.getElementById("start-btn");
const levelSpan = document.getElementById("level");
const timeSpan = document.getElementById("time");
const attemptsSpan = document.getElementById("attempts");
const messageP = document.getElementById("message");
const overlayMessage = document.getElementById("overlay-message");

// ----- CONSTANTES -----
const MAX_LEVEL = 60;

// ----- ÉTAT -----
let currentLevel = 1;
let attempts = 0;
let gameRunning = false;

let timeLeft = 0;
let timerInterval = null;
let animationFrameId = null;

let enemies = [];

// ----- JOUEUR -----
const playerSize = 26;
let playerX = 0;
let playerY = 0;
let basePlayerSpeed = 3.2;
let playerSpeed = basePlayerSpeed;

const keys = { ArrowUp:false, ArrowDown:false, ArrowLeft:false, ArrowRight:false };
const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;

// Power-ups
let powerUpEl = null;
let activePower = null;
let powerTimerId = null;
let shieldActive = false;

// ----- CONFIG NIVEAU -----
function getLevelConfig(level) {
  const isRush = level % 5 === 0;
  const enemyCount = Math.min(3 + Math.floor(level * 0.9) + (isRush?2:0), 35);

  return {
    enemyCount,
    enemyMinSpeed: 1.8 + level * 0.3,
    enemyMaxSpeed: 2.2 + level * 0.35 + (isRush?1.2:0),
    duration: 10 + Math.floor(level/2) + (isRush?4:0),
    enemySize: Math.max(26 - Math.floor(level/2), 11),
    playerSpeed: 3.2 + level * 0.07
  };
}

// ----- JOUEUR -----
function centerPlayer() {
  const rect = gameArea.getBoundingClientRect();
  playerX = rect.width/2 - playerSize/2;
  playerY = rect.height/2 - playerSize/2;
  updatePlayerPosition();
}
function updatePlayerPosition(){
  player.style.left = playerX+"px";
  player.style.top = playerY+"px";
}
function clampPlayer() {
  const rect = gameArea.getBoundingClientRect();
  playerX = Math.max(0, Math.min(rect.width-playerSize, playerX));
  playerY = Math.max(0, Math.min(rect.height-playerSize, playerY));
}
function updatePlayerFromKeys(){
  if(!gameRunning) return;
  if(keys.ArrowUp) playerY -= playerSpeed;
  if(keys.ArrowDown) playerY += playerSpeed;
  if(keys.ArrowLeft) playerX -= playerSpeed;
  if(keys.ArrowRight) playerX += playerSpeed;
  clampPlayer(); updatePlayerPosition();
}
function handleTouchMove(e){
  if(!gameRunning) return;
  const rect = gameArea.getBoundingClientRect();
  let t=e.touches[0]; if(!t) return;
  playerX=t.clientX-rect.left-playerSize/2;
  playerY=t.clientY-rect.top-playerSize/2;
  clampPlayer(); updatePlayerPosition();
}

// -----------------------------------------------------------
// 🔥 FIX : spawn des ennemis dans l’arène + entrée vers l'intérieur
// -----------------------------------------------------------
function createEnemy(config){
  const rect = gameArea.getBoundingClientRect();
  const el=document.createElement("div");
  el.className="enemy";
  el.style.width=config.enemySize+"px";
  el.style.height=config.enemySize+"px";

  let side=Math.floor(Math.random()*4);
  let x,y;

  if(side===0){ x=0; y=Math.random()*(rect.height-config.enemySize); }
  else if(side===1){ x=rect.width-config.enemySize; y=Math.random()*(rect.height-config.enemySize); }
  else if(side===2){ x=Math.random()*(rect.width-config.enemySize); y=0; }
  else { x=Math.random()*(rect.width-config.enemySize); y=rect.height-config.enemySize; }

  const angle=Math.random()*Math.PI*2;
  let speed=config.enemyMinSpeed+Math.random()*(config.enemyMaxSpeed-config.enemyMinSpeed);
  let vx=Math.cos(angle)*speed, vy=Math.sin(angle)*speed;

  if(side===0 && vx<0) vx=-vx;
  if(side===1 && vx>0) vx=-vx;
  if(side===2 && vy<0) vy=-vy;
  if(side===3 && vy>0) vy=-vy;

  el.style.left=x+"px"; el.style.top=y+"px";
  gameArea.appendChild(el);
  enemies.push({el,x,y,vx,vy,size:config.enemySize});
}

function createEnemies(cfg){
  enemies.forEach(e=>e.el.remove());
  enemies=[];
  for(let i=0;i<cfg.enemyCount;i++) createEnemy(cfg);
}

// -----------------------------------------------------------
// 🔥 FIX : rebonds propres sans vibration
// -----------------------------------------------------------
function updateEnemies(){
  const rect=gameArea.getBoundingClientRect();
  enemies.forEach(e=>{
    e.x+=e.vx; e.y+=e.vy;

    if(e.x<0){ e.x=0; e.vx=Math.abs(e.vx);}
    else if(e.x>rect.width-e.size){ e.x=rect.width-e.size; e.vx=-Math.abs(e.vx);}

    if(e.y<0){ e.y=0; e.vy=Math.abs(e.vy);}
    else if(e.y>rect.height-e.size){ e.y=rect.height-e.size; e.vy=-Math.abs(e.vy);}

    e.el.style.left=e.x+"px";
    e.el.style.top=e.y+"px";
  });
}

// ----- POWER UPS & COLLISIONS (inchangé) -----
function clearPowerState(){ activePower=null; shieldActive=false; playerSpeed=basePlayerSpeed;
  player.style.boxShadow=""; if(powerUpEl){powerUpEl.remove(); powerUpEl=null;}
  if(powerTimerId){clearInterval(powerTimerId); powerTimerId=null;}}

function spawnPowerUp(){if(!gameRunning||powerUpEl||Math.random()>0.01)return;
  const rect=gameArea.getBoundingClientRect(),size=22,pu=document.createElement("div");
  pu.className="powerup"; const types=["shield","slow","speed"];
  pu.dataset.type=types[Math.floor(Math.random()*types.length)];
  pu.style.background=pu.dataset.type=="shield"?"#4ade80":pu.dataset.type=="slow"?"#3b82f6":"#f97316";
  pu.style.left=Math.random()*(rect.width-size)+"px";
  pu.style.top=Math.random()*(rect.height-size)+"px";
  gameArea.appendChild(pu); powerUpEl=pu;}

function activatePower(type){clearPowerState(); activePower=type;
  if(type=="shield"){shieldActive=true; player.style.boxShadow="0 0 18px #22c55e";}
  else if(type=="slow"){enemies.forEach(e=>{e.vx*=.5;e.vy*=.5})}
  else if(type=="speed"){playerSpeed=basePlayerSpeed*1.8; player.style.boxShadow="0 0 18px #f97316";}
  let r=6; powerTimerId=setInterval(()=>{if(--r<=0)clearPowerState()},1000);}

function checkPowerUpPickup(){if(!powerUpEl)return;
  const p=player.getBoundingClientRect(),u=powerUpEl.getBoundingClientRect();
  const hit=!(p.right<u.left||p.left>u.right||p.bottom<u.top||p.top>u.bottom);
  if(hit){activatePower(powerUpEl.dataset.type); powerUpEl.remove(); powerUpEl=null;}}

function checkCollisions(){
  const p=player.getBoundingClientRect(),px=p.left+p.width/2,py=p.top+p.height/2,r=p.width/2;
  for(const e of enemies){
    const o=e.el.getBoundingClientRect(),ex=o.left+o.width/2,ey=o.top+o.height/2,er=o.width/2;
    if(Math.hypot(px-ex,py-ey)<(r+er)*0.9){
      if(shieldActive){shieldActive=false;player.style.boxShadow="";e.el.remove(); enemies=enemies.filter(x=>x!==e);return;}
      endLevel(false);return;
    }
  }
}

// ----- GAME LOOP -----
function gameLoop(){
  if(!gameRunning)return;
  if(!isTouchDevice) updatePlayerFromKeys();
  updateEnemies(); spawnPowerUp(); checkPowerUpPickup(); checkCollisions();
  animationFrameId=requestAnimationFrame(gameLoop);
}

// ----- GESTION DES NIVEAUX -----
function startLevel(lvl){
  const cfg=getLevelConfig(lvl);
  clearInterval(timerInterval); cancelAnimationFrame(animationFrameId); clearPowerState();

  overlayMessage.textContent=""; overlayMessage.classList.remove("visible");
  timeLeft=cfg.duration; timeSpan.textContent=timeLeft;
  basePlayerSpeed=cfg.playerSpeed; playerSpeed=basePlayerSpeed;
  levelSpan.textContent=lvl;

  centerPlayer(); createEnemies(cfg);
  gameRunning=true;

  messageP.textContent=isTouchDevice?`Niveau ${lvl} — Survis ${cfg.duration}s (mobile)`:`Niveau ${lvl} — Survis ${cfg.duration}s (flèches)`;

  timerInterval=setInterval(()=>{
    if(!gameRunning)return;
    timeLeft--; timeSpan.textContent=timeLeft;
    if(timeLeft<=0) endLevel(true);
  },1000);

  animationFrameId=requestAnimationFrame(gameLoop);
}

function endLevel(ok){
  if(!gameRunning)return;
  gameRunning=false; clearInterval(timerInterval); cancelAnimationFrame(animationFrameId); clearPowerState();

  if(ok){
    if(currentLevel<MAX_LEVEL) currentLevel++;
    const W=["EZ clap 🔥","Tu l’as fumé 😂","Winnnn 🥶","Skill validé 💪","SIGMA MOVE 😈"];
    const msg=W[Math.floor(Math.random()*W.length)];
    messageP.textContent=overlayMessage.textContent=msg; overlayMessage.classList.add("visible");
    startBtn.disabled=false; startBtn.textContent=currentLevel>=MAX_LEVEL?"Rejouer au niveau 1":"Niveau suivant";
  } else {
    attempts++; attemptsSpan.textContent=attempts;
    const L=["😱 skill issue","💀 retour lobby","Touché...","BOOM fin de run 💥","Encore ? 😭"];
    const msg=L[Math.floor(Math.random()*L.length)];
    messageP.textContent=overlayMessage.textContent=msg; overlayMessage.classList.add("visible");
    startBtn.disabled=false; startBtn.textContent="Recommencer le niveau";
  }
}

// ----- EVENTS -----
addEventListener("keydown",e=>{if(e.key in keys)keys[e.key]=true});
addEventListener("keyup",e=>{if(e.key in keys)keys[e.key]=false});

gameArea.addEventListener("touchstart",e=>{if(gameRunning)handleTouchMove(e)},{passive:false});
gameArea.addEventListener("touchmove",e=>{if(gameRunning)handleTouchMove(e)},{passive:false});

startBtn.addEventListener("click",()=>{
  if(startBtn.textContent.includes("Rejouer au niveau 1")) currentLevel=1;
  startBtn.disabled=true; startLevel(currentLevel);
});

// ----- INIT -----
window.onload=()=>{centerPlayer(); levelSpan.textContent=currentLevel; attemptsSpan.textContent=attempts}













