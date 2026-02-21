# Chess Practice Trainer — PRD

**Status:** Draft
**Version:** 1.0
**Last Updated:** February 2026

---

## 1. Overview

Chess Trainer is a browser-based web application that helps chess players improve their move-finding ability through a structured guess-and-evaluate loop. On each turn, the player guesses the best moves before playing, receives engine evaluation of those guesses, and can optionally request AI-powered coaching explanations.

The app combines **Stockfish** (open-source chess engine) for accurate positional evaluation with **Claude Opus 4.6** (LLM) for natural-language explanations. Stockfish handles all chess computation; Claude is only called on explicit user request for coaching.

---

## 2. Problem Statement

Most chess training tools are passive: players solve isolated puzzles or review games after the fact. There is a gap for **active, in-game training** where players practice candidate move selection in real positions as they develop naturally.

- **No feedback loop during play.** Players play games and only analyze afterward, missing the chance to train decision-making in real time.
- **Engine lines are hard to interpret.** Stockfish gives centipawn evaluations, but most players can't translate these into actionable chess understanding.
- **Opening moves don't need evaluation.** Forcing evaluation on well-known opening theory is tedious and counterproductive.

---

## 3. Target Users

| Segment | Rating Range | Primary Need |
|---|---|---|
| Beginners | Unrated – 1000 | Learn what makes a move "good" |
| Intermediates | 1000 – 1800 | Improve candidate move selection; reduce blunders |
| Advanced | 1800+ | Sharpen positional intuition; find engine-level moves |

---

## 4. Core Game Loop

### 4.1 Setup

Before the game starts, the player configures:

1. **Color:** White or Black.
2. **Guesses per turn (n):** 1 through 5. Determines how many candidate moves the player submits each turn.
3. **Engine depth:** 5 through 22. Controls Stockfish search depth (higher = stronger evaluation, slower).

### 4.2 Opening Phase (Moves 1–4)

For the first 4 full moves (8 half-moves), the guess-and-evaluate cycle is **skipped**. The player simply makes moves freely. This avoids tedious evaluation of well-known opening theory.

The UI displays an "Opening — eval starts move 5" badge during this phase.

### 4.3 Guess Phase (Move 5+)

Once the opening phase ends, each of the player's turns begins with guessing:

1. The player clicks pieces on the board to submit exactly **n** candidate moves (displayed in standard algebraic notation).
2. Guesses are listed in a sidebar panel. Duplicate guesses are rejected. Guesses can be removed before submission.
3. Once all n guesses are submitted, the player clicks **"Evaluate."**

### 4.4 Evaluation Phase

Stockfish analyzes the current position using **MultiPV** at the configured depth and returns the **top 2n moves**, each with a centipawn or mate-in evaluation score.

Each of the player's guesses is compared against this list:

- **Match (✓):** The guess appears in the top 2n Stockfish moves.
- **Miss (✗):** The guess does not appear in the top 2n moves.

The full ranked list of Stockfish's top moves (with eval scores) is displayed.

### 4.5 Explanation (Optional)

If the player wants to understand *why* certain moves are strong or weak, they click **"Ask Claude to Explain."** This sends to Claude Opus 4.6:

- The position (FEN)
- The player's guesses
- Stockfish's ranked output (moves + evals)

Claude returns a 4–6 sentence coaching explanation covering:

1. Why the top engine moves are strong (tactics, positional concepts, threats).
2. Why missed guesses are suboptimal.
3. An encouraging coaching note.

**This is the only step that calls the Claude API.** It is entirely optional and only fires on explicit user action.

### 4.6 Play Phase

After reviewing results, the player makes their actual move on the board. Stockfish then plays the opponent's reply. The cycle repeats until the game ends (checkmate, stalemate, draw).

### 4.7 Flow Diagram

```
Setup → [Opening Phase: free play for moves 1-4]
       → [Move 5+] → Guess n moves
                    → Evaluate (Stockfish MultiPV → top 2n)
                    → Results (match/miss per guess)
                    → (Optional) Ask Claude to Explain
                    → Player makes move
                    → Stockfish plays opponent reply
                    → Loop back to Guess
```

---

## 5. Technical Architecture

### 5.1 Component Overview

| Component | Technology | Responsibility |
|---|---|---|
| Board + Game Logic | chess.js (0.10.3) | Legal move generation, FEN management, game state (check, checkmate, draw) |
| Chess Engine | Stockfish.js (WASM) via Web Worker | Move evaluation (MultiPV), opponent play, centipawn scoring |
| AI Coaching | Claude Opus 4.6 API | Natural-language explanations of engine evaluations (on-demand only) |
| Board Rendering | Lichess cburnett SVGs | Piece images, board colors, move highlighting |
| UI Framework | Vanilla HTML/CSS/JS | Single-file, zero-build, self-contained application |

### 5.2 Engine Integration

Stockfish runs in a **Web Worker** to keep the UI responsive. Communication is via UCI protocol messages (`postMessage`). The engine wrapper handles:

- **MultiPV analysis:** Requests the top N lines at the configured depth for guess evaluation.
- **Best move queries:** Single best move at configured depth for opponent play.
- **UCI→SAN conversion:** Translates engine output (e.g. `e2e4`) to human-readable notation (`e4`) via chess.js.

### 5.3 Claude API Integration

The explanation endpoint sends a single message to `claude-opus-4-6` with:

- System context: "You are a friendly chess coach"
- Position FEN, player's guesses, Stockfish's ranked moves with evals
- Instructions: 4–6 sentences, specific chess concepts, no markdown, plain text

**No Claude API calls happen during evaluation, bot play, or any other phase.** Only the explicit "Ask Claude to Explain" button triggers an API call.

### 5.4 Inline Engine Alternative

For environments where Web Workers or external CDN loading is restricted (e.g., sandboxed iframes, artifact previews), an alternative is a **self-contained minimax engine** with alpha-beta pruning and piece-square tables, written inline in JavaScript. This trades evaluation strength (~1200–1600 ELO) for full portability and zero external dependencies.

### 5.5 Key External Dependencies

```
chess.js          — https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js
stockfish.js WASM — https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.wasm.js
stockfish.js (fb) — https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js
Piece SVGs        — https://lichess1.org/assets/_dgt4lR/piece/cburnett/{color}{piece}.svg
Claude API        — https://api.anthropic.com/v1/messages
```

---

## 6. UI and Design Specifications

### 6.1 Visual Style (Lichess-inspired)

| Element | Specification |
|---|---|
| Light squares | `#f0d9b5` |
| Dark squares | `#b58863` |
| Piece set | cburnett SVG set (from Lichess CDN) |
| Selection highlight | Green overlay (`#829769` light / `#646d40` dark) |
| Last move highlight | Yellow overlay (`#ced26b` light / `#aba23a` dark) |
| Check indicator | Radial red gradient on king square |
| Legal move dots | Semi-transparent circles; captures shown as ring |
| Guess highlights | Green overlay (`#b4d97c` light / `#7ba33a` dark) |
| Coordinate labels | Rank labels on left edge, file labels on bottom |
| Background | `#161512` (lichess dark theme) |
| Card backgrounds | `#262522` with `#3a3835` borders |
| Accent color | `#7fba2c` (lichess green) |

### 6.2 Layout

- **Desktop:** 480×480px board on the left, 330px control panel on the right.
- **Mobile (≤860px):** Stacked vertically; board scales to 344×344px.

Panel contents (top to bottom):
1. Phase banner (current phase + instructions)
2. Guess list (during guess/results phases)
3. Action buttons (Evaluate / Make Your Move / Ask Claude to Explain)
4. Top moves card (during results phase, shows Stockfish ranking)
5. Explanation card (after Claude responds)
6. Move history
7. New Game button

### 6.3 Phase Indicators

| Phase | Banner Title | Description |
|---|---|---|
| Opening (moves 1–4) | "Your Move" | "Play your move." + opening badge |
| Guessing | "Guess Phase" | "Find n good moves for [Color]. (x/n)" |
| Evaluating | "Evaluating" | Spinner + "Stockfish analyzing…" |
| Results | "Results" | "x/n in the top 2n. Review, then play." |
| Playing | "Your Move" | "Play your move." |
| Bot thinking | "Opponent" | Spinner + "Stockfish thinking…" |
| Game Over | "Game Over" | Checkmate/stalemate/draw message |

### 6.4 Fonts

- **Headers/UI:** DM Sans (600/700 weight)
- **Display/Titles:** Crimson Pro (serif, 700)
- **Monospace (moves/evals):** JetBrains Mono

---

## 7. Configurable Parameters

| Parameter | Range | Default | Notes |
|---|---|---|---|
| Player color | White / Black | — | Must be selected before starting |
| Guesses per turn (n) | 1–5 | 3 | Determines evaluation window (top 2n) |
| Engine depth | 5–22 | 15 | Higher = stronger + slower |
| Opening skip (plies) | — | 8 (hardcoded) | First 4 full moves |

---

## 8. Non-Functional Requirements

- **Performance:** Stockfish evaluation should complete in <5s at depth 15 on modern hardware. UI must remain responsive during engine computation (Web Worker).
- **Portability:** Single HTML file with no build step. All dependencies loaded via CDN. No server-side component required beyond the Anthropic API.
- **Responsiveness:** Functional layout on screens ≥360px wide.
- **Accessibility:** Piece images have appropriate alt text. Interactive elements are keyboard-navigable.
- **Cost efficiency:** Claude API calls occur only when the user explicitly clicks "Ask Claude to Explain." No background or automatic API usage.

---

## 9. State Machine

```
SETUP ──→ PLAYING (opening, ply < 8)
              │
              ├── player moves ──→ BOT_THINKING ──→ PLAYING (if still opening)
              │                                  ──→ GUESSING (if ply ≥ 8)
              │
              └── game over ──→ GAME_OVER

GUESSING ──→ (n guesses submitted) ──→ EVALUATING
EVALUATING ──→ RESULTS
RESULTS ──→ (optional: explain) ──→ PLAYING
PLAYING ──→ player moves ──→ BOT_THINKING ──→ GUESSING
                                            ──→ GAME_OVER
```

Valid `phase` values: `setup`, `playing`, `guessing`, `evaluating`, `results`, `bot-thinking`, `game-over`.

---

## 10. Key Implementation Details

### 10.1 SAN Normalization

When comparing player guesses against Stockfish output, strip check (`+`) and checkmate (`#`) symbols before comparison. Example: `Nf3+` and `Nf3` should match.

### 10.2 Promotion Handling

When a pawn reaches the 8th rank, show a promotion modal (Queen/Rook/Bishop/Knight) before registering the guess or executing the move. The promotion piece is included in the SAN (e.g., `e8=Q`).

### 10.3 Board Orientation

The board is always oriented with the player's color at the bottom. If playing Black, rank 8 is at the bottom and files are reversed (h→a left to right).

### 10.4 Move Recording

Maintain a move history array of `{num, white, black}` objects. If the player is Black and the game starts with White's move, the first entry has `white: "…"` as placeholder.

---

## 11. Future Considerations

- **Score tracking:** Running tally of match/miss rates across turns and sessions.
- **Puzzle mode:** Load specific positions (FEN) for targeted practice instead of full games.
- **Configurable opening skip:** Let the user set when evaluation begins (e.g. move 3, 5, or 10).
- **Inline engine option:** Built-in minimax engine for fully sandboxed environments.
- **Opening book integration:** Name the opening being played during the skip phase.
- **Difficulty presets:** Beginner / Intermediate / Advanced presets that configure depth and n together.
- **PGN export:** Export the completed game with guess annotations.
- **Drag-and-drop:** Support piece dragging in addition to click-click.
