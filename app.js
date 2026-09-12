// ---- Daily seed engine ----------------------------------------------
// Same idea for every game: turn today's date + game id into a stable
// number, so "today's puzzle" is identical all day and changes
// automatically tomorrow. No server needed.

function todayKey() {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

function seedFor(gameId) {
  const str = `${todayKey()}-${gameId}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

// Deterministic PRNG (mulberry32) — same seed always gives the same
// sequence, so puzzle generation is reproducible for the day.
function seededRandom(seed) {
  let a = seed;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- Completion tracking (localStorage) ------------------------------

function completionKey(gameId) {
  return `completed_${gameId}_${todayKey()}`;
}

function isCompletedToday(gameId) {
  return localStorage.getItem(completionKey(gameId)) === "1";
}

function markCompletedToday(gameId) {
  localStorage.setItem(completionKey(gameId), "1");
  updateStreakIfComplete();
  refreshStatsBar();
}

// ---- Coins ----------------------------------------------------------

function getCoins() {
  return parseInt(localStorage.getItem("dp_coins") || "0", 10);
}

function addCoins(amount) {
  const total = getCoins() + amount;
  localStorage.setItem("dp_coins", String(total));
  return total;
}

// ---- Streak + monthly freezes -----------------------------------------

const FREEZES_PER_MONTH = 2;

function getMonthKey() {
  const d = new Date();
  return d.getFullYear() * 100 + (d.getMonth() + 1);
}

function freezesUsedThisMonth() {
  const storedMonth = localStorage.getItem("dp_freeze_month");
  const currentMonth = String(getMonthKey());
  if (storedMonth !== currentMonth) {
    localStorage.setItem("dp_freeze_month", currentMonth);
    localStorage.setItem("dp_freeze_used", "0");
    return 0;
  }
  return parseInt(localStorage.getItem("dp_freeze_used") || "0", 10);
}

function freezesRemaining() {
  return Math.max(0, FREEZES_PER_MONTH - freezesUsedThisMonth());
}

function useFreezes(count) {
  const used = freezesUsedThisMonth() + count;
  localStorage.setItem("dp_freeze_used", String(used));
}

function dateFromKey(key) {
  const y = Math.floor(key / 10000);
  const m = Math.floor((key % 10000) / 100) - 1;
  const d = key % 100;
  return new Date(y, m, d);
}

function daysBetweenKeys(a, b) {
  return Math.round((dateFromKey(b) - dateFromKey(a)) / 86400000);
}

function getStreak() {
  return parseInt(localStorage.getItem("dp_streak") || "0", 10);
}

function allGamesCompletedToday() {
  const colorLinkDone = typeof ColorLinkGame !== "undefined" && ColorLinkGame.isFullyCompletedToday();
  return isCompletedToday("crossword") && colorLinkDone && isCompletedToday("crossmath");
}

// Called every time any game is marked complete. Only actually advances
// the streak once ALL THREE games are done for today, and only once per
// day. Gaps of missed days are covered by freezes when available
// (2 per calendar month), otherwise the streak resets.
function updateStreakIfComplete() {
  if (!allGamesCompletedToday()) return;

  const today = todayKey();
  const lastDayRaw = localStorage.getItem("dp_streak_lastday");
  const lastDay = lastDayRaw ? parseInt(lastDayRaw, 10) : null;

  if (lastDay === today) return; // already credited today

  let streak = getStreak();

  if (lastDay === null) {
    streak = 1;
  } else {
    const gap = daysBetweenKeys(lastDay, today);
    if (gap === 1) {
      streak += 1;
    } else if (gap > 1) {
      const missed = gap - 1;
      const avail = freezesRemaining();
      if (avail >= missed) {
        useFreezes(missed);
        streak += 1;
      } else {
        streak = 1;
      }
    }
  }

  localStorage.setItem("dp_streak", String(streak));
  localStorage.setItem("dp_streak_lastday", String(today));
}

function refreshStatsBar() {
  const streakEl = document.getElementById("streakValue");
  const coinsEl = document.getElementById("coinsValue");
  const freezeEl = document.getElementById("freezeValue");
  if (streakEl) streakEl.textContent = getStreak();
  if (coinsEl) coinsEl.textContent = getCoins();
  if (freezeEl) freezeEl.textContent = freezesRemaining();
}

// ---- Shared timer/coin/record helpers (used by crossword + cross math;
// color link keeps its own per-level versions since it has 3 sub-levels) --

function formatTime(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const mm = Math.floor(totalSeconds / 60);
  const ss = totalSeconds % 60;
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

function bestTimeKey(gameId) { return `dp_besttime_${gameId}`; }

function getBestTime(gameId) {
  const raw = localStorage.getItem(bestTimeKey(gameId));
  return raw ? parseInt(raw, 10) : null;
}

// Returns true if this run set a new record.
function recordBestTimeIfBetter(gameId, elapsedMs) {
  const current = getBestTime(gameId);
  if (current === null || elapsedMs < current) {
    localStorage.setItem(bestTimeKey(gameId), String(Math.round(elapsedMs)));
    return true;
  }
  return false;
}

// Coins scale down the longer a puzzle takes: "max" if solved almost
// instantly, decaying to "min" by "par" seconds.
function computeCoinsGeneric(cfg, elapsedMs) {
  const elapsedSec = elapsedMs / 1000;
  const fraction = Math.max(0, Math.min(1, 1 - elapsedSec / cfg.par));
  return Math.round(cfg.min + fraction * (cfg.max - cfg.min));
}

// ---- Navigation --------------------------------------------------------

const GAMES = {
  crossword: "Crossword",
  colorlink: "Color link",
  crossmath: "Cross math",
};

function showView(name) {
  if (typeof ColorLinkGame !== "undefined" && name !== "colorlink") ColorLinkGame.pause();
  if (typeof CrosswordGame !== "undefined" && name !== "crossword") CrosswordGame.pause();
  if (typeof CrossMathGame !== "undefined" && name !== "crossmath") CrossMathGame.pause();

  document.querySelectorAll(".view").forEach((v) => (v.hidden = true));
  document.getElementById(`view-${name}`).hidden = false;

  const title = document.getElementById("pageTitle");
  const back = document.getElementById("backBtn");
  if (name === "home") {
    title.textContent = "Daily puzzles";
    back.hidden = true;
    location.hash = "";
  } else {
    title.textContent = GAMES[name];
    back.hidden = false;
    location.hash = name;
  }

  if (name === "colorlink" && typeof ColorLinkGame !== "undefined") ColorLinkGame.mount();
  if (name === "crossword" && typeof CrosswordGame !== "undefined") CrosswordGame.mount();
  if (name === "crossmath" && typeof CrossMathGame !== "undefined") CrossMathGame.mount();
}

function refreshHomeStatuses() {
  Object.keys(GAMES).forEach((gameId) => {
    const el = document.getElementById(`status-${gameId}`);
    if (!el) return;
    const done = gameId === "colorlink" && typeof ColorLinkGame !== "undefined"
      ? ColorLinkGame.isFullyCompletedToday()
      : isCompletedToday(gameId);
    if (done) {
      el.classList.add("done");
      el.textContent = "\u2713";
    } else {
      el.classList.remove("done");
      el.textContent = "";
    }
  });
}

function init() {
  // date label
  const dateLabel = document.getElementById("dateLabel");
  dateLabel.textContent = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  document.querySelectorAll(".tile").forEach((tile) => {
    tile.addEventListener("click", () => showView(tile.dataset.view));
  });

  document.getElementById("backBtn").addEventListener("click", () => showView("home"));

  refreshHomeStatuses();
  refreshStatsBar();

  const initial = location.hash.replace("#", "");
  showView(GAMES[initial] ? initial : "home");
}

document.addEventListener("DOMContentLoaded", init);

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (typeof ColorLinkGame !== "undefined") ColorLinkGame.pause();
    if (typeof CrosswordGame !== "undefined") CrosswordGame.pause();
    if (typeof CrossMathGame !== "undefined") CrossMathGame.pause();
    return;
  }
  if (typeof ColorLinkGame !== "undefined" && !document.getElementById("view-colorlink").hidden) ColorLinkGame.mount();
  if (typeof CrosswordGame !== "undefined" && !document.getElementById("view-crossword").hidden) CrosswordGame.mount();
  if (typeof CrossMathGame !== "undefined" && !document.getElementById("view-crossmath").hidden) CrossMathGame.mount();
});

// ---- Offline support ----------------------------------------------------

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {
      // offline support is a nice-to-have; ignore failures
    });
  });
}
