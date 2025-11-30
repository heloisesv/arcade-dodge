// ----- RÉFÉRENCES DOM -----
const gameArea = document.getElementById("game-area");
try { localStorage.removeItem("arcadeDodgeLevel"); } catch(e){}

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
let playerX=0, playerY=0;
let basePlayerSpeed = 3.2;
let playerSpeed = basePlayerSpeed;

const keys={ArrowUp:false,ArrowDown:false,ArrowLeft:false,ArrowRight:false};
const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints>0;

// ----- CONFIG -----
function getLevelConfig(level){
  const isRush = level%5===0;
  return{
    enemyCount:Math.min(3+Math.floor(level*.9)+(isRush?2:0),35),
    enemyMinSpeed:1.8+level*.3,
    enemyMaxSpeed:2.2+level*.35+(isRush?1.2:0),
    duration:10+Math.floor(level/2)+(isRush?4:0),
    enemySize:Math.max(26-Math.floor(level/2),11),
    playerSpeed:3.2+level*.07
  };
}

// ----- JOUEUR -----
function centerPlayer(){
  const r=gameArea.getBoundingClientRect();
  playerX=r.width/2-playerSize/2;
  playerY=r.height/2-playerSize/2;
  updatePlayer();
}
function updatePlayer(){
  player.style.left=playerX+"px";
  player.style.top=playerY+"px";
}
function clamp(){
  const r=gameArea.getBoundingClientRect();
  if(playerX<0)playerX=0;
  if(playerY<0)playerY=0;
  if(playerX>r.width-playerSize)playerX=r.width-playerSize;
  if(playerY>r.height-playerSize)playerY=r.height-playerSize;
}
function updatePlayerFromKeys(){
  if(!gameRunning)return;
  if(keys.ArrowUp)playerY-=playerSpeed;
  if(keys.ArrowDown)playerY+=playerSpeed;
  if(keys.ArrowLeft)playerX-=playerSpeed;
  if(keys.ArrowRight)playerX+=playerSpeed;
  clamp(); updatePlayer();
}
function handleTouch(e){
  if(!gameRunning)return;
  let t=e.touches[0]; if(!t)return;
  const r=gameArea.getBoundingClientRect();
  playerX=t.clientX-r.left-playerSize/2;
  playerY=t.clientY-r.top-playerSize/2;
  clamp(); updatePlayer();
}

// ----- ENNEMIS -----
function createEnemy(cfg){
  const r=gameArea.getBoundingClientRect();
  const el=document.createElement("div");
  el.className="enemy";
  el.style.width=cfg.enemySize+"px";
  el.style.height=cfg.enemySize+"px";

  const side=Math.floor(Math.random()*4);
  let x,y;
  if(side===0){x=0; y=Math.random()*(r.height-cfg.enemySize);}
  else if(side===1){x=r.width-cfg.enemySize; y=Math.random()*(r.height-cfg.enemySize);}
  else if(side===2){x=Math.random()*(r.width-cfg.enemySize); y=0;}
  else {x=Math.random()*(r.width-cfg.enemySize); y=r.height-cfg.enemySize;}

  let angle=Math.random()*Math.PI*2;
  let speed=cfg.enemyMinSpeed+Math.random()*(cfg.enemyMaxSpeed-cfg.enemyMinSpeed);
  let vx=Math.cos(angle)*speed, vy=Math.sin(angle)*speed;

  if(side===0&&vx<0)vx=-vx;
  if(side===1&&vx>0)vx=-vx;
  if(side===2&&vy<0)vy=-vy;
  if(side===3&&vy>0)vy=-vy;

  el.style.left=x+"px";
  el.style.top=y+"px";
  gameArea.appendChild(el);

  enemies.push({el,x,y,vx,vy,size:cfg.enemySize});
}
function createEnemies(cfg){
  enemies.forEach(e=>e.el.remove());
  enemies=[];
  for(let i=0;i<cfg.enemyCount;i++)createEnemy(cfg);
}
function updateEnemies(){
  const r=gameArea.getBoundingClientRect();
  enemies.forEach(e=>{
    e.x+=e.vx; e.y+=e.vy;

    if(e.x<0){e.x=0; e.vx=Math.abs(e.vx);}
    else if(e.x>r.width-e.size){e.x=r.width-e.size; e.vx=-Math.abs(e.vx);}
    if(e.y<0){e.y=0; e.vy=Math.abs(e.vy);}
    else if(e.y>r.height-e.size){e.y=r.height-e.size; e.vy=-Math.abs(e.vy);}

    e.el.style.left=e.x+"px";
    e.el.style.top=e.y+"px";
  });
}

// ----- COLLISION -----
function checkCollision(){
  const p=player.getBoundingClientRect(),
        cx=p.left+p.width/2, cy=p.top+p.height/2, pr=p.width/2;

  for(const e of enemies){
    const o=e.el.getBoundingClientRect(),
          ex=o.left+o.width/2, ey=o.top+o.height/2, er=o.width/2;
    if(Math.hypot(cx-ex,cy-ey)<pr+er){
      endLevel(false); return;
    }
  }
}

// ----- GAME LOOP -----
function gameLoop(){
  if(!gameRunning)return;
  if(!isTouchDevice)updatePlayerFromKeys();
  updateEnemies();
  checkCollision();
  animationFrameId=requestAnimationFrame(gameLoop);
}

// ----- NIVEAU -----
function startLevel(lvl){
  const cfg=getLevelConfig(lvl);

  clearInterval(timerInterval);
  cancelAnimationFrame(animationFrameId);

  overlayMessage.textContent="";
  overlayMessage.classList.remove("visible");

  timeLeft=cfg.duration;
  timeSpan.textContent=timeLeft;

  basePlayerSpeed=cfg.playerSpeed;
  playerSpeed=basePlayerSpeed;

  levelSpan.textContent=lvl;

  centerPlayer();
  createEnemies(cfg);

  gameRunning=true;
  messageP.textContent=`Niveau ${lvl} — Survis ${cfg.duration}s !`;

  timerInterval=setInterval(()=>{
    if(!gameRunning)return;
    timeLeft--; timeSpan.textContent=timeLeft;
    if(timeLeft<=0) endLevel(true);
  },1000);

  animationFrameId=requestAnimationFrame(gameLoop);
}

function endLevel(win){
  gameRunning=false;
  clearInterval(timerInterval);
  cancelAnimationFrame(animationFrameId);

  let text="";
  if(win){
    if(currentLevel<MAX_LEVEL)currentLevel++;
    text="🎉 Bien joué ! Niveau suivant";
    startBtn.textContent="Niveau suivant";
  }else{
    attempts++; attemptsSpan.textContent=attempts;
    text="💀 Touché ! Recommence...";
    startBtn.textContent="Rejouer";
  }

  messageP.textContent=text;
  overlayMessage.textContent=text;
  overlayMessage.classList.add("visible");
  startBtn.disabled=false;
}

// ----- EVENTS -----
addEventListener("keydown",e=>{if(e.key in keys)keys[e.key]=true});
addEventListener("keyup",e=>{if(e.key in keys)keys[e.key]=false});

gameArea.addEventListener("touchstart",handleTouch,{passive:false});
gameArea.addEventListener("touchmove",handleTouch,{passive:false});

startBtn.addEventListener("click",()=>{
  if(startBtn.textContent.includes("Niveau suivant")==false)
    currentLevel=1;
  startBtn.disabled=true;
  startLevel(currentLevel);
});

window.onload=()=>{centerPlayer(); levelSpan.textContent=currentLevel;}















