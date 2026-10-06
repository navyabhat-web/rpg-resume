const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const dialogueBox = document.getElementById('dialogue-box');
const dialogueName = document.getElementById('dialogue-name');
const dialogueText = document.getElementById('dialogue-text');
const instructions = document.getElementById('instructions');
const startBtn = document.getElementById('start-btn');
const scoreEl = document.getElementById('score');

const TILE_SIZE = 32;
// Viewport size
const VIEW_COLS = 20; 
const VIEW_ROWS = 15;
// Map Size
const COLS = 40; 
const ROWS = 30;

// Game State
let state = 'START'; // START, PLAY, DIALOGUE
let currentDialogue = null;
let dialogueIndex = 0;
let skillsCollected = 0;
const totalSkills = 5;

// Build a 40x30 map (0: Floor, 1: Wall)
const map = Array.from({length: ROWS}, () => Array(COLS).fill(0));
// Add borders
for(let y=0; y<ROWS; y++) {
  map[y][0] = 1;
  map[y][COLS-1] = 1;
}
for(let x=0; x<COLS; x++) {
  map[0][x] = 1;
  map[ROWS-1][x] = 1;
}

// Add some internal walls / structures
function addRoom(startX, startY, width, height, doorX, doorY) {
  for(let y=startY; y<startY+height; y++) {
    for(let x=startX; x<startX+width; x++) {
      if (y === startY || y === startY+height-1 || x === startX || x === startX+width-1) {
        if (!(x === doorX && y === doorY)) {
          map[y][x] = 1;
        }
      }
    }
  }
}

// Create a few "rooms" for different sections
addRoom(5, 5, 10, 8, 10, 12); // Experience Room
addRoom(22, 4, 12, 10, 28, 13); // Education Room
addRoom(15, 18, 12, 8, 20, 18); // Contact Room

// Entities
const player = {
  x: 20,
  y: 15,
  emoji: '👦',
  color: '#38bdf8'
};

const camera = {
  x: 0,
  y: 0
};

const npcs = [
  {
    x: 8, y: 8,
    emoji: '💼',
    name: 'Experience Guide',
    dialogues: [
      "Welcome to the Experience wing!",
      "Navya is a passionate developer who loves building robust applications.",
      "She has hands-on experience developing web applications, APIs, and AI integrations.",
      "Her work involves collaborating with cross-functional teams to deliver high-quality software."
    ]
  },
  {
    x: 28, y: 8,
    emoji: '🎓',
    name: 'Professor Education',
    dialogues: [
      "Ah, a visitor to the Academy!",
      "Navya holds a solid academic foundation in Computer Science.",
      "She focuses on Data Structures, Algorithms, and Modern Web Architectures.",
      "Constantly learning, she stays updated with the latest in tech!"
    ]
  },
  {
    x: 20, y: 22,
    emoji: '✉️',
    name: 'Contact Courier',
    dialogues: [
      "Looking to hire or collaborate?",
      "You can find Navya's open-source projects on GitHub.",
      "Here is the link: <a href='https://github.com/Navya' target='_blank'>github.com/Navya</a>",
      "Feel free to connect on LinkedIn as well!"
    ]
  }
];

// Collectibles
const collectibles = [
  { x: 3, y: 3, name: 'React.js', emoji: '⚛️', collected: false },
  { x: 35, y: 3, name: 'Node.js', emoji: '🟢', collected: false },
  { x: 10, y: 26, name: 'Python', emoji: '🐍', collected: false },
  { x: 30, y: 26, name: 'TypeScript', emoji: '📘', collected: false },
  { x: 20, y: 2, name: 'Git', emoji: '🐙', collected: false },
];

// Input handling
const keys = {};
window.addEventListener('keydown', (e) => {
  keys[e.key] = true;
  if (state === 'PLAY') {
    handlePlayerMovement(e.key);
  } else if (state === 'DIALOGUE' && e.key === ' ') {
    advanceDialogue();
  }
});
window.addEventListener('keyup', (e) => {
  keys[e.key] = false;
});

// Mobile Controls
const bindTouch = (id, key) => {
  const el = document.getElementById(id);
  if(!el) return;
  el.addEventListener('touchstart', (e) => { e.preventDefault(); keys[key] = true; handlePlayerMovement(key); });
  el.addEventListener('touchend', (e) => { e.preventDefault(); keys[key] = false; });
  el.addEventListener('mousedown', (e) => { e.preventDefault(); keys[key] = true; handlePlayerMovement(key); });
  el.addEventListener('mouseup', (e) => { e.preventDefault(); keys[key] = false; });
}

bindTouch('btn-up', 'ArrowUp');
bindTouch('btn-down', 'ArrowDown');
bindTouch('btn-left', 'ArrowLeft');
bindTouch('btn-right', 'ArrowRight');

const btnAction = document.getElementById('btn-action');
if(btnAction) {
  btnAction.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (state === 'PLAY') checkForInteraction();
    else if (state === 'DIALOGUE') advanceDialogue();
  });
  btnAction.addEventListener('mousedown', (e) => {
    e.preventDefault();
    if (state === 'PLAY') checkForInteraction();
    else if (state === 'DIALOGUE') advanceDialogue();
  });
}

startBtn.addEventListener('click', () => {
  instructions.classList.add('hidden');
  state = 'PLAY';
});

function handlePlayerMovement(key) {
  let dx = 0;
  let dy = 0;
  
  if (key === 'ArrowUp' || key === 'w' || key === 'W') dy = -1;
  if (key === 'ArrowDown' || key === 's' || key === 'S') dy = 1;
  if (key === 'ArrowLeft' || key === 'a' || key === 'A') dx = -1;
  if (key === 'ArrowRight' || key === 'd' || key === 'D') dx = 1;
  
  if (key === ' ') {
    checkForInteraction();
    return;
  }
  
  if (dx !== 0 || dy !== 0) {
    const newX = player.x + dx;
    const newY = player.y + dy;
    
    // Check bounds & walls
    if (newX >= 0 && newX < COLS && newY >= 0 && newY < ROWS) {
      if (map[newY][newX] === 0) {
        // Check NPC collision
        const npc = npcs.find(n => n.x === newX && n.y === newY);
        if (!npc) {
          player.x = newX;
          player.y = newY;
          checkCollectibles();
          updateCamera();
        }
      }
    }
  }
}

function checkCollectibles() {
  const item = collectibles.find(c => c.x === player.x && c.y === player.y && !c.collected);
  if (item) {
    item.collected = true;
    skillsCollected++;
    scoreEl.textContent = `Skills: ${skillsCollected}/${totalSkills}`;
    
    // Mini dialogue
    state = 'DIALOGUE';
    currentDialogue = {
      name: "Item Found!",
      dialogues: [`You collected the ${item.name} skill! ${item.emoji}`]
    };
    dialogueIndex = 0;
    
    dialogueName.textContent = currentDialogue.name;
    dialogueText.innerHTML = currentDialogue.dialogues[dialogueIndex]; // Using innerHTML for a-tags
    dialogueBox.classList.remove('hidden');
  }
}

function updateCamera() {
  // Center camera on player
  camera.x = player.x * TILE_SIZE - (canvas.width / 2) + (TILE_SIZE / 2);
  camera.y = player.y * TILE_SIZE - (canvas.height / 2) + (TILE_SIZE / 2);
  
  // Clamp camera to map bounds
  camera.x = Math.max(0, Math.min(camera.x, COLS * TILE_SIZE - canvas.width));
  camera.y = Math.max(0, Math.min(camera.y, ROWS * TILE_SIZE - canvas.height));
}

function checkForInteraction() {
  const adjacentTiles = [
    {x: player.x, y: player.y - 1},
    {x: player.x, y: player.y + 1},
    {x: player.x - 1, y: player.y},
    {x: player.x + 1, y: player.y},
  ];
  
  for (let tile of adjacentTiles) {
    const npc = npcs.find(n => n.x === tile.x && n.y === tile.y);
    if (npc) {
      startDialogue(npc);
      break;
    }
  }
}

function startDialogue(npc) {
  state = 'DIALOGUE';
  currentDialogue = npc;
  dialogueIndex = 0;
  
  dialogueName.textContent = npc.name;
  dialogueText.innerHTML = npc.dialogues[dialogueIndex];
  dialogueBox.classList.remove('hidden');
}

function advanceDialogue() {
  dialogueIndex++;
  if (dialogueIndex < currentDialogue.dialogues.length) {
    dialogueText.innerHTML = currentDialogue.dialogues[dialogueIndex];
  } else {
    // End dialogue
    state = 'PLAY';
    dialogueBox.classList.add('hidden');
    currentDialogue = null;
  }
}

function drawMap() {
  const startCol = Math.floor(camera.x / TILE_SIZE);
  const endCol = startCol + (canvas.width / TILE_SIZE) + 1;
  const startRow = Math.floor(camera.y / TILE_SIZE);
  const endRow = startRow + (canvas.height / TILE_SIZE) + 1;
  
  for (let y = startRow; y < endRow; y++) {
    for (let x = startCol; x < endCol; x++) {
      if (y >= 0 && y < ROWS && x >= 0 && x < COLS) {
        const drawX = x * TILE_SIZE - camera.x;
        const drawY = y * TILE_SIZE - camera.y;
        
        if (map[y][x] === 1) {
          // Wall
          ctx.fillStyle = '#0f172a'; 
          ctx.fillRect(drawX, drawY, TILE_SIZE, TILE_SIZE);
          
          // Wall detail (brick-like)
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(drawX + 2, drawY + 2, TILE_SIZE - 4, TILE_SIZE - 4);
          ctx.fillStyle = '#334155';
          ctx.fillRect(drawX + 4, drawY + 4, TILE_SIZE - 16, TILE_SIZE - 16);
        } else {
          // Floor
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(drawX, drawY, TILE_SIZE, TILE_SIZE);
          
          // Floor dots
          ctx.fillStyle = '#334155';
          ctx.fillRect(drawX + 14, drawY + 14, 4, 4);
        }
      }
    }
  }
}

function drawEntity(x, y, emoji, color, isBouncing = false) {
  const drawX = x * TILE_SIZE - camera.x;
  const drawY = y * TILE_SIZE - camera.y;
  
  // Skip if off-screen
  if (drawX < -TILE_SIZE || drawX > canvas.width || drawY < -TILE_SIZE || drawY > canvas.height) return;
  
  let yOffset = 0;
  if (isBouncing) {
    yOffset = Math.sin(Date.now() / 200) * 3;
  }
  
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(drawX + 16, drawY + 28, 10, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Background circle
  if (color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(drawX + 16, drawY + 16 + yOffset, 12, 0, Math.PI*2);
    ctx.fill();
  }
  
  // Emojis
  ctx.font = '20px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, drawX + 16, drawY + 16 + yOffset);
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  drawMap();
  
  // Draw Collectibles
  for (let c of collectibles) {
    if (!c.collected) {
      drawEntity(c.x, c.y, c.emoji, 'rgba(255, 255, 255, 0.1)', true);
    }
  }
  
  // Draw NPCs
  for (let npc of npcs) {
    drawEntity(npc.x, npc.y, npc.emoji, '#fbbf24', true);
  }
  
  // Draw Player
  drawEntity(player.x, player.y, player.emoji, player.color, false);
}

function gameLoop() {
  draw();
  requestAnimationFrame(gameLoop);
}

// Initial setup
updateCamera();
gameLoop();
