// ---- Cross Math ---------------------------------------------------------
// Two 3x3 number lattices chained together: lattice A generates normally
// (top-left 2x2 given, bottom-right corner solved by matching its row and
// column equation simultaneously), then lattice B reuses A's corner as
// ITS own top-left "given" anchor and extends diagonally from there. The
// result is one connected, organically-shaped interlocking structure
// (not two separate puzzles) while each lattice individually uses the
// exact same proven-reliable generation technique.

const CM_COIN_CONFIG = { max: 70, min: 12, par: 360 };
const CM_CAP = 99;
const CM_LATTICES = ["a", "b"];
const CM_GIVEN_CELLS = ["0,0", "0,1", "1,0", "1,1"];
// Lattice A's corner (2,2) is reused as lattice B's given anchor, so it
// renders as a fixed/given tile, not a separate editable input — it must
// NOT be counted as something the player still needs to type into.
const CM_BLANK_CELLS_BY_LATTICE = {
  a: ["0,2", "1,2", "2,0", "2,1"],
  b: ["0,2", "1,2", "2,0", "2,1", "2,2"],
};
// where each lattice's local (0,0) sits in the shared combined grid
const CM_OFFSET = { a: { row: 0, col: 0 }, b: { row: 4, col: 4 } };

const CrossMathGame = (() => {
  let lattices = null; // { a: {values, ops}, b: {values, ops} }
  let userValues = null; // "a:0,2" -> string
  let solved = false;
  let elapsedMs = 0;
  let runStart = null;
  let timerIntervalId = null;
  let lastCoinsEarned = 0;
  let justSetRecord = false;
  let hintsUsed = 0;
  let attached = false;

  function candidateOps(a, b) {
    const opts = [];
    if (a + b <= CM_CAP) opts.push({ op: "+", result: a + b });
    if (a * b <= CM_CAP) opts.push({ op: "\u00d7", result: a * b });
    if (a > b) opts.push({ op: "-", result: a - b });
    return opts;
  }

  function shuffle(arr, rng) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // forcedA00, when given, chains this lattice onto a previous one by
  // reusing its value as this lattice's own top-left given cell instead
  // of rolling a fresh random one.
  function tryGenerate(rng, forcedA00) {
    const A00 = forcedA00 !== undefined ? forcedA00 : 1 + Math.floor(rng() * 9);
    const A01 = 1 + Math.floor(rng() * 9);
    const A10 = 1 + Math.floor(rng() * 9);
    const A11 = 1 + Math.floor(rng() * 9);

    const row0Opts = candidateOps(A00, A01); if (!row0Opts.length) return null;
    const row1Opts = candidateOps(A10, A11); if (!row1Opts.length) return null;
    const col0Opts = candidateOps(A00, A10); if (!col0Opts.length) return null;
    const col1Opts = candidateOps(A01, A11); if (!col1Opts.length) return null;

    const row0 = row0Opts[Math.floor(rng() * row0Opts.length)];
    const row1 = row1Opts[Math.floor(rng() * row1Opts.length)];
    const col0 = col0Opts[Math.floor(rng() * col0Opts.length)];
    const col1 = col1Opts[Math.floor(rng() * col1Opts.length)];

    const N02 = row0.result, N12 = row1.result, N20 = col0.result, N21 = col1.result;
    const rowOptions = shuffle(candidateOps(N20, N21), rng);
    const colOptions = shuffle(candidateOps(N02, N12), rng);

    for (const ro of rowOptions) {
      for (const co of colOptions) {
        if (ro.result === co.result) {
          return {
            values: { "0,0": A00, "0,1": A01, "1,0": A10, "1,1": A11, "0,2": N02, "1,2": N12, "2,0": N20, "2,1": N21, "2,2": ro.result },
            ops: { row0: row0.op, row1: row1.op, row2: ro.op, col0: col0.op, col1: col1.op, col2: co.op },
          };
        }
      }
    }
    return null;
  }

  function generateLattice(suffix, forcedA00) {
    const rng = seededRandom(seedFor(`crossmath-${suffix}`));
    for (let i = 0; i < 800; i++) {
      const r = tryGenerate(rng, forcedA00);
      if (r) return r;
    }
    // fallback (astronomically unlikely): trivial all-ones puzzle
    const base = forcedA00 !== undefined ? forcedA00 : 1;
    return {
      values: { "0,0": base, "0,1": 1, "1,0": 1, "1,1": 1, "0,2": base + 1, "1,2": 2, "2,0": base + 1, "2,1": 2, "2,2": (base + 1) + 2 },
      ops: { row0: "+", row1: "+", row2: "+", col0: "+", col1: "+", col2: "+" },
    };
  }

  function ensureLoaded() {
    if (lattices) return;
    const a = generateLattice("a");
    const b = generateLattice("b", a.values["2,2"]);
    lattices = { a, b };
    userValues = {};
    CM_LATTICES.forEach((L) => {
      CM_BLANK_CELLS_BY_LATTICE[L].forEach((k) => { userValues[`${L}:${k}`] = ""; });
    });
    solved = isCompletedToday("crossmath");
  }

  function getElapsedMs() { return elapsedMs + (runStart ? Date.now() - runStart : 0); }

  function startTimer() {
    stopTimer();
    if (solved) { updateTimerDisplay(); return; }
    if (!runStart) runStart = Date.now();
    timerIntervalId = setInterval(updateTimerDisplay, 1000);
    updateTimerDisplay();
  }

  function stopTimer() {
    if (timerIntervalId) { clearInterval(timerIntervalId); timerIntervalId = null; }
    if (runStart) { elapsedMs += Date.now() - runStart; runStart = null; }
  }

  function updateTimerDisplay() {
    const el = document.getElementById("cmTimer");
    const bestEl = document.getElementById("cmBest");
    if (el) el.textContent = formatTime(getElapsedMs());
    if (bestEl) {
      const best = getBestTime("crossmath");
      bestEl.textContent = best === null ? "\u2013" : formatTime(best);
    }
  }

  function latticeSolved(L) {
    return CM_BLANK_CELLS_BY_LATTICE[L].every((k) => parseInt(userValues[`${L}:${k}`], 10) === lattices[L].values[k]);
  }

  function checkWin() {
    return CM_LATTICES.every((L) => latticeSolved(L));
  }

  function render() {
    const grid = document.getElementById("cmGrid");
    grid.innerHTML = "";

    // build one shared 9x9 role map combining both lattices; they meet
    // at exactly one cell (A's corner === B's given anchor), which both
    // passes agree on since it's the literal same value.
    const cellRole = {};

    CM_LATTICES.forEach((L) => {
      const puzzle = lattices[L];
      const offR = CM_OFFSET[L].row, offC = CM_OFFSET[L].col;

      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          const row = offR + 2 * i, col = offC + 2 * j;
          const key = `${i},${j}`;
          const isGiven = CM_GIVEN_CELLS.includes(key);
          const uKey = `${L}:${key}`;
          cellRole[`${row},${col}`] = {
            type: "num",
            given: isGiven,
            value: isGiven ? puzzle.values[key] : (solved ? puzzle.values[key] : userValues[uKey]),
            editKey: isGiven ? null : uKey,
            correct: isGiven || solved || (userValues[uKey] !== "" && parseInt(userValues[uKey], 10) === puzzle.values[key]),
          };
        }
      }
      for (let i = 0; i < 3; i++) {
        const opText = i === 0 ? puzzle.ops.row0 : i === 1 ? puzzle.ops.row1 : puzzle.ops.row2;
        cellRole[`${offR + 2 * i},${offC + 1}`] = { type: "sym", value: opText };
        cellRole[`${offR + 2 * i},${offC + 3}`] = { type: "sym", value: "=" };
      }
      for (let j = 0; j < 3; j++) {
        const opText = j === 0 ? puzzle.ops.col0 : j === 1 ? puzzle.ops.col1 : puzzle.ops.col2;
        cellRole[`${offR + 1},${offC + 2 * j}`] = { type: "sym", value: opText };
        cellRole[`${offR + 3},${offC + 2 * j}`] = { type: "sym", value: "=" };
      }
    });

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const role = cellRole[`${r},${c}`];
        const cell = document.createElement("div");
        if (!role) { cell.className = "cmCell cmBlank"; grid.appendChild(cell); continue; }

        if (role.type === "sym") {
          cell.className = "cmCell cmSym";
          cell.textContent = role.value;
        } else if (role.given) {
          cell.className = "cmCell cmGiven";
          cell.textContent = role.value;
        } else {
          cell.className = "cmCell cmInput" + (role.correct && role.value !== "" ? " cmCorrect" : "");
          const input = document.createElement("input");
          input.type = "tel";
          input.inputMode = "numeric";
          input.maxLength = 2;
          input.value = role.value || "";
          input.disabled = solved;
          input.dataset.key = role.editKey;
          cell.appendChild(input);
        }
        grid.appendChild(cell);
      }
    }

    const winBanner = document.getElementById("cmWinBanner");
    if (solved) {
      const record = justSetRecord ? '<div class="clWinRecord">New best time</div>' : "";
      winBanner.innerHTML = `
        <div class="clWinTitle">Solved in ${formatTime(getElapsedMs())}</div>
        <div class="clWinDetail">+${lastCoinsEarned} coins</div>
        ${record}
      `;
      justSetRecord = false;
    }
    winBanner.hidden = !solved;
    updateTimerDisplay();
  }

  function checkAndHandleWin() {
    if (!checkWin()) return;
    stopTimer();
    const elapsed = getElapsedMs();
    const raw = computeCoinsGeneric(CM_COIN_CONFIG, elapsed);
    lastCoinsEarned = Math.max(CM_COIN_CONFIG.min, raw - hintsUsed * 6);
    solved = true;
    justSetRecord = recordBestTimeIfBetter("crossmath", elapsed);
    addCoins(lastCoinsEarned);
    markCompletedToday("crossmath");
    if (typeof refreshHomeStatuses === "function") refreshHomeStatuses();
  }

  function handleInput(uKey, rawValue) {
    const digits = rawValue.replace(/[^0-9]/g, "").slice(0, 2);
    userValues[uKey] = digits;
    checkAndHandleWin();
    render();
    if (!solved) {
      const nextInput = document.querySelector(`input[data-key="${uKey}"]`);
      if (nextInput) { nextInput.focus(); nextInput.setSelectionRange(digits.length, digits.length); }
    }
  }

  // Reveals every blank in whichever lattice isn't fully correct yet.
  function useHint() {
    if (solved) return;
    const target = CM_LATTICES.find((L) => !latticeSolved(L));
    if (!target) return;

    CM_BLANK_CELLS_BY_LATTICE[target].forEach((k) => {
      userValues[`${target}:${k}`] = String(lattices[target].values[k]);
    });
    hintsUsed += 1;

    checkAndHandleWin();
    render();
  }

  function attachEvents() {
    document.getElementById("cmGrid").addEventListener("input", (e) => {
      if (e.target.tagName === "INPUT") handleInput(e.target.dataset.key, e.target.value);
    });
    document.getElementById("cmClearBtn").addEventListener("click", () => {
      if (solved) return;
      CM_LATTICES.forEach((L) => {
        CM_BLANK_CELLS_BY_LATTICE[L].forEach((k) => { userValues[`${L}:${k}`] = ""; });
      });
      render();
    });
    document.getElementById("cmHintBtn").addEventListener("click", () => {
      useHint();
    });
  }

  function mount() {
    ensureLoaded();
    if (!attached) { attachEvents(); attached = true; }
    render();
    startTimer();
  }

  function pause() { stopTimer(); }

  return { mount, pause };
})();
