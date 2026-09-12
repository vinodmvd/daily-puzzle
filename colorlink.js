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
  let builtLevelId = null; // which level's DOM cells are currently built
  let cellEls = []; // cached cell DOM elements for the currently-built level

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
    //
    // On top of that, bias toward continuing in the same direction we
    // just arrived from, whenever that option is roughly as safe as the
    // most-constrained alternative. This produces long straight runs
    // with occasional turns — the natural look of a hand-drawn path —
    // instead of a path that zigzags back and forth across two columns.
    function neighborsOf(cell, fromCell) {
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

      if (fromCell !== null && withDegree.length > 1) {
        const [fr, fc] = rc(fromCell, size);
        const [cr, cc] = rc(cell, size);
        const dr = cr - fr, dc = cc - fc;
        const straightIdx = withDegree.findIndex((x) => {
          const [nr, nc] = rc(x.n, size);
          return nr - cr === dr && nc - cc === dc;
        });
        if (straightIdx !== -1) {
          const minDeg = Math.min(...withDegree.map((x) => x.deg));
          if (withDegree[straightIdx].deg <= minDeg + 1) {
            const [item] = withDegree.splice(straightIdx, 1);
            withDegree.push(item); // moves to the end -> tried first
          }
        }
      }

      return withDegree.map((x) => x.n);
    }

    const candidateStack = [neighborsOf(start, null)];
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

      const cameFrom = path[path.length - 1];
      visited[next] = true;
      path.push(next);
      candidateStack.push(neighborsOf(next, cameFrom));
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
        solution: segment,
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
        hintsUsed: 0,
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

  function pathMatchesSolution(path, solution) {
    if (path.length !== solution.length) return false;
    const forward = path.every((cell, i) => cell === solution[i]);
    const backward = path.every((cell, i) => cell === solution[solution.length - 1 - i]);
    return forward || backward;
  }

  // Reveals one color's full correct path at a time (the first color that
  // isn't already correctly solved). Costs a small coin penalty on the
  // eventual win, so hints stay useful without trivializing the puzzle.
  function useHint() {
    const st = getState(currentLevelId);
    if (st.solved) return;

    const target = st.puzzle.colors.find(
      (c) => !pathMatchesSolution(st.paths[c.id], c.solution)
    );
    if (!target) return; // everything already correct, nothing to hint

    const targetCells = new Set(target.solution);

    // If another color's (incorrect) path wandered into a cell that
    // actually belongs to this color's real solution, truncate that
    // color's path right before the conflict so ownership stays consistent.
    st.puzzle.colors.forEach((c) => {
      if (c.id === target.id) return;
      const path = st.paths[c.id];
      const conflictIndex = path.findIndex((cell) => targetCells.has(cell));
      if (conflictIndex !== -1) st.paths[c.id] = path.slice(0, conflictIndex);
    });

    st.paths[target.id] = target.solution.slice();
    st.hintsUsed += 1;

    rebuildCellOwners(st);

    if (checkWin(st)) {
      stopTimer();
      const elapsedMs = getElapsedMs(st);
      const cfg = CL_COIN_CONFIG[currentLevelId];
      const rawCoins = computeCoins(currentLevelId, elapsedMs);
      const coinsEarned = Math.max(cfg.min, rawCoins - st.hintsUsed * 5);
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

  // ---- rendering ----
  function isLevelUnlocked(levelId) {
    const idx = CL_LEVELS.findIndex((l) => l.id === levelId);
    if (idx <= 0) return true;
    return isCompletedToday(`colorlink-${CL_LEVELS[idx - 1].id}`);
  }

  function highestUnlockedLevelId() {
    let unlocked = CL_LEVELS[0].id;
    for (let i = 1; i < CL_LEVELS.length; i++) {
      if (isCompletedToday(`colorlink-${CL_LEVELS[i - 1].id}`)) unlocked = CL_LEVELS[i].id;
      else break;
    }
    return unlocked;
  }

  function renderTabs() {
    const tabs = document.getElementById("clLevelTabs");
    tabs.innerHTML = "";
    CL_LEVELS.forEach((level) => {
      const btn = document.createElement("button");
      const done = isCompletedToday(`colorlink-${level.id}`);
      const locked = !isLevelUnlocked(level.id);
      btn.className = "levelTab"
        + (level.id === currentLevelId ? " active" : "")
        + (locked ? " locked" : "");
      btn.disabled = locked;
      btn.innerHTML = level.label
        + (done ? " \u2713" : "")
        + (locked ? ' <span class="lockIcon">&#128274;</span>' : "");
      if (!locked) {
        btn.addEventListener("click", () => {
          if (level.id === currentLevelId) return;
          stopTimer();
          currentLevelId = level.id;
          render();
          startTimerFor(currentLevelId);
        });
      }
      tabs.appendChild(btn);
    });
  }

  function buildGrid(st) {
    const grid = document.getElementById("clGrid");
    grid.style.setProperty("--cl-size", st.puzzle.size);
    grid.innerHTML = "";
    cellEls = [];

    for (let i = 0; i < st.puzzle.total; i++) {
      const cell = document.createElement("div");
      cell.className = "clCell";
      cell.dataset.index = i;

      const pipe = document.createElement("div");
      pipe.className = "clPipe";
      cell.appendChild(pipe);
      cell.pipeEl = pipe;

      const dot = cellDotColor(st.puzzle, i);
      if (dot) {
        const marker = document.createElement("div");
        marker.className = "clDot";
        marker.style.background = dot.color;
        marker.textContent = String.fromCharCode(65 + dot.id); // A, B, C, ...
        cell.appendChild(marker);
      }

      grid.appendChild(cell);
      cellEls.push(cell);
    }
    builtLevelId = currentLevelId;
  }

  function cellNeighbors(index, size) {
    const [r, c] = rc(index, size);
    return {
      up: r > 0 ? idx(r - 1, c, size) : null,
      down: r < size - 1 ? idx(r + 1, c, size) : null,
      left: c > 0 ? idx(r, c - 1, size) : null,
      right: c < size - 1 ? idx(r, c + 1, size) : null,
    };
  }

  // Renders each filled cell as a rounded "pipe" segment that only rounds
  // off on sides that DON'T continue into a same-color neighbor, and
  // stretches flush against sides that DO — this is what makes the path
  // read as one continuous connected line rather than separate flat
  // squares. Never touches element structure, only styles, so it's safe
  // to call on every drag move.
  function updateGridColors(st) {
    const size = st.puzzle.size;
    const INSET = "13%";
    for (let i = 0; i < st.puzzle.total; i++) {
      const pipe = cellEls[i].pipeEl;
      const ownerColorId = st.cellOwner[i];

      if (ownerColorId === null) {
        pipe.style.opacity = "0";
        continue;
      }

      const color = st.puzzle.colors[ownerColorId].color;
      const n = cellNeighbors(i, size);
      const sameUp = n.up !== null && st.cellOwner[n.up] === ownerColorId;
      const sameDown = n.down !== null && st.cellOwner[n.down] === ownerColorId;
      const sameLeft = n.left !== null && st.cellOwner[n.left] === ownerColorId;
      const sameRight = n.right !== null && st.cellOwner[n.right] === ownerColorId;

      const ROUND = "34%";
      pipe.style.borderTopLeftRadius = (sameUp || sameLeft) ? "0" : ROUND;
      pipe.style.borderTopRightRadius = (sameUp || sameRight) ? "0" : ROUND;
      pipe.style.borderBottomRightRadius = (sameDown || sameRight) ? "0" : ROUND;
      pipe.style.borderBottomLeftRadius = (sameDown || sameLeft) ? "0" : ROUND;

      pipe.style.top = sameUp ? "0" : INSET;
      pipe.style.bottom = sameDown ? "0" : INSET;
      pipe.style.left = sameLeft ? "0" : INSET;
      pipe.style.right = sameRight ? "0" : INSET;

      pipe.style.background = color;
      pipe.style.opacity = "1";
    }
  }

  function render() {
    if (!isLevelUnlocked(currentLevelId)) currentLevelId = highestUnlockedLevelId();
    renderTabs();
    const st = getState(currentLevelId);

    if (builtLevelId !== currentLevelId || cellEls.length !== st.puzzle.total) {
      buildGrid(st);
    }
    updateGridColors(st);

    const winBanner = document.getElementById("clWinBanner");

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
    const cellEl = el && el.closest(".clCell");
    if (!cellEl) return null;
    return parseInt(cellEl.dataset.index, 10);
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
      const cfg = CL_COIN_CONFIG[currentLevelId];
      const rawCoins = computeCoins(currentLevelId, elapsedMs);
      const coinsEarned = Math.max(cfg.min, rawCoins - st.hintsUsed * 5);
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

    document.getElementById("clHintBtn").addEventListener("click", () => {
      useHint();
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
