# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chess Trainer is a browser-based chess practice app. Players guess candidate moves each turn, get Stockfish engine evaluation, and can optionally request Claude Opus 4.6 coaching explanations. Single HTML file, zero-build, all dependencies via CDN.

## Development

**No build step.** Hosted on Vercel (static HTML + serverless function).

```bash
# Local dev
npx vercel dev

# Or just serve statically (Claude explain won't work without the API route)
python3 -m http.server 8000
```

### Deployment

Vercel auto-deploys. Set `ANTHROPIC_API_KEY` environment variable in Vercel project settings for the Claude coaching feature.

### Project Structure

```
index.html           — Complete app (HTML + CSS + JS, single file)
api/explain.js       — Vercel serverless function proxying Claude API
chess-trainer-prd.md — Product requirements document
```

## Architecture

**Single-file vanilla HTML/CSS/JS app** (`index.html`) with three external integrations:

1. **chess.js (v0.10.3)** — Legal move generation, FEN management, game state detection
2. **Stockfish.js (WASM, v10.0.2)** — Runs in a Web Worker via UCI protocol; provides MultiPV analysis (top 2n moves for guess evaluation) and single best-move queries (opponent play)
3. **Claude Opus 4.6 API** — On-demand only, triggered solely by "Ask Claude to Explain" button. Never called automatically.

### State Machine

```
SETUP → PLAYING (opening, ply < 8) → GUESSING → EVALUATING → RESULTS → PLAYING → BOT_THINKING → loop or GAME_OVER
```

Phase values: `setup`, `playing`, `guessing`, `evaluating`, `results`, `bot-thinking`, `game-over`

### Game Flow

- **Opening phase (moves 1–4):** Free play, no evaluation. 8 half-moves skipped.
- **Guess phase (move 5+):** Player submits exactly n candidate moves via board clicks (SAN notation).
- **Evaluation:** Stockfish MultiPV at configured depth returns top 2n moves. Guesses matched against this list.
- **Results:** Match (✓) or miss (✗) per guess. Full Stockfish ranking displayed.
- **Explanation (optional):** Claude API call with FEN + guesses + Stockfish output → 4–6 sentence plain-text coaching response.
- **Play:** Player makes move, Stockfish replies as opponent.

### Key Implementation Details

- **SAN normalization:** Strip `+` and `#` before comparing guesses to Stockfish output (`Nf3+` matches `Nf3`)
- **UCI→SAN conversion:** Translate Stockfish UCI output (e.g., `e2e4`) to SAN (`e4`) via chess.js
- **Promotion:** Show Queen/Rook/Bishop/Knight modal when pawn reaches 8th rank; include piece in SAN (`e8=Q`)
- **Board orientation:** Player's color always at bottom. Black: rank 8 at bottom, files h→a left-to-right
- **Move history:** Array of `{num, white, black}` objects. Black first move uses `white: "…"` placeholder
- **Stockfish Web Worker:** All engine work off main thread via `postMessage`. Wrapper exposes `analyzePosition(fen, depth, multiPV)` and `getBestMove(fen, depth)`

### Configuration Defaults

| Parameter | Range | Default |
|-----------|-------|---------|
| Guesses per turn (n) | 1–5 | 3 |
| Engine depth | 5–22 | 15 |
| Opening skip | — | 8 plies (hardcoded) |

### UI Specs (Lichess-inspired dark theme)

- Board: light `#f0d9b5`, dark `#b58863`; selection `#829769`/`#646d40`; last move `#ced26b`/`#aba23a`
- Background `#161512`, cards `#262522`, borders `#3a3835`, accent `#7fba2c`
- Fonts: DM Sans (UI), Crimson Pro (display), JetBrains Mono (monospace)
- Desktop: 480×480px board + 330px panel. Mobile (≤860px): stacked, 344×344px board. Min 360px.
- Piece SVGs from Wikimedia Commons (stable URLs)

### CDN Dependencies

```
chess.js:    https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js
Stockfish:   https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js (non-WASM, loaded as blob Worker)
Piece SVGs:  Wikimedia Commons Chess_*lt45.svg / Chess_*dt45.svg
Claude API:  Proxied through /api/explain (Vercel serverless function)
```
