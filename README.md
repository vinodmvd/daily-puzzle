# Daily Puzzles — web app (installs on iPhone, no Mac needed)

A Progressive Web App (PWA): a website that installs onto your iPhone
home screen and opens full-screen like a real app. No Xcode, no Mac, no
Apple ID, no App Store, no ads.

## Files — upload all of these

| File | What it does |
|---|---|
| `index.html` | Page shell: home screen + the three game screens |
| `styles.css` | All visual styling |
| `app.js` | Daily seeding, save/streak/coins/freeze logic, navigation |
| `colorlink.js` | Color Link generator + game logic (3 levels, hints, locking) |
| `crossword.js` | Crossword generator (word bank + placement) + game logic |
| `crossmath.js` | Cross Math lattice generator + game logic |
| `manifest.json` | Tells iOS this is an installable app |
| `sw.js` | Service worker — offline caching (bumped to v4) |
| `icons/` | Home screen icon images |
| `README.md` | This file |

Since the service worker cache version changed, after uploading you may
still need to fully clear the site's data once (Settings → Safari →
Advanced → Website Data → find the site → delete) to guarantee your
phone drops any old cached copy rather than waiting for it to expire
naturally.

## What's built and working

- **Daily crossword** — auto-generated each day from a word bank,
  words placed by intersecting letters like a real crossword
  constructor. Tap a cell to select it, tap again to flip
  across/down, type to fill letters, tap a clue to jump to it.
- **Daily color link** — 3 difficulty levels (Easy 5x5 / Medium 7x7 /
  Hard 9x9). **Medium unlocks only after Easy is solved that day, and
  Hard only after Medium** — each locked tab shows a 🔒 and won't
  respond to taps until earned. Every pair of dots is labeled with a
  matching letter, and paths render as connected rounded "pipe"
  segments (straight through, rounded only at turns and endpoints)
  instead of flat squares. Full board coverage is required to solve.
  A **Hint** button reveals one whole color's correct path at a time
  (starting with whichever color isn't right yet), at a small coin
  cost on the eventual win.
- **Daily cross math** — a 3x3 lattice of numbers where every row and
  column is an equation; fill in the 5 blanks to satisfy all of them
  at once.
- **Timer + personal best** on every puzzle/level.
- **Coins** awarded on solve, scaled by how fast you finished (reduced
  if you used hints on color link).
- **Streak** that only advances once all three games are done for the
  day, with 2 monthly "freeze" days that auto-cover a missed day.
- Fully offline after first install (service worker caches everything).

## Recent fixes in this build

- **Win banner overlay bug (fixed):** the "solved" overlay on every
  game was missing a CSS rule to actually respect being hidden, so it
  sat on top of the board at all times, washing out the puzzle
  underneath. Added `.winBanner[hidden] { display: none; }`.
- **Color Link dragging bug (fixed):** the whole grid was being
  destroyed and rebuilt on every move, including the cell you were
  actively touching — which silently breaks further touch-drag events
  on iOS Safari. The grid's cells are now built once and only their
  colors/shapes are updated afterward, so a drag never loses tracking.
- **Touch-on-dot bug (fixed):** tapping exactly on a dot's circle
  could register on the wrong inner element and get ignored. Fixed to
  correctly detect the containing cell either way.
- **Zigzag paths (fixed):** the puzzle generator now biases toward
  continuing in a straight line and only turns when the puzzle
  genuinely needs to, instead of producing tight back-and-forth
  segments. Verified this roughly halves the turn frequency in
  generated puzzles with no loss of solvability.
- **Pipe-style rendering (new):** connected path cells now render as a
  single rounded line through the board (matching the visual quality
  of reference puzzle apps) rather than flat colored squares.
- **Level locking (new):** Medium and Hard color link levels are
  locked until the previous level is completed that day.
- **Hints (new):** a Hint button on color link reveals one color's
  correct path at a time, with a coin cost trade-off.

## How to install on your iPhone (no Mac needed)

1. **Host the files** somewhere iPhone Safari can reach them — iOS can
   only "install" a web app from a real web address, not local files.
   - **GitHub Pages**: create a free GitHub account, make a repo,
     upload all these files (keep the `icons/` folder), then go to
     Settings → Pages and enable it.
   - **Netlify Drop**: go to app.netlify.com/drop and drag this whole
     folder onto the page for an instant live URL.
2. Open that URL in **Safari** on your iPhone (must be Safari).
3. Tap the **Share** button → **Add to Home Screen** → **Add**.
4. The app icon now sits on your home screen and opens full-screen,
   offline, ad-free.

## What still needs to be done / possible next steps

- **Crossword word bank is modest (~60 words).** A bigger bank in
  `crossword.js` (the `XW_WORDS` array) means richer daily variety.
- **Cross Math is a single fixed lattice shape.** Guaranteed solvable
  every day, but a bigger/more varied template is a natural upgrade.
- **Color Link's hardest level uses 8 letter pairs (A–H).** Bump the
  `colors` count in `CL_LEVELS` (in `colorlink.js`) to go further.
- **No cloud sync** — progress, coins, and streaks live in the
  browser's local storage per device. A second device starts fresh.
- **App icons are simple placeholder art.** Swap the PNGs in `icons/`
  for anything nicer whenever you'd like.
- **Crossword and Cross Math don't have a Hint button yet** — only
  Color Link does. Could be added the same way if useful.
