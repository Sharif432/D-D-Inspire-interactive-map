# D&D Campaign Companion — Aethelgard

An interactive, real-time tabletop RPG campaign companion built for **Dungeon Masters (DMs)** and **Players**. Manage multi-layer realm, city, and interior tactical battle maps with Fog of War, track party HP/status effects/exhaustion, sync multiple browsers live over WebSockets, roll dice, run combat initiative, keep session journals, and back up entire campaigns (including embedded images) as portable JSON saves.

---

## Table of Contents

- [Features Summary](#features-summary)
- [Tech Stack](#tech-stack)
- [How to Host on a PC](#how-to-host-on-a-pc)
  - [1. Prerequisites](#1-prerequisites)
  - [2. Download & Install](#2-download--install)
  - [3. Environment Variables (Optional)](#3-environment-variables-optional)
  - [4. Run in Development Mode](#4-run-in-development-mode)
  - [5. Run in Production Mode](#5-run-in-production-mode)
  - [6. Multi-Browser & LAN Hosting (DM + Players)](#6-multi-browser--lan-hosting-dm--players)
- [Saving, Exporting & Importing Campaigns](#saving-exporting--importing-campaigns)
- [Project Structure](#project-structure)
- [Troubleshooting](#troubleshooting)

---

## Features Summary

### 1. Real-Time Multi-Browser DM & Player Sync
- **Dual Role Switcher (`🎭 DM View` / `🛡️ Player View`)**: Open the app in two browser tabs or on two separate devices on the same network—one acting as DM and others as Players.
- **Live WebSocket Synchronization (`/ws/campaign`)**: All updates made by the DM propagate immediately to Player browsers, including:
  - Fog of War brush reveals and hides across every map layer
  - Map pins, landmarks, hidden/revealed status, and party travel position
  - Active map navigation (`Follow DM` toggle automatically moves Player screens across Realm → City → Tavern/Interior → Battle Grid)
  - Tactical battle map grid settings, combat tokens, and token HP
  - Party roster, HP, status effects, exhaustion levels, initiative order, dice logs, and journal notes

### 2. Multi-Layer World, City & Interior Maps
- **3-Tier Exploration Hierarchy**:
  1. **Realm / Region Maps** (e.g., *The Sword Coast*, *The Underdark*) with connected travel routes and party marker tracking.
  2. **City / Town Maps**: Drill down into settlements to view district maps and place-of-interest pins.
  3. **Interior & Tactical Battle Maps**: Entering a tavern, shop, or dungeon room opens the tactical combat grid with tokens ready to position and move.
- **20+ Realm Landmark Types & 15+ City Building Types**: Supports `town`, `village`, `dungeon`, `forest`, `ruins`, `castle`, `castle_wall`, `fortress`, `harbour`, `tower`, `bridge`, `camp`, `temple`, `market`, `mountain`, `swamp`, `desert`, `lake`, `cave`, `shrine`, plus city POIs (`tavern`, `shop`, `guild`, `temple`, `residence`, `civic`, `ruin`, `harbour`, `castle_wall`, `barracks`, `market`, `stable`, `smith`, `library`, `prison`).
- **DM Pin Placement & Editing Everywhere**: Create, edit, and reposition pins directly on Realm, City, and Interior maps with compact pin sizing so markers do not obscure artwork.
- **Unified Pan & Zoom**: Smooth drag-to-pan and mouse-wheel / pinch zoom across all map views (inline realm/city views, expanded Big Map, interior rooms, and the tactical battle grid), with responsive layout sizing matched to your viewport so you do not need to scroll to reach controls.

### 3. Tactical Combat Grid (Up to 100×100)
- **Editable Grid Dimensions**: Configure tactical battle grids up to **100 × 100** cells, customize grid line visibility and color, and manage multiple floor/sub-map levels per location or building.
- **Token Management**: Spawn party heroes, enemies, or custom NPCs onto the grid, drag/move tokens, track token HP, and customize token colors and notes.

### 4. Fog of War (All Map Layers)
- **DM-Controlled Brush Tools**: Toggle Fog of War per map and paint **Reveal** or **Hide** strokes across **Region**, **City**, **Building**, and **Interior Battle Maps**.
- **Player Isolation**: Players see only revealed areas. Hidden realm nodes and hidden city POIs remain invisible to Player View until revealed by the DM or uncovered from fog.

### 5. Secret / Hidden Places of Interest
- **DM-Only Visibility Controls**: Mark realm locations or city Places of Interest (taverns, shops, secret rooms, hideouts) as **Hidden/Secret** on creation, in the Edit modal, via 1-click inspector/HUD toggles, or from the DM **Secret POIs Roster** (`Reveal All` / `Hide All`).
- Players cannot see secret locations until the DM chooses to reveal them (e.g., once discovered or shared in-story).

### 6. Party Roster, Status Effects & Exhaustion Tracker
- **Character Management**: Add, edit, and remove party members (with custom portraits/avatars, stats, HP, level, race, class, and voice).
- **Quick-Add Status Effects**: One-click toggle badges displayed directly beneath each character's HP bar, supporting common 5e conditions (`Poisoned`, `Prone`, `Stunned`, `Blinded`, `Charmed`, `Frightened`, `Grappled`, `Paralyzed`, `Restrained`, `Incapacitated`, `Invisible`, `Concentrating`) plus custom conditions.
- **Exhaustion Tracker**: Interactive `0/6` exhaustion level controls per character in the sidebar.

### 7. Dice Roller, Initiative Order & Campaign Journal
- **Stats-Aware Dice Roller**: Roll standard polyhedral dice (`d4`–`d100`) and character ability/skill checks, logging shared results to the campaign feed.
- **Initiative Tracker**: Import party heroes or spawn enemies/NPCs, auto-sort descending (with DEX modifier tie-breakers), advance rounds/turns, adjust HP inline, and clear encounters safely.
- **Persistent Journal**: Categorized notes (`quest`, `lore`, `session`, `loot`) with author attribution and live sync.
- **Optional AI Character Dialogue**: If a `GEMINI_API_KEY` is configured, characters can generate voiced/in-character lines via `/api/campaign/character/speak` (falls back gracefully without an API key).

### 8. Portable JSON Export & Import (With Embedded Images)
- **Single-File JSON Save (`GET /api/campaign/export-data` & `POST /api/campaign/import-data`)**: Export the entire campaign state—regions, locations, city POIs, interiors, tokens, Fog of War strokes, characters, notes, initiative, and dice history—to a `.json` file.
- **Automatic Image Reuse**: Uploaded/embedded custom maps and portraits are stored inside the save payload and indexed into the campaign media library on import, so you can reuse existing artwork without manually re-uploading every image.

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide Icons, Motion
- **Backend**: Node.js, Express, `ws` (WebSocket server), Vite (dev middleware & production bundling)
- **Persistence**: Local file storage (`campaign-data.json`) + JSON Export/Import
- **Optional AI**: `@google/genai` (only used when `GEMINI_API_KEY` is set)

---

## How to Host on a PC

You can run this app locally on **Windows**, **macOS**, or **Linux** for solo prep or to host a live tabletop / LAN session for players.

### 1. Prerequisites
- **[Node.js](https://nodejs.org/) v20+** (LTS recommended, includes `npm`)
- **[Git](https://git-scm.com/)** (optional, if cloning from GitHub)

Verify installation in your terminal / PowerShell:
```bash
node -v
npm -v
```

### 2. Download & Install
Clone your GitHub repository (or extract the project folder) and install dependencies:

```bash
git clone <your-repo-url>
cd <repo-folder>
npm install
```

### 3. Environment Variables (Optional)
The app works out of the box **without** any API keys. If you want optional Gemini character dialogue generation, copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env` and add your key:
```env
GEMINI_API_KEY="your_gemini_api_key_here"
```

> **Note:** Never commit `.env` or personal secrets to GitHub (`.gitignore` already excludes `.env*`).

### 4. Run in Development Mode
Starts the Express API, WebSocket sync server, and Vite frontend together on **port 3000**:

```bash
npm run dev
```

Open your browser to:
- **Local PC:** `http://localhost:3000`

### 5. Run in Production Mode (Recommended for Game Sessions)
For faster page loads and lower CPU usage during long sessions, build the frontend and server bundle first, then start Node directly:

```bash
npm run build
npm start
```

By default, the server listens on `0.0.0.0:3000`. You can customize the host or port using CLI flags or `DEFAULT_APP_PORT`:

```bash
# Example: run on port 8080
node dist/server.cjs --port 8080 --host 0.0.0.0
```
Or in dev mode:
```bash
npx tsx server.ts --port 8080 --host 0.0.0.0
```

### 6. Multi-Browser & LAN Hosting (DM + Players)

#### Option A: Two Windows on the Same PC (e.g., Monitor + TV / Projector)
1. Start the server (`npm run dev` or `npm start`).
2. Open `http://localhost:3000` in **Window 1** and keep **🎭 DM View** selected.
3. Open `http://localhost:3000` in **Window 2** (drag it to a TV/second screen or use a separate browser profile/incognito window) and switch it to **🛡️ Player View**.
4. Leave **📡 Follow DM: ON** enabled in Player View so map changes, city drills, rooms, battle grids, Fog of War, and tokens mirror live.

#### Option B: Separate Laptops / Tablets on Home Wi-Fi (LAN)
Because the server binds to `0.0.0.0`, other devices on the same Wi-Fi/router can connect directly to the host PC:
1. Find the host PC's local IPv4 address:
   - **Windows (Command Prompt / PowerShell):** `ipconfig` (look for `IPv4 Address`, e.g. `192.168.1.42`)
   - **macOS / Linux:** `ifconfig` or `ip addr`
2. Allow **TCP Port 3000** through your OS firewall if prompted (Windows Defender Firewall → Allow private network access for Node.js).
3. Keep the DM screen open at `http://localhost:3000` (**🎭 DM View**).
4. Have Players open `http://<HOST_IP>:3000` (for example, `http://192.168.1.42:3000`) on their laptops/tablets and select **🛡️ Player View**.

---

## Saving, Exporting & Importing Campaigns

- **Auto-Save**: Changes automatically persist to `campaign-data.json` in the project root directory.
- **Export Save (JSON)**: Click **Export Save (JSON)** in the app to download a complete `.json` snapshot of your campaign, including embedded map and character images.
- **Import Save (JSON)**: Click **Import Save (JSON)** to restore a campaign on any PC; embedded images are preserved and added to the campaign's reusable media library.
- **GitHub Tip**: If `campaign-data.json` contains your private campaign notes or large base64 images, consider adding `campaign-data.json` to `.gitignore` or committing a clean starter template.

---

## Project Structure

```text
├── server.ts                  # Express REST API, WebSocket sync (/ws/campaign), Vite/static hosting
├── campaign-data.json         # Local persistent campaign database (auto-updated)
├── index.html                 # HTML entry point & typography
├── vite.config.ts             # Vite + Tailwind CSS v4 configuration
├── package.json               # Scripts (dev, build, start, lint) & dependencies
├── .env.example               # Environment variable template
└── src/
    ├── App.tsx                # Main layout, party sidebar, status/exhaustion controls, JSON export/import
    ├── types.ts               # Shared TypeScript interfaces for campaign state, maps, fog & sync
    ├── utils/
    │   ├── fogOfWar.ts        # Fog of War visibility & point-in-stroke geometry helpers
    │   └── imageUtils.ts      # Embedded image extraction & media asset indexing
    └── components/
        ├── MapInterface.tsx       # Realm/City/POI map canvas, pan/zoom, DM secret controls, LiveView sync
        ├── SiteBattleMapModal.tsx # Tactical combat grid (up to 100x100), tokens, interiors & sub-maps
        ├── FogOfWarOverlay.tsx    # Interactive Fog of War SVG mask & DM reveal/hide brush overlay
        ├── DiceRoller.tsx         # Polyhedral & character-stat dice roller
        ├── InitiativeOrder.tsx    # Turn/round combat tracker with auto-sorting & HP adjustments
        └── StandaloneModal.tsx    # Campaign setup / export modal helpers
```

---

## Troubleshooting

- **Port 3000 already in use**: Run with another port: `node dist/server.cjs --port 3001` (or stop the existing Node process using port 3000).
- **Players on Wi-Fi cannot connect**: Ensure both devices are on the same local network, use the host PC's `http://<IPv4>:3000` (not `localhost`), and allow Node.js through your PC's firewall on port 3000.
- **Player tab didn't follow a map switch**: Check that the Player browser has **🛡️ Player View** selected and **📡 Follow DM: ON** enabled in the map toolbar.
- **WebSocket errors in browser console during dev**: HMR is optionally disabled via `DISABLE_HMR=true` in certain hosted environments; campaign synchronization uses `/ws/campaign` directly and continues working normally.
- **Typecheck & Build verification**:
  ```bash
  npm run lint
  npm run build
  ```
