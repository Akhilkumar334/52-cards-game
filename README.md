# 52 Cards Casino Games Suite & Multiplayer Arena

A production-grade, extensible card game platform built with pure TypeScript engines, deterministic seeded RNG, immutable state machines, luxury casino felt UI, heuristics AI bots, and real-time multiplayer room networking.

---

## 🎮 Games Implemented

### 1. Bluff (Cheat / I Doubt It / 420)
- **Authentic Mechanics**: Place cards face-down, declare their rank, and challenge opponent claims.
- **Rule Variants**: Classic Indian Bluff (`tableClearOnAllPass`) and Sequential Rank Cycle ($A \dots K$).
- **Multiplayer**: Supports 2, 3, or 4 players with real-time synchronized card flight animations and eating/penalty pickup sequences.
- **Invariant**: Strict 52-card conservation across hands, center pile, and discard pile.

### 2. Thulla / Bhabhi (Get Away)
- **Authentic Indian Trick-Taking Rules**: Ace is highest card ($A=14$).
- **Penalty Pickup & Slaps**: Must strictly follow suit; if void, slap a devastating Thulla onto the trick leader.
- **Multi-Escape Tracking**: Players escape as they shed their cards until a single loser (the *Bhabhi*) remains.

### 3. Seep (Sweep / 100 Points)
- **Complete Authentic Indian Seep**: Supports 2, 3, and 4 players (4 players = compulsory 2v2 partnership).
- **Exact 100-Point Accounting Invariant**:
  - 13 Spades score face value ($1 \dots 13$, sum = 91).
  - 3 non-spade Aces score 1 point each (A♥, A♦, A♣ = 3).
  - 10 of Diamonds ($10♦$ *Bada Patta*) scores 6 points.
  - *Strict round invariant: exactly 100 card points per hand.*
- **Floor Partition Solver**: Backtracking solver with branch pruning to partition floor items into valid capture subsets.
- **Houses & Sweeps**: Build and cement houses (9–13), score sweeps (+25/+50), and compulsory takedown mechanics.

---

## 🌐 Real-Time Multiplayer Architecture

- **Landing Page**: Choose between Bluff, Thulla, or Seep, and select **Play with Bots** or **Create Room**.
- **Deferred Room Code Generation**: Room codes are generated dynamically upon table creation.
- **Waiting Room Lobby**: Room code sharing, seat claiming, live chat, and activity logs.
- **Empty Slot Resolution**:
  - **Seep**: Strictly enforces 4 players (2v2 partnership), prompting to fill empty slots with bots when starting.
  - **Bluff & Thulla**: Allows starting with current players only (2 or 3 players without bots) or filling empty seats with bots.
- **Hybrid Transport**:
  - **Local Multi-Tab**: Browser-native `BroadcastChannel` with `localStorage` backup (zero latency, zero config).
  - **LAN & Cross-Device**: Built-in RFC 6455 WebSocket relay server (`/cards-ws`).

---

## 🚀 Running Locally

```bash
# Install dependencies
npm install

# Start Vite dev server (frontend + websocket relay)
npm run dev

# Run full Vitest test suite (93 unit & simulation tests)
npm test

# Run TypeScript typechecks
npm run typecheck

# Build for production
npm run build

# Start production Node.js server (serves frontend + websockets on same port)
npm start
```

---

## ☁️ Deployment

The project includes a unified production server (`server.js`) that serves both the compiled React frontend and the real-time WebSocket room relay on the same port (`PORT = process.env.PORT || 3000`).

### Deploy to Render (Recommended for Free Full-Stack WebSockets)
1. Push this repository to GitHub.
2. Go to [render.com](https://render.com) &rarr; **New Web Service**.
3. Connect your GitHub repository.
4. Set the following:
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`
5. Click **Create Web Service**. Your game is live with full WebSocket multiplayer!

### Deploy to Railway
1. Push to GitHub.
2. In Railway, click **New Project** &rarr; **Deploy from GitHub repo**.
3. Railway automatically detects `npm run build` and `npm start` and provisions a public HTTPS/WSS URL.
