const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const UIscore = document.getElementById("score");
const UIhp = document.getElementById("hp");


const CONFIG = {
  WIDTH: 900,
  HEIGHT: 600,
  MAP_WIDTH: 3000,
  MAP_HEIGHT: 2000,
  
  
  WAVE_MESSAGE_DURATION: 120,    
  UPGRADE_SELECTION_TIME: 300,   
  WAVE_COOLDOWN: 1800,           
  SPAWN_INTERVAL_BASE: 800,
  
  
  MAX_PARTICLES: 400,
  MAX_BULLETS: 200,
  MAX_ENEMY_BULLETS: 80,
  MAX_BLOOD_STAINS: 100,
  MAX_ITEMS: 25,
  MAX_EXPLOSIONS: 10
};

const { WIDTH, HEIGHT, MAP_WIDTH, MAP_HEIGHT } = CONFIG;
canvas.width = WIDTH;
canvas.height = HEIGHT;


let debug = {
  particles: 0,
  bullets: 0,
  enemies: 0,
  fps: 0,
  lastFrameTime: performance.now(),
  enabled: false
};


let resetInProgress = false;
let resetRequested = false;


function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function dist(a, b) { return Math.hypot((a.x || a[0]) - (b.x || b[0]), (a.y || a[1]) - (b.y || b[1])); }
function lerp(a, b, t) { return a + (b - a) * t; }
function angleBetween(a, b) { return Math.atan2(b.y - a.y, b.x - a.x); }


const player = {
  x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2, r: 16, speed: 2.6, hp: 100, maxHp: 100,
  weapon: "smg", vx: 0, vy: 0, invulnerable: 0,
  dash: { cooldown: 0, duration: 0, power: 12 },
  grenades: 3,
  score: 0,
  lastMoved: 0,
  moveParticleTimer: 0,
  rotation: 0,
  scale: 1
};


const weapons = {
  smg: { 
    name: "SMG", fireRate: 120, dmg: 6, recoil: 1.0, speed: 15, 
    ammo: Infinity, spread: 0.15, color: "#aaffaa", description: "Rápida e eficiente",
    sound: "pew", trail: true
  },
  pistol: { 
    name: "Pistol", fireRate: 400, dmg: 12, recoil: 1.2, speed: 14, 
    ammo: 360, spread: 0.05, color: "#ffffaa", description: "Precisa e confiável",
    sound: "bang", trail: true
  },
  shotgun: { 
    name: "Shotgun", fireRate: 800, dmg: 8, recoil: 3.0, speed: 11, 
    ammo: 48, spread: 0.4, pellets: 8, color: "#ffaa55", description: "Poder de parada",
    sound: "boom", trail: false
  },
  minigun: { 
    name: "Minigun", fireRate: 60, dmg: 2.5, recoil: 0.6, speed: 16, 
    ammo: 600, spread: 0.2, color: "#ff5555", description: "Chuva de chumbo",
    sound: "ratatat", trail: true
  },
  rocket: { 
    name: "Rocket", fireRate: 1200, dmg: 60, recoil: 4.0, speed: 9, 
    ammo: 15, spread: 0, color: "#ffaa00", description: "Explosões poderosas",
    sound: "whoosh", trail: true, explosive: true
  },
  flamethrower: { 
    name: "Flame-thrower", fireRate: 30, dmg: 1.2, recoil: 0.2, speed: 10, 
    ammo: 200, spread: 0.25, color: "#ff5500", burn: true, description: "Queima tudo",
    sound: "flame", trail: false
  },
  railgun: { 
    name: "Railgun", fireRate: 1800, dmg: 120, recoil: 5.0, speed: 25, 
    ammo: 12, spread: 0, color: "#00ffff", pierce: true, description: "Perfura tudo",
    sound: "zap", trail: true
  }
};

let lastShot = 0;
let camera = { x: 0, y: 0, targetX: 0, targetY: 0 };


const bullets = [], enemies = [], items = [], enemyBullets = [];
const particles = [], bloodStains = [], explosions = [], grenades = [], powerUps = [];


let score = 0, spawnTimer = 0, gameOver = false, killCount = 0;
let wave = 1, enemiesToSpawn = 8, waveCooldown = 0, maxAlive = 15;
let showWaveMessage = false, waveMessageTimer = 0;


let shakeIntensity = 0;
let shakeDuration = 0;
let damageFlash = 0;


let availableUpgrades = [];
let showUpgrades = false;
let upgradeSelectionTime = 0;

const upgradeTypes = {
  health: { name: "Vida Extra", desc: "+50 HP máximo", type: "health", color: "#ff5555" },
  damage: { name: "Dano Aumentado", desc: "+25% de dano", type: "damage", color: "#ffff55" },
  speed: { name: "Velocidade", desc: "+20% de velocidade", type: "speed", color: "#55ff55" },
  fireRate: { name: "Cadência", desc: "+15% de velocidade", type: "fireRate", color: "#5555ff" },
  dash: { name: "Dash Melhorado", desc: "-30% recarga", type: "dash", color: "#55ffff" },
  grenade: { name: "Mais Granadas", desc: "+2 granadas", type: "grenade", color: "#ff55ff" }
};


const walls = [
  { x: 600, y: 400, w: 200, h: 40 }, { x: 1200, y: 800, w: 60, h: 300 },
  { x: 1800, y: 1200, w: 400, h: 40 }, { x: 2200, y: 600, w: 40, h: 400 },
  { x: 800, y: 1200, w: 300, h: 40 }, { x: 1400, y: 400, w: 40, h: 200 },
  { x: 2500, y: 800, w: 200, h: 40 }, { x: 500, y: 1500, w: 400, h: 40 },
  { x: 1000, y: 200, w: 100, h: 300 }, { x: 1600, y: 1000, w: 200, h: 60 },
  { x: 200, y: 800, w: 300, h: 40 }, { x: 2700, y: 1200, w: 60, h: 200 },
  { x: 400, y: 1200, w: 200, h: 40 }, { x: 1900, y: 400, w: 60, h: 200 }
];


const keys = {};
let mouse = { x: WIDTH / 2, y: HEIGHT / 2, down: false };


const audio = {
  play: (name) => {
    
    console.log(`Playing: ${name}`);
  }
};



function updateCamera() {
  camera.targetX = clamp(player.x - WIDTH / 2, 0, MAP_WIDTH - WIDTH);
  camera.targetY = clamp(player.y - HEIGHT / 2, 0, MAP_HEIGHT - HEIGHT);
  
  camera.x = lerp(camera.x, camera.targetX, 0.1);
  camera.y = lerp(camera.y, camera.targetY, 0.1);
  
  if (shakeDuration > 0) {
    shakeDuration--;
    camera.x += (Math.random() - 0.5) * shakeIntensity;
    camera.y += (Math.random() - 0.5) * shakeIntensity;
  }
}

function triggerCameraShake(intensity, duration) {
  shakeIntensity = intensity;
  shakeDuration = duration;
}

function triggerDamageFlash() {
  damageFlash = 1.0;
}

function createExplosion(x, y, radius, damage, color = "#ff5500") {
  explosions.push({
    x, y, radius, damage, color,
    growth: 0, maxGrowth: radius, duration: 30, currentDuration: 0
  });
  
  spawnParticles(x, y, color, 25, 6, 800, 4, "explosion");
  spawnParticles(x, y, "#ffff00", 15, 4, 600, 3, "fire");
  
  triggerCameraShake(radius * 0.3, 15);
  
  
  enemies.forEach(enemy => {
    const distance = dist({x, y}, enemy);
    if (distance < radius + enemy.r) {
      const damageMultiplier = 1 - (distance / (radius + enemy.r));
      enemy.hp -= damage * damageMultiplier;
      
      const angle = angleBetween({x, y}, enemy);
      const force = (1 - distance / (radius + enemy.r)) * 10;
      enemy.x += Math.cos(angle) * force;
      enemy.y += Math.sin(angle) * force;
    }
  });
  
  if (player.invulnerable <= 0) {
    const playerDistance = dist({x, y}, player);
    if (playerDistance < radius + player.r) {
      const damageMultiplier = 1 - (playerDistance / (radius + player.r));
      player.hp -= damage * damageMultiplier * 0.5;
      triggerDamageFlash();
    }
  }
}

function throwGrenade() {
  if (player.grenades <= 0) return;
  
  const worldMouseX = mouse.x + camera.x;
  const worldMouseY = mouse.y + camera.y;
  const angle = Math.atan2(worldMouseY - player.y, worldMouseX - player.x);
  
  grenades.push({
    x: player.x, y: player.y,
    vx: Math.cos(angle) * 14, vy: Math.sin(angle) * 14,
    r: 8, timer: 120, color: "#00ff00",
    distanceTraveled: 0, maxDistance: 600,
    friction: 0.86, bounces: 0, maxBounces: 3, onGround: false
  });
  
  player.grenades--;
  spawnParticles(player.x, player.y, "#00ff00", 8, 2, 400, 3);
}

function spawnPowerUp() {
  if (powerUps.length >= 5) return;
  
  const types = ["doubleDamage", "rapidFire", "invulnerability", "healthRegen", "ammoRegen", "speedBoost"];
  const type = types[Math.floor(Math.random() * types.length)];
  
  let x, y, attempts = 0;
  do {
    x = Math.random() * MAP_WIDTH;
    y = Math.random() * MAP_HEIGHT;
    attempts++;
  } while (dist({x, y}, player) < 400 && attempts < 10);
  
  if (attempts < 10) {
    powerUps.push({ x, y, r: 16, type, duration: 600, timer: 0, active: false });
  }
}

function spawnItem() {
  if (items.length >= CONFIG.MAX_ITEMS) return;
  
  const types = ["health", "ammo", "minigun", "rocket", "grenade"];
  const t = types[Math.floor(Math.random() * types.length)];
  let x, y, attempts = 0;
  
  do {
    x = Math.random() * MAP_WIDTH;
    y = Math.random() * MAP_HEIGHT;
    attempts++;
  } while (dist({x, y}, player) < 300 && attempts < 10);
  
  if (attempts < 10) {
    items.push({ x, y, r: 14, type: t });
  }
}


function spawnParticles(x, y, color, count = 8, speed = 2, life = 500, size = 2, type = "normal") {
  if (particles.length > CONFIG.MAX_PARTICLES - count) {
    count = Math.max(1, CONFIG.MAX_PARTICLES - particles.length);
  }
  
  const now = performance.now();
  for (let i = 0; i < count; i++) {
    const angle = type === "explosion" ? Math.random() * Math.PI * 2 : 
                 type === "circle" ? (Math.PI * 2 / count) * i : 
                 Math.random() * Math.PI * 2;
    
    const spd = speed * (0.5 + Math.random() * 0.5);
    
    const particle = {
      x, y, color, life, maxLife: life, size,
      vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd,
      born: now, type, rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.2
    };
    
    if (type === "fire") {
      particle.vy -= Math.random() * 0.5;
    } else if (type === "smoke") {
      particle.color = `rgba(100, 100, 100, ${0.3 + Math.random() * 0.3})`;
      particle.vy -= Math.random() * 0.3;
    }
    
    particles.push(particle);
  }
}


function getPathAroundWalls(start, end, enemy) {
  const directPath = { x: end.x - start.x, y: end.y - start.y };
  const distance = Math.hypot(directPath.x, directPath.y);
  
  if (distance === 0) return { x: 0, y: 0 };
  
  
  directPath.x /= distance;
  directPath.y /= distance;
  
  
  let hasClearPath = true;
  for (const wall of walls) {
    
    if (Math.abs(start.x - wall.x) < 200 && Math.abs(start.y - wall.y) < 200) {
      hasClearPath = false;
      break;
    }
  }
  
  if (hasClearPath) {
    return directPath;
  }
  
  
  let bestDirection = { x: directPath.x, y: directPath.y };
  let bestScore = distance;
  
  
  const directions = [
    { x: directPath.x, y: directPath.y },
    { x: directPath.y, y: -directPath.x }, 
    { x: -directPath.y, y: directPath.x }, 
    { x: directPath.x * 0.7, y: directPath.y * 0.7 } 
  ];
  
  for (const dir of directions) {
    const testX = start.x + dir.x * 50;
    const testY = start.y + dir.y * 50;
    let collision = false;
    
    for (const wall of walls) {
      if (testX + enemy.r > wall.x && testX - enemy.r < wall.x + wall.w &&
          testY + enemy.r > wall.y && testY - enemy.r < wall.y + wall.h) {
        collision = true;
        break;
      }
    }
    
    if (!collision) {
      const testDist = dist({x: testX, y: testY}, end);
      if (testDist < bestScore) {
        bestScore = testDist;
        bestDirection = dir;
      }
    }
  }
  
  return bestDirection;
}

function spawnEnemy(typeHint) {
  if (resetInProgress) return;
  
  const margin = 80;
  let x, y;
  const side = Math.floor(Math.random() * 4);
  
  switch (side) {
    case 0: x = -margin; y = Math.random() * MAP_HEIGHT; break;
    case 1: x = MAP_WIDTH + margin; y = Math.random() * MAP_HEIGHT; break;
    case 2: x = Math.random() * MAP_WIDTH; y = -margin; break;
    default: x = Math.random() * MAP_WIDTH; y = MAP_HEIGHT + margin;
  }

  if (dist({x, y}, player) < 200) {
    x = clamp(x + (Math.random() > 0.5 ? 250 : -250), 0, MAP_WIDTH);
    y = clamp(y + (Math.random() > 0.5 ? 250 : -250), 0, MAP_HEIGHT);
  }

  let type = typeHint || "chaser";
  if (!typeHint) {
    const r = Math.random();
    if (r < 0.4) type = "chaser";
    else if (r < 0.6) type = "shooter";
    else if (r < 0.75) type = "kamikaze";
    else if (r < 0.85) type = "tank";
    else if (r < 0.92) type = "exploder";
    else if (r < 0.96) type = "sniper";
  }

  const e = { 
    x, y, r: 16, hp: 20, maxHp: 20, speed: 1.2, type, cooldown: 0,
    lastShot: 0, specialCooldown: 0, lastDirectionChange: 0,
    avoidance: { timer: 0, direction: { x: 0, y: 0 } }
  };
  
  switch (type) {
    case "tank":
      Object.assign(e, { r: 26, hp: 80 + wave * 8, maxHp: 80 + wave * 8, speed: 0.5 + wave * 0.02, color: "#550000" });
      break;
    case "shooter":
      Object.assign(e, { hp: 25 + wave * 2.5, maxHp: 25 + wave * 2.5, speed: 0.9 + wave * 0.02, color: "#8a2be2", fireRate: 900 - Math.min(600, wave * 20) });
      break;
    case "kamikaze":
      Object.assign(e, { hp: 15 + wave * 1.2, maxHp: 15 + wave * 1.2, speed: 1.8 + wave * 0.05, color: "#ff4500" });
      break;
    case "chaser":
      Object.assign(e, { hp: 22 + wave * 1.8, maxHp: 22 + wave * 1.8, speed: 1.2 + wave * 0.03, color: "#900" });
      break;
    case "exploder":
      Object.assign(e, { hp: 18 + wave * 1.2, maxHp: 18 + wave * 1.2, speed: 1.0 + wave * 0.02, color: "#ff00ff", explosionTimer: 0 });
      break;
    case "sniper":
      Object.assign(e, { r: 14, hp: 15 + wave, maxHp: 15 + wave, speed: 0.8 + wave * 0.01, color: "#0088ff", fireRate: 1800, range: 800 });
      break;
  }
  
  enemies.push(e);
}

function updateEnemyAI(e, dt, now) {
  const angleToPlayer = angleBetween(e, player);
  
  
  e.avoidance.timer -= dt * 16.67;
  if (e.avoidance.timer <= 0) {
    const direction = getPathAroundWalls(e, player, e);
    e.avoidance.direction = direction;
    e.avoidance.timer = 30 + Math.random() * 30;
  }
  
  let moveX = 0, moveY = 0;
  
  switch (e.type) {
    case "chaser":
    case "tank":
    case "kamikaze":
      moveX = Math.cos(angleToPlayer) * e.speed;
      moveY = Math.sin(angleToPlayer) * e.speed;
      
      moveX = moveX * 0.7 + e.avoidance.direction.x * e.speed * 0.3;
      moveY = moveY * 0.7 + e.avoidance.direction.y * e.speed * 0.3;
      break;
      
    case "shooter":
      const distance = dist(e, player);
      if (distance > 340) {
        moveX = Math.cos(angleToPlayer) * e.speed;
        moveY = Math.sin(angleToPlayer) * e.speed;
      } else if (distance < 240) {
        moveX = -Math.cos(angleToPlayer) * e.speed;
        moveY = -Math.sin(angleToPlayer) * e.speed;
      }
      
      moveX = moveX * 0.8 + e.avoidance.direction.x * e.speed * 0.2;
      moveY = moveY * 0.8 + e.avoidance.direction.y * e.speed * 0.2;
      
      
      e.cooldown -= dt * 16.67;
      if (e.cooldown <= 0 && distance < 600 && enemyBullets.length < CONFIG.MAX_ENEMY_BULLETS) {
        e.cooldown = e.fireRate;
        const bvx = Math.cos(angleToPlayer) * (3 + Math.min(2, wave * 0.08));
        const bvy = Math.sin(angleToPlayer) * (3 + Math.min(2, wave * 0.08));
        enemyBullets.push({
          x: e.x, y: e.y, vx: bvx, vy: bvy, r: 5,
          dmg: 8 + Math.floor(wave / 3), life: 3000, born: now
        });
      }
      break;
      
    case "sniper":
      const sniperDist = dist(e, player);
      if (sniperDist > 400) {
        moveX = Math.cos(angleToPlayer) * e.speed;
        moveY = Math.sin(angleToPlayer) * e.speed;
      } else if (sniperDist < 200) {
        moveX = -Math.cos(angleToPlayer) * e.speed;
        moveY = -Math.sin(angleToPlayer) * e.speed;
      }
      
      e.cooldown -= dt * 16.67;
      if (e.cooldown <= 0 && sniperDist < e.range && enemyBullets.length < CONFIG.MAX_ENEMY_BULLETS) {
        e.cooldown = e.fireRate;
        const bvx = Math.cos(angleToPlayer) * 8;
        const bvy = Math.sin(angleToPlayer) * 8;
        enemyBullets.push({
          x: e.x, y: e.y, vx: bvx, vy: bvy, r: 4,
          dmg: 25 + Math.floor(wave / 2), life: 4000, born: now,
          color: "#0088ff", trail: true
        });
      }
      break;
      
    case "kamikaze":
      moveX = Math.cos(angleToPlayer) * e.speed * 1.5;
      moveY = Math.sin(angleToPlayer) * e.speed * 1.5;
      if (dist(e, player) < e.r + player.r + 6) {
        if (player.invulnerable <= 0) {
          player.hp -= 18 + Math.floor(wave * 0.8);
          triggerCameraShake(17, 5);
          triggerDamageFlash();
        }
        createExplosion(e.x, e.y, 80, 30, "#ff0000");
        return true; 
      }
      break;
      
    case "exploder":
      moveX = Math.cos(angleToPlayer) * e.speed;
      moveY = Math.sin(angleToPlayer) * e.speed;
      
      if (dist(e, player) < 150) {
        e.explosionTimer = (e.explosionTimer || 0) + 1;

              e.hp -= b.dmg;
      
      if (e.hp <= 0) {
        const particleColor = e.type === "tank" ? "#550000" : "#ff5555";
        spawnParticles(e.x, e.y, particleColor, 8, 2, 500);
        if (Math.random() < 0.12) spawnItem();
        if (Math.random() < 0.05) player.grenades++;
        enemies.splice(j, 1);
        score += e.type === "tank" ? 30 : (e.type === "shooter" ? 18 : 10);
        killCount++;
        player.score += e.type === "tank" ? 30 : (e.type === "shooter" ? 18 : 10);
      }
      
        if (e.explosionTimer > 60) {
          createExplosion(e.x, e.y, 120, 40, "#ff00ff");
          return true; 
        }
      } else {
        e.explosionTimer = 0;
      }
      break;
      
    
  }
  
  e.x += moveX;
  e.y += moveY;
  return false;
}

function shoot() {
  if (resetInProgress || gameOver) return;
  
  const now = performance.now();
  const gun = weapons[player.weapon];
  
  if (now - lastShot < gun.fireRate) return;
  if (gun.ammo !== Infinity && gun.ammo <= 0) return;
  if (bullets.length > CONFIG.MAX_BULLETS - (gun.pellets || 1)) return;
  
  lastShot = now;
  
  const worldMouseX = mouse.x + camera.x;
  const worldMouseY = mouse.y + camera.y;
  const angle = Math.atan2(worldMouseY - player.y, worldMouseX - player.x);
  
  const count = gun.pellets || 1;
  
  for (let i = 0; i < count; i++) {
    const spread = (Math.random() - 0.5) * gun.spread;
    const a = angle + spread;
    
    const bullet = {
      x: player.x, y: player.y,
      vx: Math.cos(a) * gun.speed, vy: Math.sin(a) * gun.speed,
      r: gun === weapons.shotgun ? 3 : gun === weapons.railgun ? 6 : 4,
      dmg: gun.dmg, color: gun.color, life: 1200, born: now, weaponType: player.weapon,
      trail: [], maxTrail: 5
    };
    
    if (gun.burn) {
      bullet.burn = true;
      bullet.life = 400;
    }
    
    if (gun.pierce) {
      bullet.pierce = true;
      bullet.pierced = [];
      bullet.life = 2000;
    }
    
    if (gun.explosive) {
      bullet.explosive = true;
    }
    
    bullets.push(bullet);
  }
  
  if (gun.ammo !== Infinity) gun.ammo--;
  player.vx -= Math.cos(angle) * gun.recoil;
  player.vy -= Math.sin(angle) * gun.recoil;
  
  spawnParticles(player.x, player.y, gun.color, 6, 2, 300);
  triggerCameraShake(gun.recoil * 0.8, 3);
  audio.play(gun.sound);
}

function circleRectColl(circle, rect) {
  const cx = clamp(circle.x, rect.x, rect.x + rect.w);
  const cy = clamp(circle.y, rect.y, rect.y + rect.h);
  return dist(circle, {x: cx, y: cy}) < circle.r;
}

function resolveColl(obj) {
  for (const w of walls) {
    if (circleRectColl(obj, w)) {
      const leftDist = Math.abs(obj.x - w.x);
      const rightDist = Math.abs(obj.x - (w.x + w.w));
      const topDist = Math.abs(obj.y - w.y);
      const bottomDist = Math.abs(obj.y - (w.y + w.h));
      const minDist = Math.min(leftDist, rightDist, topDist, bottomDist);
      
      if (minDist === leftDist) obj.x = w.x - obj.r;
      else if (minDist === rightDist) obj.x = w.x + w.w + obj.r;
      else if (minDist === topDist) obj.y = w.y - obj.r;
      else obj.y = w.y + w.h + obj.r;
    }
  }
}

function reset() {
  if (resetInProgress) return;
  
  resetInProgress = true;
  
  
  Object.assign(player, {
    x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2, hp: player.maxHp, weapon: "smg",
    vx: 0, vy: 0, invulnerable: 120, grenades: 3, score: 0
  });
  player.dash.cooldown = 0;
  player.dash.duration = 0;
  
  
  const arrays = [bullets, enemies, items, enemyBullets, particles, bloodStains, explosions, grenades, powerUps];
  arrays.forEach(arr => arr.length = 0);
  
  
  wave = 1;
  enemiesToSpawn = 8;
  waveCooldown = 0;
  killCount = 0;
  spawnTimer = 0;
  showWaveMessage = false;
  showUpgrades = false;
  gameOver = false;
  
  
  weapons.pistol.ammo = 360;
  weapons.shotgun.ammo = 48;
  weapons.minigun.ammo = 600;
  weapons.rocket.ammo = 15;
  weapons.flamethrower.ammo = 200;
  weapons.railgun.ammo = 12;
  
  
  camera.x = player.x - WIDTH / 2;
  camera.y = player.y - HEIGHT / 2;
  camera.targetX = camera.x;
  camera.targetY = camera.y;
  
  setTimeout(() => {
    resetInProgress = false;
    resetRequested = false;
  }, 100);
}

function generateUpgrades() {
  availableUpgrades = [];
  const upgradeKeys = Object.keys(upgradeTypes);
  
  while (availableUpgrades.length < 3 && availableUpgrades.length < upgradeKeys.length) {
    const randomUpgrade = upgradeKeys[Math.floor(Math.random() * upgradeKeys.length)];
    if (!availableUpgrades.includes(randomUpgrade)) {
      availableUpgrades.push(randomUpgrade);
    }
  }
  
  showUpgrades = true;
  upgradeSelectionTime = CONFIG.UPGRADE_SELECTION_TIME;
}

function applyUpgrade(upgradeKey) {
  const upgrade = upgradeTypes[upgradeKey];
  
  switch (upgrade.type) {
    case "health":
      player.maxHp += 50;
      player.hp += 50;
      break;
    case "damage":
      for (const weapon in weapons) {
        weapons[weapon].dmg *= 1.25;
      }
      break;
    case "speed":
      player.speed *= 1.2;
      break;
    case "fireRate":
      for (const weapon in weapons) {
        weapons[weapon].fireRate *= 0.85;
      }
      break;
    case "dash":
      player.dash.cooldown *= 0.7;
      break;
    case "grenade":
      player.grenades += 2;
      break;
  }
  
  showUpgrades = false;
  availableUpgrades = [];
  spawnParticles(player.x, player.y, upgrade.color, 20, 3, 600, 4, "circle");
}


function update(dt) {
  if (gameOver || resetInProgress) return;
  
  const now = performance.now();
  
  
  debug.particles = particles.length;
  debug.bullets = bullets.length;
  debug.enemies = enemies.length;
  debug.fps = Math.round(1000 / (now - debug.lastFrameTime));
  debug.lastFrameTime = now;
  
  updateCamera();
  
  
  if (player.dash.cooldown > 0) player.dash.cooldown--;
  if (player.dash.duration > 0) player.dash.duration--;
  if (player.invulnerable > 0) player.invulnerable--;
  
  
  if (enemies.length === 0 && enemiesToSpawn <= 0) {
    if (waveCooldown <= 0) {
      if (wave > 0 && wave % 3 === 0 && !showUpgrades) {
        generateUpgrades();
      } else {
        showWaveMessage = true;
        waveMessageTimer = CONFIG.WAVE_MESSAGE_DURATION;
        waveCooldown = CONFIG.WAVE_COOLDOWN;
        wave++;
        enemiesToSpawn = 8 + wave * 3;
        maxAlive = 15 + Math.floor(wave / 2);
      }
    } else {
      waveCooldown -= dt * 16.67;
    }
  }
  
  
  if (showWaveMessage) {
    waveMessageTimer -= dt * 16.67;
    if (waveMessageTimer <= 0) showWaveMessage = false;
  }
  
  if (showUpgrades) {
    upgradeSelectionTime -= dt * 16.67;
    if (upgradeSelectionTime <= 0) {
      showUpgrades = false;
      if (availableUpgrades.length > 0) {
        applyUpgrade(availableUpgrades[Math.floor(Math.random() * availableUpgrades.length)]);
      }
    }
  }
  
  
  let dx = 0, dy = 0;
  if (keys["w"]) dy--;
  if (keys["s"]) dy++;
  if (keys["a"]) dx--;
  if (keys["d"]) dx++;
  
  const isMoving = dx !== 0 || dy !== 0;
  if (isMoving) {
    player.lastMoved = now;
    player.moveParticleTimer -= dt * 16.67;
    if (player.moveParticleTimer <= 0) {
      spawnParticles(player.x, player.y, "#55aaff", 2, 1, 300, 2, "smoke");
      player.moveParticleTimer = 200;
    }
    player.scale = 1 + Math.sin(now * 0.01) * 0.1;
    player.rotation = Math.atan2(dy, dx);
  } else {
    player.scale = 1;
  }
  
  const moveSpeed = player.dash.duration > 0 ? player.speed * 1.5 : player.speed;
  if (dx || dy) {
    const m = Math.hypot(dx, dy) || 1;
    player.vx += (dx / m) * moveSpeed * 0.6;
    player.vy += (dy / m) * moveSpeed * 0.6;
  }
  
  player.vx *= 0.85;
  player.vy *= 0.85;
  player.x += player.vx;
  player.y += player.vy;
  player.x = clamp(player.x, player.r, MAP_WIDTH - player.r);
  player.y = clamp(player.y, player.r, MAP_HEIGHT - player.r);
  resolveColl(player);
  
  
  if (mouse.down) shoot();
  
  
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx;
    b.y += b.vy;
    
    
    if (b.trail) {
      b.trail.push({x: b.x, y: b.y});
      if (b.trail.length > b.maxTrail) b.trail.shift();
    }
    
    
if (b.weaponType === "rocket" || (b.explosive)) {
  let hitEnemy = false;
  for (let j = enemies.length - 1; j >= 0; j--) {
    const e = enemies[j];
    if (dist(b, e) < b.r + e.r) {
      
      e.hp -= b.dmg;
      
      if (e.hp <= 0) {
        const particleColor = e.type === "tank" ? "#550000" : "#ff5555";
        spawnParticles(e.x, e.y, particleColor, 8, 2, 500);
        if (Math.random() < 0.12) spawnItem();
        if (Math.random() < 0.05) player.grenades++;
        enemies.splice(j, 1);
        score += e.type === "tank" ? 30 : (e.type === "shooter" ? 18 : 10);
        killCount++;
        player.score += e.type === "tank" ? 30 : (e.type === "shooter" ? 18 : 10);
      }
      
      createExplosion(b.x, b.y, 80, 40, "#ff5500");
      bullets.splice(i, 1);
      hitEnemy = true;
      break;
    }
  }
  if (hitEnemy) continue;

  for (const w of walls) {
    if (circleRectColl(b, w)) {
      createExplosion(b.x, b.y, 80, 40, "#ff5500");
      bullets.splice(i, 1);
      break;
    }
  }
} else {
      
      if (now - b.born > b.life || b.x < -100 || b.x > MAP_WIDTH + 100 || b.y < -100 || b.y > MAP_HEIGHT + 100) {
        bullets.splice(i, 1);
        continue;
      }
      
      for (const w of walls) {
        if (circleRectColl(b, w)) {
          spawnParticles(b.x, b.y, b.color, 3, 1, 200);
          bullets.splice(i, 1);
          break;
        }
      }
    }
  }
  
  if (bullets.length > CONFIG.MAX_BULLETS) {
    bullets.splice(0, bullets.length - CONFIG.MAX_BULLETS);
  }
  
  
  for (let i = grenades.length - 1; i >= 0; i--) {
    const g = grenades[i];
    
    if (!g.onGround) {
      
      g.vx *= g.friction;
      g.vy *= g.friction;
      
      
      if (Math.abs(g.vx) < 0.1 && Math.abs(g.vy) < 0.1 && g.bounces > 0) {
        g.vx = 0;
        g.vy = 0;
        g.onGround = true;
      }
      
      g.x += g.vx;
      g.y += g.vy;
      g.distanceTraveled += Math.hypot(g.vx, g.vy);
    }
    
    g.timer--;
    
    
    let hitWall = false;
    for (const w of walls) {
      if (circleRectColl(g, w)) {
        
        const cx = clamp(g.x, w.x, w.x + w.w);
        const cy = clamp(g.y, w.y, w.y + w.h);
        const nx = (g.x - cx) / dist(g, {x: cx, y: cy});
        const ny = (g.y - cy) / dist(g, {x: cx, y: cy});
        
        
        const dot = g.vx * nx + g.vy * ny;
        g.vx = g.vx - 2 * dot * nx;
        g.vy = g.vy - 2 * dot * ny;
        
        
        g.vx *= 0.7;
        g.vy *= 0.7;
        
        g.bounces++;
        hitWall = true;
        
        
        if (nx !== 0) g.x += nx * 5;
        if (ny !== 0) g.y += ny * 5;
        
        break;
      }
    }
    
    
    if (g.timer <= 0 || g.distanceTraveled >= g.maxDistance || g.bounces > g.maxBounces) {
      createExplosion(g.x, g.y, 140, 70, "#00ff00");
      grenades.splice(i, 1);
      continue;
    }
    
    
    let hitEnemy = false;
    for (const e of enemies) {
      if (dist(g, e) < g.r + e.r) {
        createExplosion(g.x, g.y, 140, 70, "#00ff00");
        grenades.splice(i, 1);
        hitEnemy = true;
        break;
      }
    }
    if (hitEnemy) continue;
  }
  
  
  for (let i = explosions.length - 1; i >= 0; i--) {
    const exp = explosions[i];
    exp.currentDuration++;
    exp.growth = lerp(0, exp.maxGrowth, exp.currentDuration / exp.duration);
    
    if (exp.currentDuration >= exp.duration) {
      explosions.splice(i, 1);
    }
  }
  
  
  spawnTimer += dt * 1000;
  const spawnInterval = Math.max(150, CONFIG.SPAWN_INTERVAL_BASE - Math.min(500, wave * 15));
  if (spawnTimer > spawnInterval && enemiesToSpawn > 0 && enemies.length < maxAlive) {
    spawnTimer = 0;
    enemiesToSpawn--;
    spawnEnemy();
  }
  
  
  if (Math.random() < 0.002 && items.length < CONFIG.MAX_ITEMS) spawnItem();
  
  
  if (wave % 3 === 0 && Math.random() < 0.7) {
    spawnPowerUp();
  }
  
  
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    
    
    const shouldRemove = updateEnemyAI(e, dt, now);
    if (shouldRemove) {
      enemies.splice(i, 1);
      killCount++;
      continue;
    }
    
    resolveColl(e);
    
    
    for (let j = bullets.length - 1; j >= 0; j--) {
      const b = bullets[j];
      if (b.weaponType === "rocket") continue;
      
      if (dist(e, b) < e.r + b.r) {
        triggerCameraShake(6, 2);
        e.hp -= b.dmg;
        spawnParticles(b.x, b.y, "#ffffff", 4, 1, 300);
        
        if (Math.random() < 0.3 && bloodStains.length < CONFIG.MAX_BLOOD_STAINS) {
          bloodStains.push({
            x: e.x, y: e.y, size: 8 + Math.random() * 8, alpha: 0.7
          });
        }
        
        bullets.splice(j, 1);
        if (e.hp <= 0) {
          const particleColor = e.type === "tank" ? "#550000" : "#ff5555";
          spawnParticles(e.x, e.y, particleColor, 8, 2, 500);
          if (Math.random() < 0.12) spawnItem();
          if (Math.random() < 0.05) player.grenades++;
          enemies.splice(i, 1);
          score += e.type === "tank" ? 30 : (e.type === "shooter" ? 18 : 10);
          killCount++;
          player.score += e.type === "tank" ? 30 : (e.type === "shooter" ? 18 : 10);
          break;
        }
      }
    }
    
    if (e.type !== "kamikaze" && dist(e, player) < e.r + player.r) {
      if (player.invulnerable <= 0) {
        player.hp -= 0.08 * (e.type === "tank" ? 3 : 1);
        triggerCameraShake(10, 3);
        triggerDamageFlash();
        if (player.hp <= 0) gameOver = true;
      }
      const pushAng = Math.atan2(e.y - player.y, e.x - player.x);
      e.x += Math.cos(pushAng) * 6;
      e.y += Math.sin(pushAng) * 6;
    }
  }
  
  
  for (let i = enemyBullets.length - 1; i >= 0; i--) {
    const b = enemyBullets[i];
    b.x += b.vx;
    b.y += b.vy;
    
    if (now - b.born > b.life || b.x < -100 || b.x > MAP_WIDTH + 100 || b.y < -100 || b.y > MAP_HEIGHT + 100) {
      enemyBullets.splice(i, 1);
      continue;
    }
    
    if (dist(b, player) < player.r + b.r) {
      if (player.invulnerable <= 0) {
        player.hp -= b.dmg;
        triggerCameraShake(12, 4);
        triggerDamageFlash();
        if (player.hp <= 0) gameOver = true;
      }
      enemyBullets.splice(i, 1);
      continue;
    }
    
    for (const w of walls) {
      if (circleRectColl(b, w)) {
        enemyBullets.splice(i, 1);
        break;
      }
    }
  }
  
  if (enemyBullets.length > CONFIG.MAX_ENEMY_BULLETS) {
    enemyBullets.splice(0, enemyBullets.length - CONFIG.MAX_ENEMY_BULLETS);
  }
  
  
  for (let i = items.length - 1; i >= 0; i--) {
    if (dist(player, items[i]) < player.r + items[i].r) {
      if (items[i].type === "health") {
        player.hp = Math.min(player.maxHp, player.hp + 35);
      } else if (items[i].type === "ammo") {
        weapons.pistol.ammo += 40 + Math.floor(wave * 2);
        weapons.shotgun.ammo += 20 + Math.floor(wave * 1);
        weapons.minigun.ammo += 100 + Math.floor(wave * 3);
        weapons.rocket.ammo += 5;
      } else if (items[i].type === "minigun") {
        player.weapon = "minigun";
      } else if (items[i].type === "rocket") {
        player.weapon = "rocket";
      } else if (items[i].type === "grenade") {
        player.grenades += 2;
      }
      spawnParticles(items[i].x, items[i].y, "#ffff00", 6, 1, 400);
      items.splice(i, 1);
    }
  }
  
  
  for (let i = powerUps.length - 1; i >= 0; i--) {
    const p = powerUps[i];
    if (dist(player, p) < player.r + p.r) {
      spawnParticles(p.x, p.y, "#ff00ff", 12, 2, 500);
      powerUps.splice(i, 1);
    }
  }
  
  
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    const age = now - p.born;
    
    if (age >= p.life) {
      particles.splice(i, 1);
      continue;
    }
    
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.95;
    p.vy *= 0.95;
  }
  
  if (particles.length > CONFIG.MAX_PARTICLES) {
    particles.splice(0, particles.length - CONFIG.MAX_PARTICLES);
  }
  
  
  for (let i = bloodStains.length - 1; i >= 0; i--) {
    bloodStains[i].alpha -= 0.0015;
    if (bloodStains[i].alpha <= 0) bloodStains.splice(i, 1);
  }
  
  if (bloodStains.length > CONFIG.MAX_BLOOD_STAINS) {
    bloodStains.splice(0, bloodStains.length - CONFIG.MAX_BLOOD_STAINS);
  }
  
  
  const gun = weapons[player.weapon];
  UIscore.textContent = `Wave ${wave} | Score: ${player.score} | Kills: ${killCount}`;
  UIhp.textContent = `HP: ${Math.round(player.hp)} | ${gun.name} | Ammo: ${gun.ammo === Infinity ? "∞" : gun.ammo} | Grenades: ${player.grenades}${player.dash.cooldown > 0 ? ` | Dash: ${Math.ceil(player.dash.cooldown / 60)}s` : " | Dash: READY"}`;
  
  
  if (player.hp < 30 && Math.random() < 0.006 && items.length < CONFIG.MAX_ITEMS) spawnItem();
}


function draw() {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  
  
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  
  
  ctx.strokeStyle = "#2a2a2a";
  ctx.lineWidth = 1;
  for (let x = 0; x < WIDTH; x += 50) {
    ctx.beginPath();
    ctx.moveTo(x - (camera.x % 50), 0);
    ctx.lineTo(x - (camera.x % 50), HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y < HEIGHT; y += 50) {
    ctx.beginPath();
    ctx.moveTo(0, y - (camera.y % 50));
    ctx.lineTo(WIDTH, y - (camera.y % 50));
    ctx.stroke();
  }
  
  
  for (const stain of bloodStains) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, stain.alpha);
    ctx.fillStyle = "#8a0000";
    ctx.beginPath();
    ctx.arc(stain.x - camera.x, stain.y - camera.y, Math.max(0, stain.size), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  
  
  ctx.fillStyle = "#454545";
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 2;
  for (const w of walls) {
    ctx.fillRect(w.x - camera.x, w.y - camera.y, w.w, w.h);
    ctx.strokeRect(w.x - camera.x, w.y - camera.y, w.w, w.h);
  }
  
  for (const exp of explosions) {
    const progress = exp.currentDuration / exp.duration;
    const alpha = 1 - progress;
    const currentRadius = exp.growth;
    
    ctx.save();
    ctx.globalAlpha = alpha * 0.7;
    
    const gradient = ctx.createRadialGradient(
      exp.x - camera.x, exp.y - camera.y, 0,
      exp.x - camera.x, exp.y - camera.y, currentRadius
    );
    gradient.addColorStop(0, exp.color);
    gradient.addColorStop(0.7, "#ffff00");
    gradient.addColorStop(1, "transparent");
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(exp.x - camera.x, exp.y - camera.y, currentRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  
  for (const g of grenades) {
    const screenX = g.x - camera.x;
    const screenY = g.y - camera.y;
    
    ctx.fillStyle = g.color;
    ctx.beginPath();
    ctx.arc(screenX, screenY, g.r, 0, Math.PI * 2);
    ctx.fill();
    
    
    const timerProgress = g.timer / 120;
    ctx.strokeStyle = g.onGround ? "#ff0000" : "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + timerProgress * Math.PI * 2;
    
    ctx.arc(screenX, screenY, g.r + 4, startAngle, endAngle);
    ctx.stroke();
    
    
    const bouncesLeft = g.maxBounces - g.bounces;
    if (bouncesLeft > 0 && !g.onGround) {
      ctx.fillStyle = "#ffff00";
      ctx.font = "10px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(bouncesLeft.toString(), screenX, screenY);
    }
  }
  
  
  for (const it of items) {
    const pulse = Math.sin(performance.now() * 0.01) * 2;
    const screenX = it.x - camera.x;
    const screenY = it.y - camera.y;
    
    const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, it.r * 2);
    
    if (it.type === "health") {
      gradient.addColorStop(0, "#00ff00");
      gradient.addColorStop(1, "#004400");
    } else if (it.type === "ammo") {
      gradient.addColorStop(0, "#ffff00");
      gradient.addColorStop(1, "#444400");
    } else if (it.type === "minigun" || it.type === "rocket") {
      gradient.addColorStop(0, "#ff5500");
      gradient.addColorStop(1, "#442200");
    } else {
      gradient.addColorStop(0, "#00ff00");
      gradient.addColorStop(1, "#004400");
    }
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(screenX, screenY, Math.max(0, it.r + pulse), 0, Math.PI * 2);
    ctx.fill();
    
    ctx.strokeStyle = it.type === "health" ? "#0f0" : it.type === "ammo" ? "#ff0" : "#f50";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(screenX, screenY, Math.max(0, it.r + pulse + 1), 0, Math.PI * 2);
    ctx.stroke();
  }
  
  
  for (const p of powerUps) {
    const pulse = Math.sin(performance.now() * 0.02) * 3;
    ctx.fillStyle = "#ff00ff";
    ctx.beginPath();
    ctx.arc(p.x - camera.x, p.y - camera.y, Math.max(0, p.r + pulse), 0, Math.PI * 2);
    ctx.fill();
    
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x - camera.x, p.y - camera.y, Math.max(0, p.r + pulse + 2), 0, Math.PI * 2);
    ctx.stroke();
  }
  
  
  ctx.fillStyle = "#ff5555";
  for (const b of enemyBullets) {
    ctx.beginPath();
    ctx.arc(b.x - camera.x, b.y - camera.y, Math.max(0, b.r), 0, Math.PI * 2);
    ctx.fill();
  }
  
  
  for (const b of bullets) {
    const screenX = b.x - camera.x;
    const screenY = b.y - camera.y;
    
    
    if (b.trail && b.trail.length > 1) {
      ctx.strokeStyle = b.color;
      ctx.lineWidth = b.r * 0.5;
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.moveTo(b.trail[0].x - camera.x, b.trail[0].y - camera.y);
      for (let i = 1; i < b.trail.length; i++) {
        ctx.lineTo(b.trail[i].x - camera.x, b.trail[i].y - camera.y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    
    
    if (b.weaponType === "railgun") {
      ctx.strokeStyle = "#00ffff";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const offsetX = (Math.random() - 0.5) * 8;
        const offsetY = (Math.random() - 0.5) * 8;
        ctx.moveTo(screenX, screenY);
        ctx.lineTo(screenX - b.vx * 0.5 + offsetX, screenY - b.vy * 0.5 + offsetY);
      }
      ctx.stroke();
    }
    
    if (b.weaponType === "flamethrower") {
      const flameSize = b.r * (0.8 + Math.random() * 0.4);
      const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, flameSize);
      gradient.addColorStop(0, "#ffff00");
      gradient.addColorStop(0.5, "#ff5500");
      gradient.addColorStop(1, "transparent");
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(screenX, screenY, flameSize, 0, Math.PI * 2);
      ctx.fill();
    }
    
    
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.arc(screenX, screenY, b.r, 0, Math.PI * 2);
    ctx.fill();
    
    
    if (b.weaponType === "railgun" || b.weaponType === "rocket") {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(screenX, screenY, b.r + 1, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  
  
  for (const e of enemies) {
    const screenX = e.x - camera.x;
    const screenY = e.y - camera.y;
    
    let color = e.color || "#900";
    switch (e.type) {
      case "tank": color = "#550000"; break;
      case "shooter": color = "#8a2be2"; break;
      case "kamikaze": color = "#ff4500"; break;
      case "exploder": 
        color = "#ff00ff";
        if (e.explosionTimer > 30) {
          const pulse = Math.sin(performance.now() * 0.1) * 3;
          ctx.fillStyle = "#ffff00";
          ctx.beginPath();
          ctx.arc(screenX, screenY, Math.max(0, e.r + pulse), 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      case "sniper": color = "#0088ff"; break;
    }
    
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(screenX, screenY, Math.max(0, e.r), 0, Math.PI * 2);
    ctx.fill();
    
    
    if (e.hp < e.maxHp) {
      ctx.fillStyle = "#111";
      ctx.fillRect(screenX - e.r, screenY - e.r - 8, e.r * 2, 5);
      const hpFrac = clamp(e.hp / e.maxHp, 0, 1);
      ctx.fillStyle = hpFrac > 0.5 ? "#0f0" : hpFrac > 0.25 ? "#ff0" : "#f00";
      ctx.fillRect(screenX - e.r + 1, screenY - e.r - 7, Math.max(0, (e.r * 2 - 2) * hpFrac), 3);
    }
  }
  
  
  ctx.save();
  const screenX = player.x - camera.x;
  const screenY = player.y - camera.y;
  
  ctx.translate(screenX, screenY);
  ctx.rotate(player.rotation);
  ctx.scale(player.scale, player.scale);

  if (player.invulnerable > 0 && Math.floor(player.invulnerable / 3) % 2 === 0) {
    ctx.globalAlpha = 0.6;
  }

  
  ctx.fillStyle = player.dash.duration > 0 ? "#55aaff" : "#1af";
  ctx.beginPath();
  ctx.arc(0, 0, player.r, 0, Math.PI * 2);
  ctx.fill();

  
  if (player.dash.duration > 0) {
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, player.r + 3, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
  ctx.globalAlpha = 1;

  
  const worldMouseX = mouse.x + camera.x;
  const worldMouseY = mouse.y + camera.y;
  const angle = Math.atan2(worldMouseY - player.y, worldMouseX - player.x);

  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(screenX, screenY);
  ctx.lineTo(screenX + Math.cos(angle) * 25, screenY + Math.sin(angle) * 25);
  ctx.stroke();
  
  
  for (const p of particles) {
    const age = performance.now() - p.born;
    
    if (age >= p.life) continue;
    
    const lifeFrac = 1 - (age / p.life);
    const particleSize = Math.max(0.1, p.size * lifeFrac);
    
    ctx.globalAlpha = Math.max(0, Math.min(1, lifeFrac));
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x - camera.x, p.y - camera.y, particleSize, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  
  
  ctx.strokeStyle = player.invulnerable > 0 ? "#55aaff" : "#fff";
  ctx.lineWidth = 1;
  
  ctx.beginPath();
  ctx.moveTo(mouse.x - 12, mouse.y);
  ctx.lineTo(mouse.x + 12, mouse.y);
  ctx.moveTo(mouse.x, mouse.y - 12);
  ctx.lineTo(mouse.x, mouse.y + 12);
  ctx.stroke();
  
  ctx.beginPath();
  ctx.arc(mouse.x, mouse.y, 8, 0, Math.PI * 2);
  ctx.stroke();
  
  ctx.fillStyle = player.invulnerable > 0 ? "#55aaff" : "#f00";
  ctx.beginPath();
  ctx.arc(mouse.x, mouse.y, 2, 0, Math.PI * 2);
  ctx.fill();
  
  
  drawMiniMap();
  
  
  drawWeaponSelector();

  
  drawHUD();
  
  
  if (showWaveMessage) {
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(WIDTH/2 - 200, HEIGHT/2 - 50, 400, 100);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.font = "bold 32px Arial";
    ctx.fillText(`Wave ${wave} Complete!`, WIDTH/2, HEIGHT/2 - 10);
    ctx.font = "18px Arial";
    ctx.fillText(`Prepare for Wave ${wave + 1}...`, WIDTH/2, HEIGHT/2 + 25);
  }
  
  
  if (showUpgrades) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.font = "bold 28px Arial";
    ctx.fillText("ESCOLHA UM MELHORIA", WIDTH/2, 80);
    
    const totalWidth = availableUpgrades.length * 180 + (availableUpgrades.length - 1) * 20;
    const startX = (WIDTH - totalWidth) / 2;
    const boxWidth = 180;
    const boxHeight = 100;
    const y = HEIGHT/2 - boxHeight/2;
    
    availableUpgrades.forEach((upgradeKey, index) => {
      const upgrade = upgradeTypes[upgradeKey];
      const x = startX + index * (boxWidth + 20);
      
      ctx.fillStyle = "#2a2a2a";
      ctx.fillRect(x, y, boxWidth, boxHeight);
      
      ctx.strokeStyle = "#55aaff";
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, boxWidth, boxHeight);
      
      ctx.fillStyle = "#fff";
      ctx.font = "bold 16px Arial";
      ctx.fillText(upgrade.name, x + boxWidth/2, y + 30);
      
      ctx.font = "12px Arial";
      ctx.fillText(upgrade.desc, x + boxWidth/2, y + 55);
      
      ctx.fillStyle = "#55aaff";
      ctx.font = "bold 14px Arial";
      ctx.fillText(`Tecla ${index + 1}`, x + boxWidth/2, y + 80);
    });
    
    ctx.fillStyle = "#fff";
    ctx.font = "14px Arial";
    ctx.fillText(`Tempo: ${Math.ceil(upgradeSelectionTime / 60)}s`, WIDTH/2, HEIGHT - 40);
  }
  
  
  if (gameOver) {
    ctx.fillStyle = "rgba(0,0,0,0.8)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.font = "bold 48px Arial";
    ctx.fillText("GAME OVER", WIDTH / 2, HEIGHT / 2 - 40);
    ctx.font = "20px Arial";
    ctx.fillText(`Final Score: ${player.score} | Kills: ${killCount} | Waves: ${wave}`, WIDTH / 2, HEIGHT / 2);
    ctx.fillText("Press R to restart", WIDTH / 2, HEIGHT / 2 + 40);
  }
  
  
  if (damageFlash > 0) {
    ctx.fillStyle = `rgba(255, 0, 0, ${damageFlash * 0.3})`;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    damageFlash -= 0.05;
  }
  
  
  if (debug.enabled) {
    ctx.fillStyle = "#fff";
    ctx.font = "12px Arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText(`FPS: ${debug.fps}`, 10, 20);
    ctx.fillText(`Particles: ${debug.particles}/${CONFIG.MAX_PARTICLES}`, 10, 35);
    ctx.fillText(`Bullets: ${debug.bullets}/${CONFIG.MAX_BULLETS}`, 10, 50);
    ctx.fillText(`Enemies: ${debug.enemies}`, 10, 65);
    ctx.fillText(`Explosions: ${explosions.length}`, 10, 80);
    ctx.fillText(`Grenades: ${grenades.length}`, 10, 95);
  }
}

function drawMiniMap() {
  const scale = 0.05;
  const mapSize = 120;
  const mapX = WIDTH - mapSize - 10;
  const mapY = HEIGHT - mapSize - 10;
  
  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.fillRect(mapX, mapY, mapSize, mapSize);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1;
  ctx.strokeRect(mapX, mapY, mapSize, mapSize);
  
  const viewScale = mapSize / Math.max(MAP_WIDTH, MAP_HEIGHT);
  const viewWidth = MAP_WIDTH * viewScale;
  const viewHeight = MAP_HEIGHT * viewScale;
  
  const offsetX = mapX + (mapSize - viewWidth) / 2;
  const offsetY = mapY + (mapSize - viewHeight) / 2;
  
  ctx.fillStyle = "#555";
  for (const w of walls) {
    ctx.fillRect(
      offsetX + w.x * viewScale,
      offsetY + w.y * viewScale,
      Math.max(0, w.w * viewScale),
      Math.max(0, w.h * viewScale)
    );
  }
  
  ctx.fillStyle = "#1af";
  ctx.beginPath();
  ctx.arc(offsetX + player.x * viewScale, offsetY + player.y * viewScale, 3, 0, Math.PI * 2);
  ctx.fill();
  
  for (const e of enemies) {
    ctx.fillStyle = e.type === "tank" ? "#500" : "#f00";
    ctx.beginPath();
    ctx.arc(offsetX + e.x * viewScale, offsetY + e.y * viewScale, e.type === "tank" ? 3 : 2, 0, Math.PI * 2);
    ctx.fill();
  }
  
  for (const it of items) {
    ctx.fillStyle = it.type === "health" ? "#0f0" : it.type === "ammo" ? "#ff0" : "#f50";
    ctx.beginPath();
    ctx.arc(offsetX + it.x * viewScale, offsetY + it.y * viewScale, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawHUD() {
  ctx.font = "bold 16px Arial";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  
  
  const hpBarWidth = 250;
  const hpBarHeight = 30;
  const hpPercent = player.hp / player.maxHp;
  
  ctx.fillStyle = "#333";
  ctx.fillRect(20, 20, hpBarWidth, hpBarHeight);
  ctx.fillStyle = hpPercent > 0.5 ? "#0f0" : hpPercent > 0.25 ? "#ff0" : "#f00";
  ctx.fillRect(20, 20, hpBarWidth * hpPercent, hpBarHeight);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.strokeRect(20, 20, hpBarWidth, hpBarHeight);
  ctx.fillStyle = "#fff";
  ctx.fillText(`HP: ${Math.round(player.hp)}/${player.maxHp}`, 30, 20 + hpBarHeight/2);
  
  
  const weaponBoxWidth = 250;
  const weaponBoxHeight = 45;
  ctx.fillStyle = "#333";
  ctx.fillRect(20, 60, weaponBoxWidth, weaponBoxHeight);
  ctx.strokeStyle = "#fff";
  ctx.strokeRect(20, 60, weaponBoxWidth, weaponBoxHeight);
  const gun = weapons[player.weapon];
  ctx.fillStyle = "#fff";
  ctx.fillText(`${gun.name}`, 30, 60 + 15);
  ctx.fillText(`Munição: ${gun.ammo === Infinity ? "∞" : gun.ammo}`, 30, 60 + 35);
  
  
  const dashBoxWidth = 250;
  const dashBoxHeight = 20;
  ctx.fillStyle = "#333";
  ctx.fillRect(20, 115, dashBoxWidth, dashBoxHeight);
  if (player.dash.cooldown > 0) {
    const dashPercent = 1 - (player.dash.cooldown / 90);
    ctx.fillStyle = "#55aaff";
    ctx.fillRect(20, 115, dashBoxWidth * dashPercent, dashBoxHeight);
    ctx.fillStyle = "#fff";
    ctx.font = "12px Arial";
    ctx.fillText(`Recarga: ${Math.ceil(player.dash.cooldown / 60)}s`, 30, 115 + dashBoxHeight/2);
  } else {
    ctx.fillStyle = "#55aaff";
    ctx.fillRect(20, 115, dashBoxWidth, dashBoxHeight);
    ctx.fillStyle = "#000";
    ctx.font = "bold 12px Arial";
    ctx.fillText("DASH PRONTO", 30, 115 + dashBoxHeight/2);
  }
  ctx.strokeStyle = "#fff";
  ctx.strokeRect(20, 115, dashBoxWidth, dashBoxHeight);
  
  
  const nadeBoxWidth = 250;
  const nadeBoxHeight = 25;
  ctx.fillStyle = "#333";
  ctx.fillRect(20, 145, nadeBoxWidth, nadeBoxHeight);
  ctx.strokeStyle = "#fff";
  ctx.strokeRect(20, 145, nadeBoxWidth, nadeBoxHeight);
  ctx.fillStyle = "#0f0";
  ctx.font = "16px Arial";
  ctx.fillText(`Granadas: ${player.grenades} (Q)`, 30, 145 + nadeBoxHeight/2);
  
  
  const infoBoxWidth = 300;
  const infoBoxHeight = 40;
  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.fillRect(WIDTH - infoBoxWidth - 20, 20, infoBoxWidth, infoBoxHeight);
  ctx.strokeStyle = "#fff";
  ctx.strokeRect(WIDTH - infoBoxWidth - 20, 20, infoBoxWidth, infoBoxHeight);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.font = "bold 16px Arial";
  ctx.fillText(`Wave ${wave} | Pontuação: ${player.score} | Abates: ${killCount}`, WIDTH - infoBoxWidth/2 - 20, 20 + infoBoxHeight/2);
}

function drawWeaponSelector() {
  const weaponKeys = Object.keys(weapons);
  const selectorWidth = 400;
  const startX = (WIDTH - selectorWidth) / 2;
  const y = HEIGHT - 60;
  const slotWidth = selectorWidth / weaponKeys.length;
  
  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.fillRect(startX, y, selectorWidth, 40);
  ctx.strokeStyle = "#555";
  ctx.lineWidth = 1;
  ctx.strokeRect(startX, y, selectorWidth, 40);
  
  weaponKeys.forEach((weaponKey, index) => {
    const weapon = weapons[weaponKey];
    const x = startX + index * slotWidth;
    const isSelected = player.weapon === weaponKey;
    
    ctx.fillStyle = isSelected ? "#55aaff" : "#333";
    ctx.fillRect(x + 2, y + 2, slotWidth - 4, 36);
    
    ctx.fillStyle = isSelected ? "#000" : "#fff";
    ctx.font = "10px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(weapon.name, x + slotWidth/2, y + 20);
    
    ctx.fillStyle = isSelected ? "#000" : "#55aaff";
    ctx.font = "bold 12px Arial";
    ctx.fillText((index + 1).toString(), x + 15, y + 12);
    
    if (weapon.ammo !== Infinity) {
      ctx.fillStyle = isSelected ? "#000" : "#ffaa00";
      ctx.font = "9px Arial";
      ctx.fillText(weapon.ammo.toString(), x + slotWidth - 12, y + 12);
    }
  });
}


function handleKeyDown(e) {
  const key = e.key.toLowerCase();
  keys[key] = true;
  
  if (!resetInProgress) {
    const weaponKeys = ["1", "2", "3", "4", "5", "6", "7"];
    const weaponNames = ["smg", "pistol", "shotgun", "minigun", "rocket", "flamethrower", "railgun"];
    
    const index = weaponKeys.indexOf(key);
    if (index !== -1) player.weapon = weaponNames[index];
    
    if (key === "q") throwGrenade();
  }
  
  if (key === "r" && !resetInProgress && !resetRequested) {
    resetRequested = true;
    setTimeout(() => {
      if (resetRequested) {
        reset();
        resetRequested = false;
      }
    }, 0);
  }
  
  if (key === "h") debug.enabled = !debug.enabled;
  
  if (key === "shift" && player.dash.cooldown <= 0 && !resetInProgress) {
    const angle = Math.atan2(mouse.y - HEIGHT / 2, mouse.x - WIDTH / 2);
    player.vx += Math.cos(angle) * player.dash.power;
    player.vy += Math.sin(angle) * player.dash.power;
    player.dash.duration = 10;
    player.dash.cooldown = 90;
    player.invulnerable = 15;
    spawnParticles(player.x, player.y, "#55aaff", 12, 3, 400);
  }
  
  
  if (showUpgrades) {
    if (key === "1" && availableUpgrades[0]) {
      applyUpgrade(availableUpgrades[0]);
      keys["1"] = false;
    }
    if (key === "2" && availableUpgrades[1]) {
      applyUpgrade(availableUpgrades[1]);
      keys["2"] = false;
    }
    if (key === "3" && availableUpgrades[2]) {
      applyUpgrade(availableUpgrades[2]);
      keys["3"] = false;
    }
  }
}

function handleKeyUp(e) {
  keys[e.key.toLowerCase()] = false;
}

function handleMouseMove(e) {
  const rect = canvas.getBoundingClientRect();
  mouse.x = e.clientX - rect.left;
  mouse.y = e.clientY - rect.top;
}

function handleMouseDown(e) {
  mouse.down = true;
}

function handleMouseUp(e) {
  mouse.down = false;
}

function setupEventListeners() {
  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);
  canvas.addEventListener("mousemove", handleMouseMove);
  canvas.addEventListener("mousedown", handleMouseDown);
  window.addEventListener("mouseup", handleMouseUp);
  canvas.addEventListener('contextmenu', e => e.preventDefault());
}


let last = performance.now();
let frameCount = 0;
let lastFpsUpdate = 0;

function loop(now) {
  frameCount++;
  
  const dt = Math.min((now - last) / (1000 / 60), 2);
  last = now;
  
  try {
    update(dt);
    draw();
  } catch (error) {
    console.error("Erro no game loop:", error);
    if (!resetInProgress) reset();
  }
  
  if (now - lastFpsUpdate >= 1000) {
    debug.fps = frameCount;
    frameCount = 0;
    lastFpsUpdate = now;
  }
  
  requestAnimationFrame(loop);
}


function init() {
  try {
    setupEventListeners();
    reset();
    requestAnimationFrame(loop);
  } catch (error) {
    console.error("Erro na inicialização:", error);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}