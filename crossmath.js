// ---- Cross Math ---------------------------------------------------------
// A 3x3 lattice of numbers: every row of 3 numbers and every column of 3
// numbers forms a valid equation (a OP b = c). The top-left 2x2 block is
// given; the other 5 cells must be filled in to satisfy all equations
// simultaneously (the bottom-right corner is constrained by BOTH its row
// and its column, which is what makes it a puzzle rather than 5 separate
// sums).

const CM_COIN_CONFIG = { max: 50, min: 8, par: 240 };
const CM_CAP = 99;

const CrossMathGame = (() => {
  let puzzle = null; // { values: {ij: value}, ops: {...} }
  let userValues = null; // ij -> string
  let solved = false;
  let elapsedMs = 0;
  let runStart = null;
  let timerIntervalId = null;
  let lastCoinsEarned = 0;
  let justSetRecord = false;
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

  function tryGenerate(rng) {
    const A00 = 1 + Math.floor(rng() * 9);
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

  function generatePuzzle() {
    const rng = seededRandom(seedFor("crossmath"));
    for (let i = 0; i < 800; i++) {
      const r = tryGenerate(rng);
      if (r) return r;
    }
    // fallback (astronomically unlikely): trivial all-ones puzzle
    return {
      values: { "0,0": 1, "0,1": 1, "1,0": 1, "1,1": 1, "0,2": 2, "1,2": 2, "2,0": 2, "2,1": 2, "2,2": 4 },
      ops: { row0: "+", row1: "+", row2: "\u00d7", col0: "+", col1: "+", col2: "\u00d7" },
    };
  }

  const GIVEN_CELLS = ["0,0", "0,1", "1,0", "1,1"];
  const BLANK_CELLS = ["0,2", "1,2", "2,0", "2,1", "2,2"];

  function ensureLoaded() {
    if (puzzle) return;
    puzzle = generatePuzzle();
    userValues = {};
    BLANK_CELLS.forEach((k) => { userValues[k] = ""; });
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

  function checkWin() {
    return BLANK_CELLS.every((k) => parseInt(userValues[k], 10) === puzzle.values[k]);
  }

  // grid layout: 5x5, numbers at (0,0)(0,2)(0,4)(2,0)(2,2)(2,4)(4,0)(4,2)(4,4)
  // mapped from ij via row=2*i, col=2*j. Operators/equals fill the gaps.
  function ijToGrid(i, j) { return { row: 2 * i, col: 2 * j }; }

  function render() {
    const grid = document.getElementById("cmGrid");
    grid.innerHTML = "";

    const cellRole = {}; // "r,c" -> {type, text, editKey}
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const { row, col } = ijToGrid(i, j);
        const key = `${i},${j}`;
        const isGiven = GIVEN_CELLS.includes(key);
        cellRole[`${row},${col}`] = {
          type: "num",
          given: isGiven,
          value: isGiven ? puzzle.values[key] : (solved ? puzzle.values[key] : userValues[key]),
          editKey: isGiven ? null : key,
          correct: isGiven || solved || (userValues[key] !== "" && parseInt(userValues[key], 10) === puzzle.values[key]),
        };
      }
    }
    // row operators at (2i, 1); equals at (2i, 3)
    for (let i = 0; i < 3; i++) {
      const opText = i === 0 ? puzzle.ops.row0 : i === 1 ? puzzle.ops.row1 : puzzle.ops.row2;
      cellRole[`${2 * i},1`] = { type: "sym", value: opText };
      cellRole[`${2 * i},3`] = { type: "sym", value: "=" };
    }
    // col operators at (1, 2j); equals at (3, 2j)
    for (let j = 0; j < 3; j++) {
      const opText = j === 0 ? puzzle.ops.col0 : j === 1 ? puzzle.ops.col1 : puzzle.ops.col2;
      cellRole[`1,${2 * j}`] = { type: "sym", value: opText };
      cellRole[`3,${2 * j}`] = { type: "sym", value: "=" };
    }

    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
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

  function handleInput(key, rawValue) {
    const digits = rawValue.replace(/[^0-9]/g, "").slice(0, 2);
    userValues[key] = digits;
    if (checkWin()) {
      stopTimer();
      const elapsed = getElapsedMs();
      lastCoinsEarned = computeCoinsGeneric(CM_COIN_CONFIG, elapsed);
      solved = true;
      justSetRecord = recordBestTimeIfBetter("crossmath", elapsed);
      addCoins(lastCoinsEarned);
      markCompletedToday("crossmath");
      if (typeof refreshHomeStatuses === "function") refreshHomeStatuses();
    }
    render();
    if (!solved) {
      const nextInput = document.querySelector(`#cmGrid input[data-key="${key}"]`);
      if (nextInput) { nextInput.focus(); nextInput.setSelectionRange(digits.length, digits.length); }
    }
  }

  function attachEvents() {
    const grid = document.getElementById("cmGrid");
    grid.addEventListener("input", (e) => {
      if (e.target.tagName === "INPUT") handleInput(e.target.dataset.key, e.target.value);
    });
    document.getElementById("cmClearBtn").addEventListener("click", () => {
      if (solved) return;
      BLANK_CELLS.forEach((k) => { userValues[k] = ""; });
      render();
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
