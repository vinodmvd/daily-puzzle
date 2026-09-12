// ---- Crossword --------------------------------------------------------
// Generates a small crossword daily by shuffling a word bank (seeded by
// the day) and placing words onto a grid wherever they intersect an
// already-placed word at a matching letter, standard crossword-style.

const XW_WORDS = [
  ["APPLE", "Fruit that keeps the doctor away"], ["RIVER", "Flowing body of fresh water"],
  ["TIGER", "Striped big cat"], ["CLOUD", "Fluffy sky feature"], ["HOUSE", "Where you live"],
  ["MUSIC", "Art of arranging sound"], ["BREAD", "Baked staple food"], ["CHESS", "Board game with a king"],
  ["EARTH", "Our home planet"], ["LEMON", "Sour yellow citrus"], ["OCEAN", "Vast body of salt water"],
  ["PLANT", "Living thing that photosynthesizes"], ["STONE", "Small piece of rock"], ["TRAIN", "Rail transport"],
  ["WATER", "Chemical formula H2O"], ["BEACH", "Sandy shore"], ["CANDY", "Sweet treat"], ["DANCE", "Move rhythmically to music"],
  ["EAGLE", "Large bird of prey"], ["FENCE", "Barrier around a yard"], ["GRAPE", "Fruit that grows in bunches"],
  ["HONEY", "Sweet substance made by bees"], ["IMAGE", "Picture or likeness"], ["JUICE", "Drink pressed from fruit"],
  ["KNIFE", "Cutting utensil"], ["MONEY", "Currency"], ["NIGHT", "Opposite of day"],
  ["PAPER", "Material for writing"], ["QUEEN", "Female monarch"], ["ROBOT", "Mechanical automaton"],
  ["SUGAR", "Sweetener from cane or beet"], ["TABLE", "Furniture with a flat top"], ["UNCLE", "Your parent's brother"],
  ["VOICE", "Sound produced by vocal cords"], ["WHEEL", "Round device that rotates"], ["ZEBRA", "Striped African animal"],
  ["BRAIN", "Organ used for thinking"], ["CROWN", "Royal head ornament"], ["DRESS", "Garment worn by women"],
  ["FLAME", "Visible part of fire"], ["GHOST", "Spooky spirit"], ["HEART", "Organ that pumps blood"],
  ["IVORY", "Material from elephant tusks"], ["JOKER", "Playing card with a jester"], ["MANGO", "Tropical stone fruit"],
  ["NOVEL", "Long work of fiction"], ["OASIS", "Watering hole in the desert"], ["PEACH", "Fuzzy orange-pink fruit"],
  ["RADIO", "Device for broadcast audio"], ["SNAKE", "Legless reptile"], ["TOAST", "Browned bread"],
  ["CAT", "Common house pet"], ["DOG", "Loyal pet, man's best friend"], ["SUN", "Star at the center of our solar system"],
  ["SEA", "Large body of salt water"], ["ICE", "Frozen water"], ["OWL", "Nocturnal bird"],
  ["ANT", "Tiny hardworking insect"], ["BEE", "Buzzing pollinator"], ["FOX", "Cunning red-furred animal"],
  ["EGG", "Breakfast staple laid by hens"],
];

const XW_COIN_CONFIG = { max: 60, min: 10, par: 300 };

const CrosswordGame = (() => {
  let puzzle = null; // { cells, width, height, minRow, minCol, words }
  let userGrid = null; // 2D array of letters typed so far
  let activeCell = null; // {r,c}
  let activeDir = "across";
  let solved = false;
  let elapsedMs = 0;
  let runStart = null;
  let timerIntervalId = null;
  let lastCoinsEarned = 0;
  let justSetRecord = false;
  let attached = false;

  function shuffle(arr, rng) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function buildRaw(rng) {
    const GRID = 15;
    const OFFSET = 7;
    const cells = {};
    const placed = [];
    const key = (r, c) => `${r},${c}`;

    const order = shuffle(XW_WORDS, rng);
    const first = order[0];
    const startCol = OFFSET - Math.floor(first[0].length / 2);
    for (let i = 0; i < first[0].length; i++) cells[key(OFFSET, startCol + i)] = first[0][i];
    placed.push({ word: first[0], clue: first[1], row: OFFSET, col: startCol, dir: "across" });

    for (let w = 1; w < order.length; w++) {
      const [word, clue] = order[w];
      if (placed.some((p) => p.word === word)) continue;
      const options = [];

      for (const p of placed) {
        for (let i = 0; i < p.word.length; i++) {
          const letter = p.word[i];
          const pr = p.dir === "across" ? p.row : p.row + i;
          const pc = p.dir === "across" ? p.col + i : p.col;
          for (let j = 0; j < word.length; j++) {
            if (word[j] !== letter) continue;
            const dir = p.dir === "across" ? "down" : "across";
            const row = dir === "across" ? pr : pr - j;
            const col = dir === "across" ? pc - j : pc;
            if (row < 0 || col < 0) continue;
            const endRow = dir === "across" ? row : row + word.length - 1;
            const endCol = dir === "across" ? col + word.length - 1 : col;
            if (endRow >= GRID || endCol >= GRID) continue;

            let valid = true;
            for (let k = 0; k < word.length && valid; k++) {
              const rr = dir === "across" ? row : row + k;
              const cc = dir === "across" ? col + k : col;
              const existing = cells[key(rr, cc)];
              if (existing !== undefined && existing !== word[k]) valid = false;
            }
            if (!valid) continue;

            const beforeR = dir === "across" ? row : row - 1;
            const beforeC = dir === "across" ? col - 1 : col;
            const afterR = dir === "across" ? row : row + word.length;
            const afterC = dir === "across" ? col + word.length : col;
            if (cells[key(beforeR, beforeC)] !== undefined) continue;
            if (cells[key(afterR, afterC)] !== undefined) continue;

            options.push({ row, col, dir });
          }
        }
      }
      if (options.length === 0) continue;
      const choice = options[Math.floor(rng() * options.length)];
      for (let k = 0; k < word.length; k++) {
        const rr = choice.dir === "across" ? choice.row : choice.row + k;
        const cc = choice.dir === "across" ? choice.col + k : choice.col;
        cells[key(rr, cc)] = word[k];
      }
      placed.push({ word, clue, row: choice.row, col: choice.col, dir: choice.dir });
      if (placed.length >= 10) break;
    }

    return { cells, placed };
  }

  function trimAndNumber(raw) {
    const coords = Object.keys(raw.cells).map((k) => k.split(",").map(Number));
    const minRow = Math.min(...coords.map((c) => c[0]));
    const maxRow = Math.max(...coords.map((c) => c[0]));
    const minCol = Math.min(...coords.map((c) => c[1]));
    const maxCol = Math.max(...coords.map((c) => c[1]));
    const height = maxRow - minRow + 1;
    const width = maxCol - minCol + 1;

    const letterAt = (r, c) => raw.cells[`${r},${c}`];
    const hasCell = (r, c) => letterAt(r, c) !== undefined;

    // number cells: any cell that starts an across or down word
    const numbers = {};
    let n = 1;
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        if (!hasCell(r, c)) continue;
        const startsAcross = !hasCell(r, c - 1) && hasCell(r, c + 1);
        const startsDown = !hasCell(r - 1, c) && hasCell(r + 1, c);
        if (startsAcross || startsDown) {
          numbers[`${r},${c}`] = n++;
        }
      }
    }

    const words = raw.placed.map((p) => ({
      ...p,
      number: numbers[`${p.row},${p.col}`],
      rowT: p.row - minRow,
      colT: p.col - minCol,
    }));

    return { minRow, minCol, width, height, letterAt, hasCell, numbers, words };
  }

  function generatePuzzle() {
    const seed = seedFor("crossword");
    const rng = seededRandom(seed);
    const raw = buildRaw(rng);
    return trimAndNumber(raw);
  }

  function ensureLoaded() {
    if (puzzle) return;
    puzzle = generatePuzzle();
    userGrid = Array.from({ length: puzzle.height }, () => new Array(puzzle.width).fill(""));
    solved = isCompletedToday("crossword");
    activeDir = "across";
    const first = puzzle.words.find((w) => w.dir === "across") || puzzle.words[0];
    activeCell = { r: first.rowT, c: first.colT };
  }

  function wordAt(r, c, dir) {
    return puzzle.words.find((w) => {
      if (w.dir !== dir) return false;
      if (dir === "across") return w.rowT === r && c >= w.colT && c < w.colT + w.word.length;
      return w.colT === c && r >= w.rowT && r < w.rowT + w.word.length;
    });
  }

  function currentWord() {
    return wordAt(activeCell.r, activeCell.c, activeDir) || wordAt(activeCell.r, activeCell.c, activeDir === "across" ? "down" : "across");
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
    const el = document.getElementById("xwTimer");
    const bestEl = document.getElementById("xwBest");
    if (el) el.textContent = formatTime(getElapsedMs());
    if (bestEl) {
      const best = getBestTime("crossword");
      bestEl.textContent = best === null ? "\u2013" : formatTime(best);
    }
  }

  function checkWin() {
    for (const w of puzzle.words) {
      for (let k = 0; k < w.word.length; k++) {
        const rr = w.dir === "across" ? w.rowT : w.rowT + k;
        const cc = w.dir === "across" ? w.colT + k : w.colT;
        if (userGrid[rr][cc] !== w.word[k]) return false;
      }
    }
    return true;
  }

  function render() {
    const grid = document.getElementById("xwGrid");
    grid.style.setProperty("--xw-cols", puzzle.width);
    grid.style.setProperty("--xw-rows", puzzle.height);
    grid.innerHTML = "";

    const activeWord = currentWord();

    for (let r = 0; r < puzzle.height; r++) {
      for (let c = 0; c < puzzle.width; c++) {
        const cell = document.createElement("div");
        if (!puzzle.hasCell(r + puzzle.minRow, c + puzzle.minCol)) {
          cell.className = "xwCell xwBlock";
          grid.appendChild(cell);
          continue;
        }
        cell.className = "xwCell";
        cell.dataset.r = r;
        cell.dataset.c = c;

        const num = puzzle.numbers[`${r + puzzle.minRow},${c + puzzle.minCol}`];
        if (num) {
          const numEl = document.createElement("span");
          numEl.className = "xwNum";
          numEl.textContent = num;
          cell.appendChild(numEl);
        }

        const letterEl = document.createElement("span");
        letterEl.className = "xwLetter";
        letterEl.textContent = userGrid[r][c];
        cell.appendChild(letterEl);

        if (activeCell.r === r && activeCell.c === c) cell.classList.add("xwActive");
        else if (activeWord && (
          (activeWord.dir === "across" && activeWord.rowT === r && c >= activeWord.colT && c < activeWord.colT + activeWord.word.length) ||
          (activeWord.dir === "down" && activeWord.colT === c && r >= activeWord.rowT && r < activeWord.rowT + activeWord.word.length)
        )) cell.classList.add("xwInWord");

        if (solved) cell.classList.add("xwSolved");

        grid.appendChild(cell);
      }
    }

    const clueBar = document.getElementById("xwClueBar");
    if (activeWord) {
      clueBar.textContent = `${activeWord.number} ${activeWord.dir === "across" ? "Across" : "Down"}: ${activeWord.clue}`;
    }

    const acrossList = document.getElementById("xwAcrossList");
    const downList = document.getElementById("xwDownList");
    acrossList.innerHTML = "";
    downList.innerHTML = "";
    puzzle.words
      .filter((w) => w.dir === "across")
      .sort((a, b) => a.number - b.number)
      .forEach((w) => {
        const li = document.createElement("li");
        li.textContent = `${w.number}. ${w.clue}`;
        li.addEventListener("click", () => { activeCell = { r: w.rowT, c: w.colT }; activeDir = "across"; render(); });
        acrossList.appendChild(li);
      });
    puzzle.words
      .filter((w) => w.dir === "down")
      .sort((a, b) => a.number - b.number)
      .forEach((w) => {
        const li = document.createElement("li");
        li.textContent = `${w.number}. ${w.clue}`;
        li.addEventListener("click", () => { activeCell = { r: w.rowT, c: w.colT }; activeDir = "down"; render(); });
        downList.appendChild(li);
      });

    const winBanner = document.getElementById("xwWinBanner");
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

  function moveTo(r, c) {
    if (r < 0 || c < 0 || r >= puzzle.height || c >= puzzle.width) return;
    if (!puzzle.hasCell(r + puzzle.minRow, c + puzzle.minCol)) return;
    activeCell = { r, c };
  }

  function handleCellClick(r, c) {
    if (solved) return;
    if (activeCell.r === r && activeCell.c === c) {
      activeDir = activeDir === "across" ? "down" : "across";
    } else {
      activeCell = { r, c };
      const hasAcross = wordAt(r, c, "across");
      const hasDown = wordAt(r, c, "down");
      if (activeDir === "across" && !hasAcross) activeDir = "down";
      if (activeDir === "down" && !hasDown) activeDir = "across";
    }
    render();
  }

  function advance(step) {
    const w = currentWord();
    if (!w) return;
    if (w.dir === "across") moveTo(activeCell.r, activeCell.c + step);
    else moveTo(activeCell.r + step, activeCell.c);
  }

  function handleKey(key) {
    if (solved) return;
    if (/^[a-zA-Z]$/.test(key)) {
      userGrid[activeCell.r][activeCell.c] = key.toUpperCase();
      advance(1);
      if (checkWin()) {
        stopTimer();
        const elapsed = getElapsedMs();
        lastCoinsEarned = computeCoinsGeneric(XW_COIN_CONFIG, elapsed);
        solved = true;
        justSetRecord = recordBestTimeIfBetter("crossword", elapsed);
        addCoins(lastCoinsEarned);
        markCompletedToday("crossword");
        if (typeof refreshHomeStatuses === "function") refreshHomeStatuses();
      }
      render();
    } else if (key === "Backspace") {
      if (userGrid[activeCell.r][activeCell.c]) {
        userGrid[activeCell.r][activeCell.c] = "";
      } else {
        advance(-1);
        userGrid[activeCell.r][activeCell.c] = "";
      }
      render();
    } else if (key === "ArrowRight") { moveTo(activeCell.r, activeCell.c + 1); activeDir = "across"; render(); }
    else if (key === "ArrowLeft") { moveTo(activeCell.r, activeCell.c - 1); activeDir = "across"; render(); }
    else if (key === "ArrowDown") { moveTo(activeCell.r + 1, activeCell.c); activeDir = "down"; render(); }
    else if (key === "ArrowUp") { moveTo(activeCell.r - 1, activeCell.c); activeDir = "down"; render(); }
  }

  function attachEvents() {
    const grid = document.getElementById("xwGrid");
    grid.addEventListener("click", (e) => {
      const cellEl = e.target.closest(".xwCell");
      if (!cellEl || cellEl.classList.contains("xwBlock")) return;
      handleCellClick(parseInt(cellEl.dataset.r, 10), parseInt(cellEl.dataset.c, 10));
      const hidden = document.getElementById("xwHiddenInput");
      hidden.focus();
    });

    const hidden = document.getElementById("xwHiddenInput");
    hidden.addEventListener("keydown", (e) => {
      if (e.key.length === 1 || e.key === "Backspace" || e.key.startsWith("Arrow")) {
        e.preventDefault();
        handleKey(e.key);
      }
    });

    document.getElementById("xwGrid").addEventListener("pointerdown", () => {
      document.getElementById("xwHiddenInput").focus();
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
