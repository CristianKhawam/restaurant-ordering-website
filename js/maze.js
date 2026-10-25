/* =========================================================
   maze.js — "Play & Save" maze game
   - The user picks a size (5–15); the form is validated
   - A random maze is generated with the "recursive backtracker"
     (depth-first search) algorithm. Because it connects every
     cell, there is ALWAYS a path from the start to the exit.
   - The player moves with arrow keys / WASD, clicks or the pad
   - Each level (MAZE_LEVELS in common.js) limits moves and time;
     the limits come from the length of the shortest path
   - Reaching the exit in time saves that level's voucher code
   ========================================================= */

const MIN_MAZE_SIZE = MAZE_LEVELS[0].minSize;
const MAX_MAZE_SIZE = MAZE_LEVELS[MAZE_LEVELS.length - 1].maxSize;
const TIME_BONUS_SECONDS = 5; // a few seconds to look at the maze first

// For each direction: how the row/column change, which wall blocks
// the move, and the matching wall on the neighbouring cell
const DIRECTIONS = {
  up: { rowChange: -1, colChange: 0, wall: "top", oppositeWall: "bottom" },
  down: { rowChange: 1, colChange: 0, wall: "bottom", oppositeWall: "top" },
  left: { rowChange: 0, colChange: -1, wall: "left", oppositeWall: "right" },
  right: { rowChange: 0, colChange: 1, wall: "right", oppositeWall: "left" },
};

const KEY_TO_DIRECTION = {
  ArrowUp: "up", w: "up", W: "up",
  ArrowDown: "down", s: "down", S: "down",
  ArrowLeft: "left", a: "left", A: "left",
  ArrowRight: "right", d: "right", D: "right",
};

const mazeForm = document.getElementById("maze-form");
const sizeInput = document.getElementById("maze-size");
const sizeSelect = document.getElementById("maze-level");
const sizeError = document.getElementById("maze-size-error");
const rewardElement = document.getElementById("maze-reward");
const moveLimitElement = document.getElementById("move-limit");
const timeLeftElement = document.getElementById("time-left");
const gameMessage = document.getElementById("game-message");
const mazeElement = document.getElementById("maze");
const mazePlaceholder = document.getElementById("maze-placeholder");
const mazePad = document.getElementById("maze-pad");
const winPanel = document.getElementById("win-panel");
const moveCountElement = document.getElementById("move-count");
const sizeLabelElement = document.getElementById("size-label");

// Game state
let mazeSize = 0;
let mazeCells = [];      // mazeCells[row][col] = { top, right, bottom, left } (true = wall)
let cellElements = [];   // the matching <div> for each cell
let playerRow = 0;
let playerCol = 0;
let moveCount = 0;
let moveLimit = 0;
let secondsLeft = 0;
let timerId = null;
let currentLevel = null;
let isGameActive = false;

/* ---------- Validation ---------- */
function validateMazeSize(rawValue) {
  const trimmedValue = String(rawValue).trim();

  if (!/^\d+$/.test(trimmedValue)) {
    return { isValid: false, message: `Enter a whole number from ${MIN_MAZE_SIZE} to ${MAX_MAZE_SIZE}.` };
  }

  const size = Number(trimmedValue);
  if (size < MIN_MAZE_SIZE || size > MAX_MAZE_SIZE) {
    return { isValid: false, message: `Size must be between ${MIN_MAZE_SIZE} and ${MAX_MAZE_SIZE}.` };
  }

  return { isValid: true, size, message: "" };
}

/* ---------- Maze generation ---------- */
function createGridWithAllWalls(size) {
  const grid = [];
  for (let row = 0; row < size; row++) {
    const cellsInRow = [];
    for (let col = 0; col < size; col++) {
      cellsInRow.push({ top: true, right: true, bottom: true, left: true });
    }
    grid.push(cellsInRow);
  }
  return grid;
}

function isInsideMaze(row, col, size) {
  return row >= 0 && row < size && col >= 0 && col < size;
}

/* Recursive backtracker, written with a stack instead of recursion:
   1. Start at the top-left cell and mark it visited.
   2. Look at the cell on top of the stack. If it has unvisited
      neighbours, pick one at random, knock down the wall between
      them, mark it visited and push it on the stack.
   3. If it has no unvisited neighbours, pop it (go back).
   4. Stop when the stack is empty — every cell has been reached. */
function generateMaze(size) {
  const grid = createGridWithAllWalls(size);
  const visited = grid.map((cellsInRow) => cellsInRow.map(() => false));
  const stack = [{ row: 0, col: 0 }];
  visited[0][0] = true;

  while (stack.length > 0) {
    const current = stack[stack.length - 1];

    const unvisitedNeighbours = Object.values(DIRECTIONS)
      .map((direction) => ({
        row: current.row + direction.rowChange,
        col: current.col + direction.colChange,
        direction,
      }))
      .filter((neighbour) => isInsideMaze(neighbour.row, neighbour.col, size) && !visited[neighbour.row][neighbour.col]);

    if (unvisitedNeighbours.length === 0) {
      stack.pop();
      continue;
    }

    const next = unvisitedNeighbours[Math.floor(Math.random() * unvisitedNeighbours.length)];
    grid[current.row][current.col][next.direction.wall] = false;
    grid[next.row][next.col][next.direction.oppositeWall] = false;
    visited[next.row][next.col] = true;
    stack.push({ row: next.row, col: next.col });
  }

  return grid;
}

/* Breadth-first search from the start: explores the maze one step
   at a time, so the first time it reaches the exit is the shortest
   route. Returns the number of moves on that route. */
function findShortestPathLength(grid) {
  const size = grid.length;
  const steps = grid.map((cellsInRow) => cellsInRow.map(() => -1)); // -1 = not reached yet
  const queue = [{ row: 0, col: 0 }];
  steps[0][0] = 0;

  while (queue.length > 0) {
    const { row, col } = queue.shift();
    if (row === size - 1 && col === size - 1) return steps[row][col];

    Object.values(DIRECTIONS).forEach((direction) => {
      const nextRow = row + direction.rowChange;
      const nextCol = col + direction.colChange;
      if (!grid[row][col][direction.wall] && steps[nextRow][nextCol] === -1) {
        steps[nextRow][nextCol] = steps[row][col] + 1;
        queue.push({ row: nextRow, col: nextCol });
      }
    });
  }

  return -1; // unreachable: the backtracker always connects every cell
}

/* ---------- Rendering ---------- */
function renderMaze() {
  mazeElement.innerHTML = "";
  mazeElement.style.setProperty("--maze-size", mazeSize);
  mazeElement.classList.remove("is-won");
  cellElements = [];

  for (let row = 0; row < mazeSize; row++) {
    const elementsInRow = [];
    for (let col = 0; col < mazeSize; col++) {
      const cell = mazeCells[row][col];
      const cellElement = document.createElement("div");
      cellElement.className = "maze-cell";
      cellElement.dataset.row = row;
      cellElement.dataset.col = col;

      // Add a CSS class for every wall that is still standing
      ["top", "right", "bottom", "left"].forEach((side) => {
        if (cell[side]) cellElement.classList.add(`wall-${side}`);
      });

      if (row === mazeSize - 1 && col === mazeSize - 1) {
        cellElement.classList.add("is-exit");
        cellElement.setAttribute("aria-label", "Exit");
      }

      mazeElement.append(cellElement);
      elementsInRow.push(cellElement);
    }
    cellElements.push(elementsInRow);
  }

  mazePlaceholder.hidden = true;
  mazeElement.hidden = false;
  mazePad.hidden = false;
  updatePlayerPosition(0, 0);
}

function updatePlayerPosition(newRow, newCol) {
  cellElements[playerRow][playerCol].classList.remove("has-player");
  playerRow = newRow;
  playerCol = newCol;

  const playerCell = cellElements[playerRow][playerCol];
  playerCell.classList.add("has-player", "is-visited");
}

/* ---------- Movement ---------- */
function tryMove(directionName) {
  if (!isGameActive) return;

  const direction = DIRECTIONS[directionName];
  // A wall on this side of the current cell blocks the move
  if (mazeCells[playerRow][playerCol][direction.wall]) return;

  updatePlayerPosition(playerRow + direction.rowChange, playerCol + direction.colChange);
  moveCount++;
  moveCountElement.textContent = moveCount;

  if (playerRow === mazeSize - 1 && playerCol === mazeSize - 1) {
    winGame();
  } else if (moveCount >= moveLimit) {
    loseGame("Out of moves!");
  }
}

// Clicking a cell moves the player only if it is a direct neighbour
function handleCellClick(event) {
  const cellElement = event.target.closest(".maze-cell");
  if (!cellElement) return;

  const rowDifference = Number(cellElement.dataset.row) - playerRow;
  const colDifference = Number(cellElement.dataset.col) - playerCol;

  const directionName = Object.keys(DIRECTIONS).find(
    (name) => DIRECTIONS[name].rowChange === rowDifference && DIRECTIONS[name].colChange === colDifference
  );
  if (directionName) {
    tryMove(directionName);
  }
}

function handleKeyDown(event) {
  // Don't steal keys while the user is typing in the form
  if (event.target instanceof Element && event.target.matches("input, textarea, select")) return;

  const directionName = KEY_TO_DIRECTION[event.key];
  if (!directionName || !isGameActive) return;

  event.preventDefault(); // stop the arrow keys from scrolling the page
  tryMove(directionName);
}

/* ---------- Timer ---------- */
function tickTimer() {
  secondsLeft--;
  timeLeftElement.textContent = `${secondsLeft}s`;
  if (secondsLeft <= 0) {
    loseGame("Time's up!");
  }
}

function stopTimer() {
  clearInterval(timerId);
  timerId = null;
}

/* ---------- Winning and losing ---------- */
function winGame() {
  isGameActive = false;
  stopTimer();
  mazeElement.classList.add("is-won");
  gameMessage.textContent = "";

  // Keep only the best reward, so an easy win never replaces a bigger discount
  const savedReward = loadFromStorage(STORAGE_KEYS.mazeVoucher, null);
  if (!savedReward || !(savedReward.percent >= currentLevel.percent)) {
    saveToStorage(STORAGE_KEYS.mazeVoucher, {
      code: currentLevel.code,
      percent: currentLevel.percent,
      wonAt: new Date().toISOString(),
      mazeSize,
      moves: moveCount,
    });
  }

  document.getElementById("win-text").textContent = `${currentLevel.name} level cleared! Your reward code (${currentLevel.percent}% off):`;
  document.getElementById("win-code").textContent = currentLevel.code;
  winPanel.hidden = false;
  winPanel.scrollIntoView({ behavior: "smooth", block: "center" });
}

function loseGame(reason) {
  isGameActive = false;
  stopTimer();
  mazeElement.classList.add("is-lost");
  gameMessage.textContent = `${reason} Generate a new maze to try again.`;
}

/* ---------- Form ---------- */
function showReward(size) {
  const level = getMazeLevel(size);
  rewardElement.textContent = level ? `Reward: ${level.percent}% off (${level.name} level)` : "";
}

// Fill the select with one option per size, labelled with its level
function buildSizeOptions() {
  const placeholder = new Option("Choose a size…", "");
  placeholder.disabled = true;
  sizeSelect.append(placeholder);

  for (let size = MIN_MAZE_SIZE; size <= MAX_MAZE_SIZE; size++) {
    const level = getMazeLevel(size);
    sizeSelect.append(new Option(`${size} × ${size} — ${level.name} (${level.percent}% off)`, size));
  }
}

// Typing a valid size updates the select; anything else shows the placeholder
function syncSelectWithInput() {
  const result = validateMazeSize(sizeInput.value);
  sizeSelect.value = result.isValid ? String(result.size) : "";
  showReward(result.size);
}

function startNewGame(event) {
  event.preventDefault();

  const result = validateMazeSize(sizeInput.value);
  sizeInput.classList.toggle("is-invalid", !result.isValid);
  sizeInput.setAttribute("aria-invalid", !result.isValid);
  sizeError.textContent = result.message;

  // Never generate a maze with an invalid size
  if (!result.isValid) {
    sizeInput.focus();
    return;
  }

  stopTimer();
  mazeSize = result.size;
  currentLevel = getMazeLevel(mazeSize);
  mazeCells = generateMaze(mazeSize);

  // Limits are based on the shortest route, so every maze is fair
  const shortestPath = findShortestPathLength(mazeCells);
  moveLimit = Math.ceil(shortestPath * currentLevel.moveFactor);
  secondsLeft = Math.ceil(TIME_BONUS_SECONDS + shortestPath * currentLevel.secondsPerStep);

  playerRow = 0;
  playerCol = 0;
  moveCount = 0;
  moveCountElement.textContent = "0";
  moveLimitElement.textContent = moveLimit;
  timeLeftElement.textContent = `${secondsLeft}s`;
  sizeLabelElement.textContent = `${mazeSize}×${mazeSize} (${currentLevel.name})`;
  gameMessage.textContent = "";
  mazeElement.classList.remove("is-lost");
  winPanel.hidden = true;

  renderMaze();
  isGameActive = true;
  timerId = setInterval(tickTimer, 1000);

  // Move focus off the input so the arrow keys control the game
  mazeElement.setAttribute("tabindex", "-1");
  mazeElement.focus({ preventScroll: true });
}

function initMazePage() {
  buildSizeOptions();
  syncSelectWithInput();

  sizeInput.addEventListener("input", syncSelectWithInput);
  sizeSelect.addEventListener("change", () => {
    sizeInput.value = sizeSelect.value;
    syncSelectWithInput();
  });

  mazeForm.addEventListener("submit", startNewGame);
  mazeElement.addEventListener("click", handleCellClick);
  document.addEventListener("keydown", handleKeyDown);

  mazePad.addEventListener("click", (event) => {
    const padButton = event.target.closest("button[data-direction]");
    if (padButton) tryMove(padButton.dataset.direction);
  });
}

initMazePage();
