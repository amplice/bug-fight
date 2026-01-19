# Server-Authoritative Bug Fights

## Problem

Currently everything runs in the browser. Each viewer sees different fights. No shared experience.

## Goal

- **Server** runs the simulation 24/7, is the source of truth
- **Clients** connect via WebSocket, receive state, render it
- Everyone sees the same fight at the same time
- Betting is per-user (server-tracked or local)

---

## Components

### 1. Game Server (Node.js)

```
/server
  index.js          - Main entry, WebSocket server
  simulation.js     - Game loop, fighter logic (port from game.js)
  state.js          - State management, what gets broadcast
```

- Runs game loop at 30fps (tick every 33ms)
- Broadcasts compressed state to all connected clients
- Handles countdown → fight → victory → next fight cycle
- Persists forever (pm2/systemd/docker)

### 2. Shared State Broadcast

Each tick, server sends:

```js
{
  phase: 'fighting',           // countdown | fighting | victory
  countdown: null,             // or number if in countdown
  tick: 184729,                // global tick for sync
  fighters: [
    { x, y, hp, maxHp, stamina, animFrame, state, tilt, ... },
    { x, y, hp, maxHp, stamina, animFrame, state, tilt, ... }
  ],
  bugs: [bug1Genome, bug2Genome],  // sent once at fight start
  events: [                    // one-shot events this tick
    { type: 'hit', x, y, damage },
    { type: 'commentary', text, color }
  ]
}
```

Clients render from this. Particles/effects generated client-side from events.

### 3. Client Changes

```
/js
  client.js         - WebSocket connection, receives state
  renderer.js       - Render logic (extracted from game.js)
  betting.js        - Local betting against shared fights
```

- No simulation logic, just rendering
- Interpolates between state updates for smooth animation
- Betting: place bets during countdown, resolve when server announces winner

### 4. Betting Options

**Option A: Local-only (simplest)**
- Balance in localStorage
- Client trusts server's winner announcement
- No accounts, no server-side tracking
- Can be "cheated" but who cares, it's fake money

**Option B: Server-tracked (more real)**
- Simple user sessions (cookie or localStorage token)
- Server tracks balances per session
- Bets submitted to server, resolved server-side
- Leaderboard possible

---

## Migration Steps

### Step 1: Extract simulation logic
Make game.js work in Node (no DOM/canvas dependencies). Split into:
- `Fighter.js` - Fighter class
- `BugGenome.js` - Bug generation (from procedural.js)
- `simulation.js` - Game loop, combat logic

### Step 2: Create WebSocket server
Node server that:
- Runs simulation in a loop
- Accepts WebSocket connections
- Broadcasts state to all clients every tick

### Step 3: Create thin client
Browser code that:
- Connects to WebSocket
- Receives state updates
- Renders based on received state
- Handles local betting UI

### Step 4: Deploy
- Run server process 24/7 on 142.93.44.112
- Use pm2 or systemd for process management
- Serve static files (nginx or Node)

### Step 5: Betting integration
- Wire up client betting to work with server-announced results
- Decide on Option A vs Option B

---

## Tech Stack

- **Server**: Node.js + `ws` (WebSocket library)
- **Client**: Vanilla JS (keep it simple)
- **Process manager**: pm2 or systemd
- **No database needed** initially (state is ephemeral, balances in localStorage)

---

## Target Directory Structure

```
/bugfights
  /server
    index.js
    simulation.js
    Fighter.js
    BugGenome.js
  /public
    index.html
    /css
      style.css
    /js
      client.js
      renderer.js
      betting.js
      procedural.js   (shared bug generation)
  package.json
```

---

## Bandwidth Estimate

- State size: ~1-2KB per tick
- Tick rate: 30fps
- Per client: ~30-60KB/s
- 100 viewers: ~3-6MB/s

Optimizations if needed:
- Reduce tick rate to 15-20fps, interpolate on client
- Delta compression (only send what changed)
- Binary encoding instead of JSON
