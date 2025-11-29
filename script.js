const gameArea=document.getElementById("game-area");
const player=document.getElementById("player");
const startBtn=document.getElementById("start-btn");
const levelSpan=document.getElementById("level");
const timeSpan=document.getElementById("time");
const attemptsSpan=document.getElementById("attempts");
const messageP=document.getElementById("message");

let gameRunning=false,currentLevel=1;
const maxLevel=60;
let attempts=0,timeLeft=0,enemies=[],timerInterval=null,animationFrameId=null;

let playerX=0,playerY=0,playerSpeed=3.2,playerSize=26;
const keys={ArrowUp:0,ArrowDown:0,ArrowLeft:0,ArrowRight:0};
const touch="ontouchstart"in window;

// CONFIG NIVEAUX
function getLevelConfig(l){
  const rush=l%5===0;
  return{
    enemyCount:Math.min(4+l*0.9+(rush?2:0),35),
    enemyMinSpeed:1.8+l*.30,
    enemyMaxSpeed:2.2+l*.35+(rush?1.2:0),
    duration:10+Math.floor(l/2)+(rush?4:0),
    enemySize:Math.max(26-Math.floor(l/2),11),
    playerSpeed:3.2+l*.07
  }
}

// ZONE
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

// KEYBOARD
addEventListener("keydown",e=>keys[e.key]=1);
addEventListener("keyup",e=>keys[e.key]=0);

function movePlayerKB(){
  if(!gameRunning)return;
  const r=gameArea.getBoundingClientRect();
  if(keys.ArrowUp)playerY-=playerSpeed;
  if(keys.ArrowDown)playerY+=playerSpeed;
  if(keys.ArrowLeft)playerX-=playerSpeed;
  if(keys.ArrowRight)playerX+=playerSpeed;

  playerX=Math.max(0,Math.min(r.width-playerSize,playerX));
  playerY=Math.max(0,Math.min(r.height-playerSize,playerY));
  updatePlayer();
}

// TOUCH
function touchMove(e){
  if(!gameRunning)return;
  const r=gameArea.getBoundingClientRect();
  const t=e.touches[0];
  playerX=t.clientX-r.left-playerSize/2;
  playerY=t.clientY-r.top-playerSize/2;
  playerX=Math.max(0,Math.min(r.width-playerSize,playerX));
  playerY=Math.max(0,Math.min(r.height-playerSize,playerY));
  updatePlayer();
}
gameArea.addEventListener("touchmove",touchMove,{passive:false});

// ENNEMIS + POWERUPS
let powerUp=null,powerActive=false,powerTimer=0;

function spawnEnemy(cfg,type="b"){
  const r=gameArea.getBoundingClientRect();
  const e=document.createElement("div");
  e.className="enemy";
  e.style.width=e.style.height=cfg.enemySize+"px";

  let side=Math.random()*4|0,x,y;
  if(side===0)x=-cfg.enemySize,y=Math.random()*r.height;
  else if(side===1)x=r.width+cfg.enemySize,y=Math.random()*r.height;
  else if(side===2)x=Math.random()*r.width,y=-cfg.enemySize;
  else x=Math.random()*r.width,y=r.height+cfg.enemySize;

  e.style.left=x+"px"; e.style.top=y+"px";
  gameArea.appendChild(e);

  const ang=Math.random()*Math.PI*2;
  const sp=cfg.enemyMinSpeed+Math.random()*(cfg.enemyMaxSpeed-cfg.enemyMinSpeed);
  enemies.push({el:e,x,y,vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp,size:cfg.enemySize});
}

function spawnPower(){
  if(powerUp||!gameRunning||Math.random()<0.985)return;
  const types=["shield","slow","speed"];
  const t=types[Math.random()*types.length|0];
  const r=gameArea.getBoundingClientRect(),s=22;
  const p=document.createElement("div");
  p.className="powerup"; p.dataset.type=t;

  p.style.left=Math.random()*(r.width-s)+"px";
  p.style.top=Math.random()*(r.height-s)+"px";

  if(t=="shield")p.style.background="#4ade80";
  if(t=="slow")p.style.background="#3b82f6";
  if(t=="speed")p.style.background="#f97316";

  gameArea.appendChild(p); powerUp=p;
}

function activate(type){
  powerActive=true; powerTimer=6;
  if(type=="shield")player.style.boxShadow="0 0 25px #22c55e";
  if(type=="slow")enemies.forEach(e=>{e.vx*=.5;e.vy*=.5});
  if(type=="speed")playerSpeed*=1.8;

  let iv=setInterval(()=>{
    powerTimer--;
    if(powerTimer<=0){
      clearInterval(iv); powerActive=false;
      playerSpeed=3.2+currentLevel*.07;
      player.style.boxShadow="";
    }
  },1000);
}

function checkPower(){
  if(!powerUp)return;
  const a=player.getBoundingClientRect(),b=powerUp.getBoundingClientRect();
  if(!(a.right<b.left||a.left>b.right||a.bottom<b.top||a.top>b.bottom)){
    activate(powerUp.dataset.type);
    powerUp.remove(); powerUp=null;
  }
}

function updateEnemies(){
  const r=gameArea.getBoundingClientRect();
  enemies.forEach(o=>{
    o.x+=o.vx; o.y+=o.vy;
    if(o.x<0||o.x>r.width-o.size)o.vx*=-1;
    if(o.y<0||o.y>r.height-o.size)o.vy*=-1;
    o.el.style.left=o.x+"px"; o.el.style.top=o.y+"px";
  });
}

// GAME
function collision(){
  const pr=player.getBoundingClientRect();
  for(const o of enemies){
    const er=o.el.getBoundingClientRect();
    const dx=pr.left-pr.left+er.width,dy=0;
    const d=Math.hypot(pr.left-er.left,pr.top-er.top);
    if(d<pr.width){
      if(powerActive)return; lose(); return;
    }
  }
}

function loop(){
  if(!gameRunning)return;
  if(!touch)movePlayerKB();
  updateEnemies(); spawnPower(); checkPower(); collision();
  requestAnimationFrame(loop);
}

// START LEVEL
function start(l){
  const c=getLevelConfig(l);
  levelSpan.textContent=l;
  timeLeft=c.duration; timeSpan.textContent=timeLeft;
  playerSpeed=c.playerSpeed;

  enemies.forEach(e=>e.el.remove()); enemies=[];
  for(let i=0;i<c.enemyCount;i++)spawnEnemy(c);

  centerPlayer();

  clearInterval(timerInterval);
  timerInterval=setInterval(()=>{
    if(!gameRunning)return;
    timeLeft--; timeSpan.textContent=timeLeft;
    if(timeLeft<=0)win();
  },1000);

  gameRunning=true; loop();
}

// WIN / LOSE
function win(){
  gameRunning=false; clearInterval(timerInterval);
  const winLines=[
    "EZ clap 🔥","Tu l’as fumé ce niveau 😂","Winnnn 🥶",
    "Le skill est certifié validé","SIGMA MOVE 💪","Free run chef 😈",
    "Autoroute du talent 🚀","Tu files comme Sonic 🌀"
  ];
  messageP.textContent=winLines[Math.random()*winLines.length|0];
  startBtn.textContent=(currentLevel>=maxLevel?"Restart":"Niveau suivant");
  startBtn.disabled=false;if(currentLevel<maxLevel)currentLevel++;
}

function lose(){
  gameRunning=false;clearInterval(timerInterval);attempts++;
  attemptsSpan.textContent=attempts;
  const loseLines=[
    "😱 skill issue","💀 retour lobby","🧍… déconnexion du skill",
    "Tu t'es fait clip 4K 📹","Ratio par une boule 🤡",
    "La boule : 1 – toi : 0","Encore ? 😭","Le mental est où là ? 🤨",
    "Mdr dash dans l’ennemi 😂","Ton iPhone a soufflé 😮‍💨",
    "BOOM fin de run 💥","Tu viens d'inventer une nouvelle façon de perdre",
    "Respect la persévérance, pas le skill 😂","T’as glissé c’est ça ? 😏",
    "Le niveau t’a éteint lumière comprise 😭","Plus rapide qu’un ghosting 💀",
    "Tu t’es pris un abonnement défaite","Arcade Dodge : 60 – toi : 0 😬",
    "JPP 💀","On refait ? Aïe aïe aïe","Toucher = mourir, tu touches 💀",
    "Le mur t'aimait trop","Game Over mais avec style 💅"
  ];
  messageP.textContent=loseLines[Math.random()*loseLines.length|0];
  startBtn.textContent="Recommencer";
  startBtn.disabled=false;
}

// UI
startBtn.onclick=()=>{
  startBtn.disabled=true;messageP.textContent="";
  start(currentLevel);
}

// INIT
onload=()=>{centerPlayer()}



