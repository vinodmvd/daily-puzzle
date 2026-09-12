// ---- Color Link -----------------------------------------------------
// Flow-Free-style puzzle: connect matching colored dots by dragging
// through adjacent cells, without crossing another color's path, until
// every cell on the board is filled.

const CL_LEVELS = [
  { id: 1, label: "Easy", size: 5, colors: 4 },
  { id: 2, label: "Medium", size: 7, colors: 6 },
  { id: 3, label: "Hard", size: 9, colors: 8 },
];

const CL_PALETTE = [
  "#2F6F62", // teal
  "#C9A227", // mustard
  "#C4463B", // coral red
  "#3B6EA5", // blue
  "#7A5C9E", // purple
  "#B15A82", // magenta
  "#5B8C3A", // green
  "#C77B3A", // burnt orange
];

// Coins earned scale down the longer a level takes: full "max" coins if
// solved almost instantly, decaying down to "min" coins by "par" seconds.
const CL_COIN_CONFIG = {
  1: { max: 30, min: 5, par: 90 },
  2: { max: 60, min: 10, par: 240 },
  3: { max: 100, min: 15, par: 480 },
};

const ColorLinkGame = (() => {
  let currentLevelId = 1;
  // per-level in-memory state, keyed by level id
  const state = {};
  let timerIntervalId = null;

  function idx(r, c, size) { return r * size + c; }
  function rc(i, size) { return [Math.floor(i / size), i % size]; }
  function isAdjacent(a, b, size) {
    const [r1, c1] = rc(a, size);
    const [r2, c2] = rc(b, size);
    return Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1;
  }

  function formatTime(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const mm = Math.floor(totalSeconds / 60);
    const ss = totalSeconds % 60;
    return `${mm}:${String(ss).padStart(2, "0")}`;
  }

  function bestTimeKey(levelId) { return `dp_besttime_colorlink_${levelId}`; }

  function getBestTime(levelId) {
    const raw = localStorage.getItem(bestTimeKey(levelId));
    return raw ? parseInt(raw, 10) : null;
  }

  // Returns true if this run set a new record.
  function recordBestTimeIfBetter(levelId, elapsedMs) {
    const current = getBestTime(levelId);
    if (current === null || elapsedMs < current) {
      localStorage.setItem(bestTimeKey(levelId), String(Math.round(elapsedMs)));
      return true;
    }
    return false;
  }

  function computeCoins(levelId, elapsedMs) {
    const cfg = CL_COIN_CONFIG[levelId];
    const elapsedSec = elapsedMs / 1000;
    const fraction = Math.max(0, Math.min(1, 1 - elapsedSec / cfg.par));
    return Math.round(cfg.min + fraction * (cfg.max - cfg.min));
  }

  // ---- deterministic Hamiltonian path generation ----
  function tryGeneratePath(size, rng) {
    const total = size * size;
    const visited = new Array(total).fill(false);
    const startR = Math.floor(rng() * size);
    const startC = Math.floor(rng() * size);
    const start = idx(startR, startC, size);
    const path = [start];
    visited[start] = true;

    function rawNeighbors(cell) {
      const [r, c] = rc(cell, size);
      const list = [];
      if (r > 0) list.push(idx(r - 1, c, size));
      if (r < size - 1) list.push(idx(r + 1, c, size));
      if (c > 0) list.push(idx(r, c - 1, size));
      if (c < size - 1) list.push(idx(r, c + 1, size));
      return list;
    }

    // Warnsdorff's rule: prefer moving into the cell with the FEWEST
    // remaining onward options, which avoids stranding isolated regions
    // and makes full-grid Hamiltonian paths generate reliably even on
    // 9x9 boards. Candidates are a stack (popped from the end), so the
    // lowest-degree option is sorted to the end.
    function neighborsOf(cell) {
      const list = rawNeighbors(cell).filter((n) => !visited[n]);
      const withDegree = list.map((n) => ({
        n,
        deg: rawNeighbors(n).filter((m) => !visited[m]).length,
      }));
      for (let i = withDegree.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [withDegree[i], withDegree[j]] = [withDegree[j], withDegree[i]];
      }
      withDegree.sort((a, b) => b.deg - a.deg);
      return withDegree.map((x) => x.n);
    }

    const candidateStack = [neighborsOf(start)];
    let iterations = 0;
    const MAX_ITER = 400000;

    while (path.length < total) {
      iterations++;
      if (iterations > MAX_ITER) return null;

      const candidates = candidateStack[candidateStack.length - 1];
      let next = -1;
      while (candidates.length) {
        const c = candidates.pop();
        if (!visited[c]) { next = c; break; }
      }

      if (next === -1) {
        // dead end: backtrack
        if (path.length === 1) return null;
        candidateStack.pop();
        const removed = path.pop();
        visited[removed] = false;
        continue;
      }

      visited[next] = true;
      path.push(next);
      candidateStack.push(neighborsOf(next));
    }

    return path;
  }

  function generatePath(size, rng) {
    for (let attempt = 0; attempt < 25; attempt++) {
      const p = tryGeneratePath(size, rng);
      if (p) return p;
    }
    return null; // extremely unlikely
  }

  function generatePuzzle(levelId) {
    const level = CL_LEVELS.find((l) => l.id === levelId);
    const seed = seedFor(`colorlink-${levelId}`);
    const rng = seededRandom(seed);
    const size = level.size;
    const numColors = level.colors;
    const total = size * size;

    let path = generatePath(size, rng);
    if (!path) {
      // fallback: simple boustrophedon (guaranteed Hamiltonian path)
      path = [];
      for (let r = 0; r < size; r++) {
        if (r % 2 === 0) for (let c = 0; c < size; c++) path.push(idx(r, c, size));
        else for (let c = size - 1; c >= 0; c--) path.push(idx(r, c, size));
      }
    }

    // split into numColors contiguous segments, each >= 2 cells
    const minLen = 2;
    const sizes = new Array(numColors).fill(minLen);
    let remaining = total - minLen * numColors;
    while (remaining > 0) {
      const i = Math.floor(rng() * numColors);
      sizes[i]++;
      remaining--;
    }

    const colors = [];
    let cursor = 0;
    for (let c = 0; c < numColors; c++) {
      const segment = path.slice(cursor, cursor + sizes[c]);
      cursor += sizes[c];
      colors.push({
        id: c,
        color: CL_PALETTE[c % CL_PALETTE.length],
        dotA: segment[0],
        dotB: segment[segment.length - 1],
      });
    }

    return { size, colors, total };
  }

  function getState(levelId) {
    if (!state[levelId]) {
      const puzzle = generatePuzzle(levelId);
      const solved = isCompletedToday(`colorlink-${levelId}`);
      state[levelId] = {
        puzzle,
        // cellOwner[i] = colorId or null
        cellOwner: new Array(puzzle.total).fill(null),
        // paths[colorId] = ordered array of cell indices from dotA
        paths: puzzle.colors.map(() => []),
        dragging: null, // colorId currently being dragged
        solved,
        elapsedMs: 0, // accumulated time while not actively running
        runStart: null, // timestamp when current running segment started
        lastCoinsEarned: null,
        justSetRecord: false,
      };
    }
    return state[levelId];
  }

  function getElapsedMs(st) {
    return st.elapsedMs + (st.runStart ? Date.now() - st.runStart : 0);
  }

  function startTimerFor(levelId) {
    stopTimer();
    const st = getState(levelId);
    if (st.solved) { updateTimerDisplay(); return; }
    if (!st.runStart) st.runStart = Date.now();
    timerIntervalId = setInterval(updateTimerDisplay, 1000);
    updateTimerDisplay();
  }

  function stopTimer() {
    if (timerIntervalId) {
      clearInterval(timerIntervalId);
      timerIntervalId = null;
    }
    const st = state[currentLevelId];
    if (st && st.runStart) {
      st.elapsedMs += Date.now() - st.runStart;
      st.runStart = null;
    }
  }

  function updateTimerDisplay() {
    const st = state[currentLevelId];
    if (!st) return;
    const timerEl = document.getElementById("clTimer");
    const bestEl = document.getElementById("clBest");
    if (timerEl) timerEl.textContent = formatTime(getElapsedMs(st));
    if (bestEl) {
      const best = getBestTime(currentLevelId);
      bestEl.textContent = best === null ? "\u2013" : formatTime(best);
    }
  }

  function cellDotColor(puzzle, cellIndex) {
    for (const c of puzzle.colors) {
      if (c.dotA === cellIndex || c.dotB === cellIndex) return c;
    }
    return null;
  }

  function rebuildCellOwners(st) {
    const owners = new Array(st.puzzle.total).fill(null);
    st.paths.forEach((path, colorId) => {
      path.forEach((cell) => { owners[cell] = colorId; });
    });
    st.cellOwner = owners;
  }

  function checkWin(st) {
    const allFilled = st.cellOwner.every((v) => v !== null);
    if (!allFilled) return false;
    return st.puzzle.colors.every((c, colorId) => {
      const path = st.paths[colorId];
      if (path.length < 2) return false;
      const a = path[0], b = path[path.length - 1];
      return (a === c.dotA && b === c.dotB) || (a === c.dotB && b === c.dotA);
    });
  }

  // ---- rendering ----
  function renderTabs() {
    const tabs = document.getElementById("clLevelTabs");
    tabs.innerHTML = "";
    CL_LEVELS.forEach((level) => {
      const btn = document.createElement("button");
      btn.className = "levelTab" + (level.id === currentLevelId ? " active" : "");
      const done = isCompletedToday(`colorlink-${level.id}`);
      btn.textContent = level.label + (done ? " \u2713" : "");
      btn.addEventListener("click", () => {
        if (level.id === currentLevelId) return;
        stopTimer();
        currentLevelId = level.id;
        render();
        startTimerFor(currentLevelId);
      });
      tabs.appendChild(btn);
    });
  }

  function render() {
    renderTabs();
    const st = getState(currentLevelId);
    const grid = document.getElementById("clGrid");
    const winBanner = document.getElementById("clWinBanner");
    grid.style.setProperty("--cl-size", st.puzzle.size);
    grid.innerHTML = "";

    for (let i = 0; i < st.puzzle.total; i++) {
      const cell = document.createElement("div");
      cell.className = "clCell";
      cell.dataset.index = i;
      const ownerColorId = st.cellOwner[i];
      const dot = cellDotColor(st.puzzle, i);

      if (ownerColorId !== null) {
        cell.style.background = st.puzzle.colors[ownerColorId].color;
      }
      if (dot) {
        const marker = document.createElement("div");
        marker.className = "clDot";
        marker.style.background = dot.color;
        marker.textContent = String.fromCharCode(65 + dot.id); // A, B, C, ...
        cell.appendChild(marker);
      }
      grid.appendChild(cell);
    }

    if (st.solved) {
      const record = st.justSetRecord
        ? '<div class="clWinRecord">New best time</div>'
        : "";
      winBanner.innerHTML = `
        <div class="clWinTitle">Solved in ${formatTime(getElapsedMs(st))}</div>
        <div class="clWinDetail">+${st.lastCoinsEarned || 0} coins</div>
        ${record}
      `;
      st.justSetRecord = false;
    }
    winBanner.hidden = !st.solved;
    updateTimerDisplay();
  }

  // ---- interaction ----
  function cellIndexFromPoint(x, y) {
    const el = document.elementFromPoint(x, y);
    if (!el || !el.classList.contains("clCell")) return null;
    return parseInt(el.dataset.index, 10);
  }

  function handleStart(cellIndex) {
    const st = getState(currentLevelId);
    if (st.solved) return;

    const dot = cellDotColor(st.puzzle, cellIndex);
    const existingOwner = st.cellOwner[cellIndex];

    if (dot) {
      // start fresh from this color's dot, clearing any prior path
      st.paths[dot.id] = [cellIndex];
      st.dragging = dot.id;
    } else if (existingOwner !== null) {
      // touching a cell within an existing path: truncate to that point
      const path = st.paths[existingOwner];
      const pos = path.indexOf(cellIndex);
      if (pos === -1) return;
      st.paths[existingOwner] = path.slice(0, pos + 1);
      st.dragging = existingOwner;
    } else {
      return;
    }
    rebuildCellOwners(st);
    render();
  }

  function handleMove(cellIndex) {
    const st = getState(currentLevelId);
    if (st.dragging === null || cellIndex === null || st.solved) return;

    const colorId = st.dragging;
    const path = st.paths[colorId];
    const last = path[path.length - 1];
    if (cellIndex === last) return;
    if (!isAdjacent(last, cellIndex, st.puzzle.size)) return;

    // step back (undo)
    if (path.length >= 2 && cellIndex === path[path.length - 2]) {
      path.pop();
      rebuildCellOwners(st);
      render();
      return;
    }

    // can't step onto a cell already used earlier in this same path
    if (path.includes(cellIndex)) return;

    const owner = st.cellOwner[cellIndex];
    const targetDot = cellDotColor(st.puzzle, cellIndex);

    if (owner !== null) return; // occupied by another color
    if (targetDot && targetDot.id !== colorId) return; // another color's dot

    const myColor = st.puzzle.colors[colorId];
    const startCell = path[0];

    if (targetDot && targetDot.id === colorId && cellIndex !== startCell) {
      // reached own matching dot: complete the path, stop dragging
      path.push(cellIndex);
      st.dragging = null;
    } else if (!targetDot) {
      path.push(cellIndex);
    } else {
      return;
    }

    rebuildCellOwners(st);
    if (checkWin(st)) {
      stopTimer();
      const elapsedMs = getElapsedMs(st);
      const coinsEarned = computeCoins(currentLevelId, elapsedMs);
      st.solved = true;
      st.dragging = null;
      st.lastCoinsEarned = coinsEarned;
      st.justSetRecord = recordBestTimeIfBetter(currentLevelId, elapsedMs);
      addCoins(coinsEarned);
      markCompletedToday(`colorlink-${currentLevelId}`);
      if (typeof refreshHomeStatuses === "function") refreshHomeStatuses();
    }
    render();
  }

  function handleEnd() {
    const st = getState(currentLevelId);
    st.dragging = null;
  }

  function attachEvents() {
    const grid = document.getElementById("clGrid");

    grid.addEventListener("pointerdown", (e) => {
      const cellIndex = cellIndexFromPoint(e.clientX, e.clientY);
      if (cellIndex !== null) handleStart(cellIndex);
    });

    grid.addEventListener("pointermove", (e) => {
      if (e.buttons !== 1 && e.pointerType !== "touch") return;
      const cellIndex = cellIndexFromPoint(e.clientX, e.clientY);
      handleMove(cellIndex);
    });

    window.addEventListener("pointerup", handleEnd);
    window.addEventListener("pointercancel", handleEnd);

    grid.addEventListener("touchmove", (e) => { e.preventDefault(); }, { passive: false });

    document.getElementById("clClearBtn").addEventListener("click", () => {
      const st = getState(currentLevelId);
      if (st.solved) return;
      st.paths = st.puzzle.colors.map(() => []);
      st.dragging = null;
      rebuildCellOwners(st);
      render();
    });
  }

  function mount() {
    if (!mount._attached) {
      attachEvents();
      mount._attached = true;
    }
    render();
    startTimerFor(currentLevelId);
  }

  function pause() {
    stopTimer();
  }

  function isFullyCompletedToday() {
    return CL_LEVELS.every((l) => isCompletedToday(`colorlink-${l.id}`));
  }

  return { mount, pause, isFullyCompletedToday };
})();
