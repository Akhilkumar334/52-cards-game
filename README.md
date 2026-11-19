# 52 Cards Casino Games Suite

A production-grade, extensible card game platform built with pure TypeScript engines, deterministic seeded RNG, immutable state machines, and a luxury casino UI.

## Games Implemented

### 1. Bluff (I Doubt It / Cheat)
- Strict rank declaration and bluff challenges.
- In-turn and out-of-turn challenge mechanics.
- Invariant: 52 cards strictly conserved across hands, table pile, and discards.

### 2. Thulla / Bhabhi
- Authentic Indian trick-taking rules with Ace as the highest card in every suit (A=14).
- Penalty pickup animation and 1.5-second trick freeze on Thulla.
- 52-card conservation and deterministic simulation tests.

### 3. Seep (Sweep)
- Complete authentic Indian Seep implementation supporting 2, 3, and 4 players (4 players = 2 opposite partnerships).
- Exact 100-point accounting invariant:
  - 13 Spades score their face value ($1..13$, sum = 91).
  - 3 non-spade Aces score 1 point each (A♥, A♦, A♣ = 3).
  - 10 of Diamonds ($10♦$) scores 6 points.
  - Total card points per hand = strictly 100.
- Floor Partition Solver: Partitions floor items (loose cards + houses as atomic units) into subsets each summing to the card target value (e.g., $5+5$, $6+4$, $2+2+2+4$).
- Persistent Opening Bid Banner: Shows "Player X bid [value]" on the table until captured or hand completion.
- Seep Lifecycle & Takedowns:
  - Opening Seep (+25 pts) is permanent and can never be downed.
  - Later seeps (+25 pts each) capped at `maxAdditionalSeeps` (default 2).
  - Takedowns cancel active opponent seeps.
- **Compulsory Rules & Conflict Resolution**:
  - `takedownCompulsory`: If the opposing team holds an active, downable seep and the player can clear the entire floor, they must play the takedown move.
  - `firstSeepCompulsory`: If no seep has occurred yet and the player can clear the entire floor on their turn, they must play the seep move.
  - **Conflict Resolution**: *If two compulsory conditions conflict (both takedown and first seep apply simultaneously), takedown takes precedence over first seep.*

## Verification & Testing
- **Unit Tests**: Full coverage across rulesets, floor partition solver, move generation, and invariants.
- **Simulation Tests**: 1,000 complete bot-vs-bot games per player count (2, 3, and 4 players), asserting no crashes, termination, and exact 100 card points per hand.
- Run tests:
  ```bash
  npm test
  ```
- Run typecheck:
  ```bash
  npm run typecheck
  ```
- Run dev server:
  ```bash
  npm run dev
  ```
