# D&D Campaign Companion — Aethelgard

An interactive, real-time tabletop RPG campaign companion built for **Dungeon Masters (DMs)** and **Players**. Manage multi-layer realm, city, and interior tactical battle maps with Fog of War, D&D environment effect AoE tokens, per-character HP visibility and Damage/Heal combat logs, collapsible sidebars/headers, live multi-browser synchronization, dice rolling, combat initiative, session journals, and portable JSON campaign saves.

---

## Table of Contents

- [Features Summary](#features-summary)
- [Tech Stack](#tech-stack)
- [How to Host on Vercel](#how-to-host-on-vercel)
  - [1. Push to GitHub & Import to Vercel](#1-push-to-github--import-to-vercel)
  - [2. Enable Permanent Cloud Persistence (Upstash Redis / Vercel KV)](#2-enable-permanent-cloud-persistence-upstash-redis--vercel-kv)
  - [3. Optional Environment Variables](#3-optional-environment-variables)
  - [4. Vercel Notes & Limits](#4-vercel-notes--limits)
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
- **Dual Role Switcher (`🎭 DM View` / `🛡️ Player View`)**: Open the app in two browser tabs or on separate devices—one acting as DM and others as Players (`?role=player` or `?role=dm` also selects role per tab via `sessionStorage`).
- **Adaptive Sync Engine**:
  - **Local / Node Hosting**: Instant **WebSocket** synchronization (`/ws/campaign`).
  - **Vercel Serverless Hosting**: Automatically switches to clean **2.5-second HTTP polling** via `/api/health` + `/api/campaign` with zero WebSocket retry errors.
- **Live Sync Coverage**: Fog of War strokes, map pins, hidden/revealed POIs, `Follow DM` navigation across Realm → City → Interior → Battle Grid, tactical tokens, environment effects, HP visibility/logs, party stats, initiative order, dice logs, and journal notes.

### 2. Multi-Layer World, City & Interior Maps + Collapsible Panels
- **3-Tier Exploration Hierarchy**: Realm/Region maps → City/Town district maps → Building/Room Tactical Battle Grids.
- **20+ Realm Landmark Types & 15+ City Building Types** with DM pin placement, editing, and Fog of War at every layer.
- **Collapsible Sidebars & Top Bars**: Toggle the left Party sidebar, right Map/HUD inspector, and top header bars independently (`sessionStorage` persisted per browser) to maximize map viewing area—even when entering cities or tactical battle chambers.

### 3. Tactical Combat Grid (Up to 100×100) & Environment Effect Tokens
- **Configurable Grid**: Up to **100 × 100** cells, multiple sub-maps/floors per site, custom background upload, range ruler, and smooth pan/zoom.
- **D&D Environment Effects & Spell AoE Tokens**: Deploy translucent, layered AoE zones underneath character/monster tokens, complete with grid hover footprint preview, **5ft / 15ft / 25ft / 35ft** resizing, round duration counters (**Tick -1r All**), rule/save DC notes, and DM-only hidden trap mode:
  - *Poison Cloud*, *Burning Ground*, *Sleep Mist*, *Entangling Web*, *Darkness*, *Fog Cloud*, *Ice Slick*, *Acid Pool*, *Storm Arc*, *Healing Aura*, *Silence Zone*, plus custom presets.

### 4. HP Privacy (DM Only) & Persistent Damage/Heal Log
- **Per-Character & Per-Token HP Hiding**: Hide player, NPC, or monster HP from Player View while keeping it visible to the DM (`isHpHidden`), with individual and bulk toggles (`Hide Foes HP` / `Show All`).
- **Atomic HP Persistence & Combat Log**: Damage and heals update atomically via `/api/campaign/location/battlemap/token-hp`, persist alongside token movement without reverting, and record every change in the **Damage & Heal Log**.

### 5. Party Roster, Dice, Initiative, Journal & JSON Backups
- **Party Roster**: Manage heroes, custom portraits, stats, 5e status condition badges, and exhaustion (`0/6`).
- **Dice Roller & Initiative Tracker**: Shared roll feed, auto-sorted initiative turns/rounds, and inline HP adjustments.
- **Persistent Journal & Optional AI Voice**: Categorized notes (`quest`, `lore`, `session`, `loot`) and optional Gemini character dialogue/TTS via `/api/character/speak` (gracefully falls back to browser speech/quotes if `GEMINI_API_KEY` is unset).
- **Single-File JSON Save (`Export` / `Import`)**: Preserves maps, tokens, Fog of War, characters, notes, and embedded images.

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide Icons, Motion
- **Backend**: Express (`/server/app.ts`) running via Node + `ws` (`server.ts`) locally, or Vercel Serverless Functions (`/api/index.ts`) in cloud deployments
- **Persistence**: Local file (`campaign-data.json`) on PC/Node, **Upstash Redis / Vercel KV** on Vercel (with automatic `/tmp` fallback), plus portable JSON Export/Import
- **Optional AI**: `@google/genai` (only used when `GEMINI_API_KEY` is configured)

---

## How to Host on Vercel

This repository includes `vercel.json` and `api/index.ts`, so both the Vite React frontend (`dist/`) and the Express `/api/*` backend deploy together on **Vercel** with zero manual server setup.

### 1. Push to GitHub & Import to Vercel
1. Push this repository to **GitHub**, **GitLab**, or **Bitbucket**.
2. Log in to **[vercel.com](https://vercel.com)** and click **Add New… → Project**.
3. Import your repository. Vercel automatically detects `vercel.json`:
   - **Build Command**: `npm run build:vercel`
   - **Output Directory**: `dist`
   - **API Serverless Entry**: `api/index.ts` (handles `/api/*` and `/health`)
4. Click **Deploy**.

### 2. Enable Permanent Cloud Persistence (Upstash Redis / Vercel KV)
Because Vercel Serverless Functions have a read-only project filesystem and ephemeral `/tmp` storage across cold starts, **link an Upstash Redis store** so DM edits persist permanently and sync live across DM & Player browsers:

1. Open your project in the **Vercel Dashboard → Storage** (or **Integrations → Marketplace**).
2. Add **Upstash Redis** (free tier works great) and connect it to your Vercel project.
3. Vercel automatically injects `KV_REST_API_URL` and `KV_REST_API_TOKEN` (or `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`).
4. **Redeploy** once so the serverless functions pick up the new environment variables.
5. Open the **Campaign Save & Load Manager** in the app—it will display **`Synced via Vercel Redis / KV`** when active.

> **Using Vercel without Redis?** The app still runs safely using temporary `/tmp` storage without crashing; use **Export Save (.json)** at the end of a session so you can **Import Save (.json)** anytime.

### 3. Optional Environment Variables
In **Vercel Dashboard → Settings → Environment Variables**, you may optionally add:
- `GEMINI_API_KEY` — enables AI character dialogue & voice TTS (`/api/character/speak`).
- `CAMPAIGN_KV_KEY` — custom Redis key name if hosting multiple separate campaigns against one Redis database (defaults to `aethelgard:campaign_state:v1`).

### 4. Vercel Notes & Limits
- **Multi-Browser Sync**: On Vercel, the app automatically disables `/ws/campaign` WebSocket connections and polls `/api/campaign` every **2.5 seconds** while the browser tab is active.
- **Upload / Import Payload Limit**: Vercel Serverless Functions enforce a **4.5 MB** request body limit on `POST` calls (including `/api/campaign/import-data` and large embedded image uploads). Keep custom uploaded images under ~1–2 MB (the app auto-compresses large uploads to WebP) or link external HTTPS image URLs for very large campaign maps.

---

## How to Host on a PC

You can run this app locally on **Windows**, **macOS**, or **Linux** for solo prep or to host a live tabletop / LAN session with instant WebSocket sync and unlimited local JSON file storage.

### 1. Prerequisites
- **[Node.js](https://nodejs.org/) v20+** (LTS recommended, includes `npm`)
- **[Git](https://git-scm.com/)** (optional, if cloning from GitHub)

Verify installation in your terminal / PowerShell:
```bash
node -v
npm -v
```

### 2. Download & Install
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

Edit `.env` and set:
```env
GEMINI_API_KEY="your_gemini_api_key_here"
```

> **Note:** Never commit `.env` or personal secrets to GitHub (`.gitignore` excludes `.env*`).

### 4. Run in Development Mode
Starts the Express API, WebSocket sync server, and Vite frontend together on **port 3000**:

```bash
npm run dev
```

Open your browser to `http://localhost:3000`.

### 5. Run in Production Mode
Build the frontend and Node server bundle first, then start Node directly:

```bash
npm run build
npm start
```

By default, the server listens on `0.0.0.0:3000`. You can customize the host or port:
```bash
node dist/server.cjs --port 8080 --host 0.0.0.0
```

### 6. Multi-Browser & LAN Hosting (DM + Players)

#### Option A: Two Windows on the Same PC (Monitor + TV / Projector)
1. Start the server (`npm run dev` or `npm start`).
2. Open `http://localhost:3000` in **Window 1** (**🎭 DM View**).
3. Open `http://localhost:3000?role=player` in **Window 2** (or switch to **🛡️ Player View**).
4. Keep **📡 Follow DM: ON** enabled in Player View to mirror maps, cities, battle chambers, Fog of War, tokens, and environment effects live.

#### Option B: Separate Laptops / Tablets on Home Wi-Fi (LAN)
1. Find the host PC's local IPv4 address (`ipconfig` on Windows, `ifconfig` / `ip addr` on macOS/Linux).
2. Allow **TCP Port 3000** through your OS firewall if prompted.
3. Keep the DM screen open at `http://localhost:3000` (**🎭 DM View**).
4. Have Players open `http://<HOST_IP>:3000` on their devices and select **🛡️ Player View**.

---

## Saving, Exporting & Importing Campaigns

- **Local PC**: Auto-saves to `campaign-data.json` in the project root.
- **Vercel**: Auto-saves to **Upstash Redis / Vercel KV** when configured (or temporary `/tmp` storage otherwise).
- **Export Save (JSON)**: Downloads a complete `.json` snapshot of your campaign, including maps, tokens, environment effects, Fog of War, HP logs, notes, and embedded images.
- **Import Save (JSON)**: Restores a campaign snapshot from file or clipboard text.

---

## Project Structure

```text
├── vercel.json                # Vercel build config, function bundling & SPA/API rewrites
├── api/
│   └── index.ts               # Vercel Serverless Function entry wrapping Express API
├── server.ts                  # Local Node/AI Studio entry (Express + WebSockets + Vite/static)
├── server/
│   └── app.ts                 # Shared Express API routes + file / Vercel /tmp / KV persistence
├── campaign-data.json         # Local persistent campaign database & optional initial seed
├── index.html                 # HTML entry point & typography
├── vite.config.ts             # Vite + Tailwind CSS v4 configuration
├── package.json               # Scripts (dev, build, build:vercel, start, lint)
├── .env.example               # Environment variable template
└── src/
    ├── App.tsx                # Layout, adaptive WS/polling sync, party sidebar, HP/status, journal
    ├── types.ts               # Shared TypeScript interfaces for maps, tokens, effects, fog & logs
    ├── utils/
    │   ├── fogOfWar.ts        # Fog of War visibility & stroke geometry helpers
    │   └── imageUtils.ts      # Image compression & campaign media extraction
    └── components/
        ├── MapInterface.tsx       # Realm/City/POI map canvas, pan/zoom, DM controls, LiveView sync
        ├── SiteBattleMapModal.tsx # Tactical grid (up to 100x100), tokens, D&D Env Effects, HP log
        ├── FogOfWarOverlay.tsx    # Interactive Fog of War SVG mask & DM reveal/hide brush overlay
        ├── DiceRoller.tsx         # Polyhedral & character-stat dice roller
        ├── InitiativeOrder.tsx    # Turn/round combat tracker with auto-sorting & HP adjustments
        └── StandaloneModal.tsx    # Campaign JSON export/import & persistence status modal
```

---

## Troubleshooting

- **Vercel shows changes resetting or not syncing between browsers**: Link **Upstash Redis** in **Vercel Dashboard → Storage** so `KV_REST_API_URL` and `KV_REST_API_TOKEN` are present, then redeploy. Without Redis, Vercel falls back to per-instance `/tmp` storage.
- **413 Payload Too Large when importing JSON on Vercel**: Vercel Serverless Functions limit request bodies to **4.5 MB**. Compress embedded map images or host large background images via HTTPS URLs instead of base64.
- **Port 3000 already in use locally**: Run `node dist/server.cjs --port 3001`.
- **Players on Wi-Fi cannot connect locally**: Ensure both devices are on the same network, use `http://<IPv4>:3000`, and allow Node.js through your firewall.
- **Typecheck & Build verification**:
  ```bash
  npm run lint
  npm run build
  npm run build:vercel
  ```
