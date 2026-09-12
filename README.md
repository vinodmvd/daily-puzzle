# Daily Puzzles — web app (installs on iPhone, no Mac needed)

A Progressive Web App (PWA): a website that installs onto your iPhone
home screen and opens full-screen like a real app. No Xcode, no Mac, no
Apple ID, no App Store, no ads.

## What's built and working

- **Daily crossword** — auto-generated each day from a ~60-word bank
  (words placed by intersecting letters, like a real crossword
  constructor). Tap a cell to select it, tap again to flip
  across/down, type to fill letters, tap a clue in the list to jump to
  it.
- **Daily color link** — 3 difficulty levels (Easy 5x5 / Medium 7x7 /
  Hard 9x9), every pair of dots labeled with a matching letter, full
  board coverage required to solve.
- **Daily cross math** — a 3x3 lattice of numbers where every row and
  column is an equation; fill in the 5 blanks to satisfy all of them
  at once.
- **Timer + personal best** on every puzzle/level.
- **Coins** awarded on solve, scaled by how fast you finished.
- **Streak** that only advances once all three games are done for the
  day, with 2 monthly "freeze" days that auto-cover a missed day.
- Fully offline after first install (service worker caches everything).

## Files

| File | What it does |
|---|---|
| `index.html` | Page shell: home screen + the three game screens |
| `styles.css` | All visual styling |
| `app.js` | Daily seeding, save/streak/coins/freeze logic, navigation |
| `colorlink.js` | Color Link generator + game logic (3 levels) |
| `crossword.js` | Crossword generator (word bank + placement) + game logic |
| `crossmath.js` | Cross Math lattice generator + game logic |
| `manifest.json` | Tells iOS this is an installable app |
| `sw.js` | Service worker — offline caching |
| `icons/` | Home screen icon images |
| `README.md` | This file |

## How to install on your iPhone (no Mac needed)

1. **Host the files** somewhere iPhone Safari can reach them — iOS can
   only "install" a web app from a real web address, not local files.
   Two free, no-account-strictly-needed options:
   - **GitHub Pages**: create a free GitHub account, make a new repo,
     drag-and-drop all these files in (keep the `icons/` folder), then
     go to Settings → Pages and enable it. You'll get a URL like
     `https://yourname.github.io/daily-puzzles/`.
   - **Netlify Drop**: go to app.netlify.com/drop and drag this whole
     folder onto the page — it gives you a live URL instantly.
2. Open that URL in **Safari** on your iPhone (must be Safari).
3. Tap the **Share** button → **Add to Home Screen** → **Add**.
4. The app icon now sits on your home screen and opens full-screen,
   offline, ad-free.

If you update the files later, just re-upload the changed ones to
wherever you hosted them — your installed home-screen icon will pick
up the changes automatically next time you open it online.

## What still needs to be done / possible next steps

Nothing here is broken — the app is fully playable end-to-end — but
these are honest gaps and ideas worth knowing about:

- **Crossword word bank is ~60 words.** It's enough for real daily
  variety (word order is shuffled by date, so the layout differs
  daily), but a bigger bank in `crossword.js` (the `XW_WORDS` array)
  would mean richer puzzles and more unique clues over time. Anyone
  can add `["WORD", "Clue text"]` entries to that array.
- **Crossword doesn't enforce "no touching" adjacency rules** that
  strict professional crosswords use (where two parallel words can't
  sit directly next to each other without a shared letter). This
  keeps the generator simple and it never produces a wrong or
  unsolvable puzzle, just occasionally a slightly denser layout than
  a hand-made puzzle would have.
- **Cross Math is a single fixed lattice shape** (3x3 grid of numbers,
  6 equations) rather than the more elaborate branching layout you
  might see in other apps. It's mathematically guaranteed solvable
  every day, but a bigger/more varied template (or several templates
  to rotate through) is a natural upgrade.
- **Color Link's hardest level uses 8 letter pairs (A–H).** If you
  want it to go further (e.g. up to K), that just needs the `colors`
  count bumped in `CL_LEVELS` in `colorlink.js`.
- **No "check my answers" or "reveal a letter/cell" hint feature** in
  any game yet — solving is all-or-nothing right now.
- **No cloud sync.** Progress, coins, and streaks are stored in the
  browser's local storage on whichever device installed it — playing
  on a second device starts fresh. Adding real sync would need a
  backend (out of scope for a personal, no-cost project).
- **App icons are simple placeholder art** (a plain colored grid
  pattern). Swap the PNGs in `icons/` for anything nicer whenever
  you'd like.

## Updating the app

Whenever new files are generated for you, just re-upload the changed
files to wherever you hosted this (GitHub Pages / Netlify) — no
reinstall needed, the home-screen icon picks up changes automatically.
