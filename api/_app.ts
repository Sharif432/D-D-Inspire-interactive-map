import express, { Express, Request, Response, NextFunction } from "express";
import path from "path";
import fs from "fs";
import zlib from "zlib";
import type { GoogleGenAI } from "@google/genai";
import type {
  CampaignState,
  JournalNote,
  CampaignLocation,
  Character,
  DiceRollResult,
  LiveViewState,
  CombatHpLogEntry
} from "../src/types.js";

export const IS_VERCEL =
  Boolean(process.env.VERCEL) ||
  Boolean(process.env.VERCEL_ENV) ||
  Boolean(process.env.VERCEL_URL);

const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";
export const HAS_KV_STORAGE = Boolean(KV_URL && KV_TOKEN);
const KV_STATE_KEY = process.env.CAMPAIGN_KV_KEY || "aethelgard:campaign_state:v1";
const KV_LIVE_KEY = `${KV_STATE_KEY}:live`;

const BUNDLED_CAMPAIGN_FILE = path.join(process.cwd(), "campaign-data.json");
const TMP_CAMPAIGN_FILE = "/tmp/aethelgard-campaign-data.json";
const ACTIVE_FILE_PATH = IS_VERCEL ? TMP_CAMPAIGN_FILE : BUNDLED_CAMPAIGN_FILE;

export type PersistenceBackend = "kv" | "tmp" | "file";

export function getPersistenceBackend(): PersistenceBackend {
  if (HAS_KV_STORAGE) return "kv";
  if (IS_VERCEL) return "tmp";
  return "file";
}

// Default D&D Campaign State
export const defaultCampaignState: CampaignState = {
  currentRegionId: "sword_coast",
  partyLocationId: "phandalin",
  regions: [
    {
      id: "sword_coast",
      name: "The Sword Coast",
      description:
        "A rugged region of Northern Faerûn featuring majestic trade-cities, ancient ruins, and dense untamed wilderness.",
      backgroundUrl:
        "https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&q=80&w=1200"
    },
    {
      id: "underdark",
      name: "The Underdark",
      description:
        "A vast subterranean wonderland of hazard and mystery, lit by phosphorescent fungi and deep bioluminescence.",
      backgroundUrl:
        "https://images.unsplash.com/photo-1507163011986-e3d1796fd042?auto=format&fit=crop&q=80&w=1200"
    }
  ],
  locations: [
    {
      id: "neverwinter",
      name: "City of Neverwinter",
      description:
        "A bustling metropolis rising from the ashes of destruction, now a major hub of civilizations.",
      type: "town",
      x: 15,
      y: 20,
      isHidden: false,
      isDiscovered: true,
      connectedTo: ["neverwinter_wood", "high_road"],
      dangerLevel: 1,
      cityMapImageUrl:
        "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80&w=1200",
      cityBuildings: [
        {
          id: "moonstone_mask",
          name: "The Moonstone Mask Inn & Tavern",
          description:
            "Neverwinter's most famous roadhouse and tavern, floating above the harbor. Renowned for its masked clientele and spiced mulled wine.",
          type: "tavern",
          x: 42,
          y: 38,
          imageUrl:
            "https://images.unsplash.com/photo-1543007630-9710e4a00a20?auto=format&fit=crop&q=80&w=1200",
          interiorMaps: [
            {
              id: "map_moonstone_taproom",
              locationId: "neverwinter",
              name: "Moonstone Mask - Grand Taproom & Hearth",
              description:
                "The floating main lounge with mahogany tables, crystal chandeliers, and a lavish bar.",
              imageUrl:
                "https://images.unsplash.com/photo-1543007630-9710e4a00a20?auto=format&fit=crop&q=80&w=1200",
              gridCols: 14,
              gridRows: 10,
              showGrid: true,
              tokens: []
            },
            {
              id: "map_moonstone_suites",
              locationId: "neverwinter",
              name: "Moonstone Mask - Second Floor Suites",
              description:
                "Private meeting rooms and guest chambers overlooking Neverwinter Bay.",
              imageUrl:
                "https://images.unsplash.com/photo-1590402494682-cd3fb53b1f70?auto=format&fit=crop&q=80&w=1200",
              gridCols: 12,
              gridRows: 8,
              showGrid: true,
              tokens: []
            }
          ]
        },
        {
          id: "beached_leviathan",
          name: "The Beached Leviathan Tavern",
          description:
            "A boisterous seaside tavern constructed from the hull of a stranded pirate galleon. Filled with sailors and treasure hunters.",
          type: "tavern",
          x: 28,
          y: 72,
          imageUrl:
            "https://images.unsplash.com/photo-1572116469696-31de0f17cc34?auto=format&fit=crop&q=80&w=1200",
          interiorMaps: [
            {
              id: "map_leviathan_deck",
              locationId: "neverwinter",
              name: "Beached Leviathan - Ship Deck Bar",
              description:
                "The weather-beaten wooden deck converted into a bustling taproom.",
              imageUrl:
                "https://images.unsplash.com/photo-1584968153986-3fbae48835a7?auto=format&fit=crop&q=80&w=1200",
              gridCols: 14,
              gridRows: 9,
              showGrid: true,
              tokens: []
            }
          ]
        },
        {
          id: "castle_never",
          name: "Castle Never (Lord's Enclave)",
          description:
            "The grand fortress of Lord Protector Dagult Neverember, towering proudly over the city.",
          type: "civic",
          x: 65,
          y: 28,
          imageUrl:
            "https://images.unsplash.com/photo-1584968153986-3fbae48835a7?auto=format&fit=crop&q=80&w=1200"
        },
        {
          id: "hall_of_justice",
          name: "Hall of Justice (Temple of Tyr)",
          description:
            "A colossal white marble temple dedicated to Tyr, God of Justice. Serves as city court and defensive redoubt.",
          type: "temple",
          x: 74,
          y: 55,
          imageUrl:
            "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&q=80&w=1200"
        },
        {
          id: "shining_serpent",
          name: "The Shining Serpent Curios & Alchemy",
          description:
            "An eccentric herbalist and potion shoppe run by a retired elven mage.",
          type: "shop",
          x: 52,
          y: 60,
          imageUrl:
            "https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&q=80&w=1200"
        }
      ]
    },
    {
      id: "neverwinter_wood",
      name: "Neverwinter Wood",
      description:
        "A dark, dense forest filled with fey beings, goblins, and ancient magical ruins.",
      type: "forest",
      x: 35,
      y: 28,
      isHidden: false,
      isDiscovered: true,
      connectedTo: ["neverwinter", "cragmaw_castle", "conyberry"],
      dangerLevel: 2
    },
    {
      id: "cragmaw_castle",
      name: "Cragmaw Castle",
      description:
        "A ruined stronghold claimed by the Cragmaw goblin tribe to ambush travelers along the Triboar trail.",
      type: "ruins",
      x: 48,
      y: 18,
      isHidden: false,
      isDiscovered: false,
      connectedTo: ["neverwinter_wood", "phandalin"],
      dangerLevel: 3
    },
    {
      id: "phandalin",
      name: "Phandalin Frontier Town",
      description:
        "A rough-and-tumble frontier town built on the ruins of a historic settlement. Safe haven for adventurers.",
      type: "town",
      x: 42,
      y: 65,
      isHidden: false,
      isDiscovered: true,
      connectedTo: ["cragmaw_castle", "wave_echo_cave", "high_road", "redbrand_hideout"],
      dangerLevel: 1,
      cityMapImageUrl:
        "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80&w=1200",
      cityBuildings: [
        {
          id: "stonehill_inn",
          name: "Stonehill Inn & Tavern",
          description:
            "A comfortable, two-story stone-and-timber roadhouse. The hearth is warm, the ale is hearty, and adventurers gather here to trade rumors.",
          type: "tavern",
          x: 48,
          y: 52,
          imageUrl:
            "https://images.unsplash.com/photo-1543007630-9710e4a00a20?auto=format&fit=crop&q=80&w=1200",
          interiorMaps: [
            {
              id: "map_stonehill_taproom",
              locationId: "phandalin",
              name: "Stonehill Inn - Main Taproom & Hearth",
              description:
                "The ground floor taproom of the Stonehill Inn. Sturdy oak tables, a crackling stone fireplace, and a lively bar.",
              imageUrl:
                "https://images.unsplash.com/photo-1543007630-9710e4a00a20?auto=format&fit=crop&q=80&w=1200",
              gridCols: 14,
              gridRows: 10,
              showGrid: true,
              tokens: []
            },
            {
              id: "map_stonehill_cellar",
              locationId: "phandalin",
              name: "Stonehill Inn - Wine Cellar & Storeroom",
              description:
                "Underground cold storage for casks of Dwarven Stout and provisions.",
              imageUrl:
                "https://images.unsplash.com/photo-1590402494682-cd3fb53b1f70?auto=format&fit=crop&q=80&w=1200",
              gridCols: 12,
              gridRows: 8,
              showGrid: true,
              tokens: []
            }
          ]
        },
        {
          id: "townmasters_hall",
          name: "Townmaster's Hall",
          description:
            "A sturdy stone building with a small bell tower. Harbin Wester holds court here and posts bounties for goblin raiders.",
          type: "civic",
          x: 68,
          y: 35,
          imageUrl:
            "https://images.unsplash.com/photo-1584968153986-3fbae48835a7?auto=format&fit=crop&q=80&w=1200"
        },
        {
          id: "barthens_provisions",
          name: "Barthen's Provisions",
          description:
            "The biggest general trading post in Phandalin, stocking adventuring gear, rations, and mining supplies.",
          type: "shop",
          x: 32,
          y: 40,
          imageUrl:
            "https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&q=80&w=1200"
        },
        {
          id: "sleeping_giant",
          name: "Sleeping Giant Taphouse",
          description:
            "A rundown, rowdy alehouse at the eastern end of town. Frequented by rough miners and Redbrand thugs.",
          type: "tavern",
          x: 82,
          y: 68,
          imageUrl:
            "https://images.unsplash.com/photo-1572116469696-31de0f17cc34?auto=format&fit=crop&q=80&w=1200"
        },
        {
          id: "tresendar_manor",
          name: "Tresendar Manor (Ruins)",
          description:
            "An abandoned manor perched on the eastern hillside. Ancient cellars are rumored to delve deep underground.",
          type: "ruin",
          x: 85,
          y: 22,
          imageUrl:
            "https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&q=80&w=1200"
        },
        {
          id: "shrine_of_luck",
          name: "Shrine of Luck (Tymora)",
          description:
            "Phandalin's only temple, constructed of stones taken from ancient ruins. Tended by Sister Garaele.",
          type: "temple",
          x: 24,
          y: 62,
          imageUrl:
            "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&q=80&w=1200"
        }
      ]
    },
    {
      id: "redbrand_hideout",
      name: "Redbrand Hideout",
      description:
        "The cellars underneath Tresendar Manor, currently used as a base of operations by the Redbrand ruffians.",
      type: "dungeon",
      x: 35,
      y: 78,
      isHidden: true,
      isDiscovered: false,
      connectedTo: ["phandalin"],
      dangerLevel: 2
    },
    {
      id: "wave_echo_cave",
      name: "Wave Echo Cave",
      description:
        "The fabled lost mine of Phandelver, rich with magical ores and defended by the sinister Black Spider.",
      type: "cave",
      x: 65,
      y: 75,
      isHidden: false,
      isDiscovered: false,
      connectedTo: ["phandalin", "underdark_passage"],
      dangerLevel: 4
    },
    {
      id: "conyberry",
      name: "Ruins of Conyberry",
      description:
        "A completely abandoned village reclaimed by overgrowth. Home to Agatha the banshee's grove.",
      type: "ruins",
      x: 75,
      y: 35,
      isHidden: false,
      isDiscovered: false,
      connectedTo: ["neverwinter_wood"],
      dangerLevel: 3
    },
    {
      id: "high_road",
      name: "The High Road Coastline",
      description:
        "The coastal trading highway stretching south, with sea breezes and rocky cliffs prone to bandit raids.",
      type: "shrine",
      x: 12,
      y: 50,
      isHidden: false,
      isDiscovered: true,
      connectedTo: ["neverwinter", "phandalin"],
      dangerLevel: 2
    },
    {
      id: "underdark_passage",
      name: "The Shadow Portal",
      description:
        "A glowing crevasse in Wave Echo Cave descending deep into the subterranean caverns.",
      type: "shrine",
      x: 88,
      y: 85,
      isHidden: false,
      isDiscovered: false,
      connectedTo: ["wave_echo_cave", "gracklstagh"],
      dangerLevel: 4
    },
    {
      id: "gracklstagh",
      name: "Gracklstagh (City of Blades)",
      description:
        "A massive subterranean city of the Duergar dwarfs, filled with smelting smoke and continuous anvil hammers.",
      type: "castle",
      x: 30,
      y: 45,
      isHidden: false,
      isDiscovered: false,
      connectedTo: ["underdark_passage", "sloopidoop", "hidden_shrine"],
      dangerLevel: 4
    },
    {
      id: "sloopidoop",
      name: "Sloobludop Outpost",
      description:
        "A kuo-toan settlement built on the edges of the Darklake, worshiping the bizarre water god Demogorgon.",
      type: "cave",
      x: 70,
      y: 55,
      isHidden: false,
      isDiscovered: false,
      connectedTo: ["gracklstagh"],
      dangerLevel: 3
    },
    {
      id: "hidden_shrine",
      name: "Shrine of the Lolth",
      description:
        "A hidden arachnid cathedral, pulsing with violet light, sacred to the Spider Queen.",
      type: "shrine",
      x: 45,
      y: 20,
      isHidden: true,
      isDiscovered: false,
      connectedTo: ["gracklstagh"],
      dangerLevel: 5
    }
  ],
  characters: [
    {
      id: "dm",
      name: "Dungeon Master",
      race: "Ancient One",
      className: "Storyteller",
      level: 20,
      hp: { current: 1000, max: 1000 },
      stats: {
        strength: 18,
        dexterity: 18,
        constitution: 18,
        intelligence: 20,
        wisdom: 20,
        charisma: 20
      },
      voice: "Charon",
      avatarUrl:
        "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=200"
    },
    {
      id: "valerius",
      name: "Valerius Stoneforge",
      race: "Mountain Dwarf",
      className: "Oath of Devotion Paladin",
      level: 5,
      hp: { current: 48, max: 48 },
      stats: {
        strength: 16,
        dexterity: 10,
        constitution: 15,
        intelligence: 10,
        wisdom: 14,
        charisma: 14
      },
      voice: "Fenrir",
      avatarUrl:
        "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200"
    },
    {
      id: "aria",
      name: "Aria Whispershade",
      race: "Wood Elf",
      className: "Arcane Trickster Rogue",
      level: 5,
      hp: { current: 36, max: 36 },
      stats: {
        strength: 10,
        dexterity: 18,
        constitution: 12,
        intelligence: 14,
        wisdom: 13,
        charisma: 12
      },
      voice: "Puck",
      avatarUrl:
        "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=200"
    },
    {
      id: "elara",
      name: "Elara Suncrest",
      race: "High Elf",
      className: "Evocation Wizard",
      level: 5,
      hp: { current: 28, max: 28 },
      stats: {
        strength: 8,
        dexterity: 14,
        constitution: 12,
        intelligence: 18,
        wisdom: 15,
        charisma: 10
      },
      voice: "Kore",
      avatarUrl:
        "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=200"
    },
    {
      id: "maldor",
      name: "Archmage Maldor",
      race: "Human",
      className: "Wild Magic Sorcerer",
      level: 5,
      hp: { current: 32, max: 32 },
      stats: {
        strength: 9,
        dexterity: 13,
        constitution: 14,
        intelligence: 11,
        wisdom: 11,
        charisma: 17
      },
      voice: "Zephyr",
      avatarUrl:
        "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200"
    }
  ],
  notes: [
    {
      id: "init_note_1",
      title: "The Lost Mine Legend",
      content:
        "Ancestors of the Stoneforge clan spoke of Wave Echo Cave. It holds the Forge of Spells, a source of legendary magic tools. We must search for clues near Phandalin town.",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      authorCharacterId: "valerius",
      category: "quest"
    },
    {
      id: "init_note_2",
      title: "Redbrand Menace Info",
      content:
        "Townsfolk whisper that a gang known as the Redbrands is terrorizing Phandalin. Their leader goes by the name 'Glasstaff'. It's rumored their main lair is somewhere hidden under Tresendar Manor.",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      authorCharacterId: "dm",
      category: "lore"
    }
  ],
  recentRolls: [],
  initiativeOrder: [],
  initiativeRound: 1,
  currentTurnIndex: 0,
  hpLogs: []
};

export interface LiveSyncMeta {
  stateVersion: number;
  currentRegionId: string;
  partyLocationId: string;
  liveView: LiveViewState | null;
}

let latestStateVersion = 1;
let memoryCampaignCache: CampaignState | null = null;
let memoryLiveCache: LiveSyncMeta | null = null;
let mutationQueue: Promise<unknown> = Promise.resolve();
let localWriteQueue: Promise<void> = Promise.resolve();

function extractLiveMeta(state: CampaignState): LiveSyncMeta {
  return {
    stateVersion: state.stateVersion || latestStateVersion || 1,
    currentRegionId: state.currentRegionId || "sword_coast",
    partyLocationId: state.partyLocationId || "phandalin",
    liveView: state.liveView || null
  };
}

function cloneState(state: CampaignState): CampaignState {
  return JSON.parse(JSON.stringify(state)) as CampaignState;
}

function readLocalSeedOrFile(): CampaignState | null {
  try {
    if (fs.existsSync(ACTIVE_FILE_PATH)) {
      const raw = fs.readFileSync(ACTIVE_FILE_PATH, "utf-8");
      const parsed = JSON.parse(raw) as CampaignState;
      if (typeof parsed.stateVersion === "number" && parsed.stateVersion > latestStateVersion) {
        latestStateVersion = parsed.stateVersion;
      }
      return parsed;
    }
    if (ACTIVE_FILE_PATH !== BUNDLED_CAMPAIGN_FILE && fs.existsSync(BUNDLED_CAMPAIGN_FILE)) {
      const raw = fs.readFileSync(BUNDLED_CAMPAIGN_FILE, "utf-8");
      const parsed = JSON.parse(raw) as CampaignState;
      if (typeof parsed.stateVersion === "number" && parsed.stateVersion > latestStateVersion) {
        latestStateVersion = parsed.stateVersion;
      }
      return parsed;
    }
  } catch (err) {
    console.error("Error reading local campaign file:", err);
  }
  return null;
}

function writeLocalCampaignFileSync(state: CampaignState): void {
  try {
    fs.writeFileSync(ACTIVE_FILE_PATH, JSON.stringify(state), "utf-8");
  } catch (err) {
    console.error(`Error writing campaign file (${ACTIVE_FILE_PATH}):`, err);
  }
}

function enqueueLocalCampaignFileWrite(state: CampaignState): Promise<void> {
  const serialized = JSON.stringify(state);
  const next = localWriteQueue.then(async () => {
    try {
      await fs.promises.writeFile(ACTIVE_FILE_PATH, serialized, "utf-8");
    } catch (err) {
      console.error(`Error writing campaign file (${ACTIVE_FILE_PATH}):`, err);
    }
  });
  localWriteQueue = next.catch(() => {});
  return next;
}

async function kvGetCampaign(): Promise<CampaignState | null> {
  if (!HAS_KV_STORAGE) return null;
  try {
    const res = await fetch(`${KV_URL.replace(/\/+$/, "")}/get/${encodeURIComponent(KV_STATE_KEY)}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${KV_TOKEN}`
      },
      cache: "no-store",
      signal: AbortSignal.timeout(6000)
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { result?: string | CampaignState | null };
    if (!data || data.result === null || data.result === undefined) return null;
    const parsed =
      typeof data.result === "string"
        ? (JSON.parse(data.result) as CampaignState)
        : (data.result as CampaignState);
    if (parsed && typeof parsed === "object") {
      if (typeof parsed.stateVersion === "number" && parsed.stateVersion > latestStateVersion) {
        latestStateVersion = parsed.stateVersion;
      }
      return parsed;
    }
  } catch (err) {
    console.warn("KV get fallback:", err);
  }
  return null;
}

async function kvSetCampaign(state: CampaignState): Promise<boolean> {
  if (!HAS_KV_STORAGE) return false;
  try {
    const res = await fetch(KV_URL.replace(/\/+$/, ""), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KV_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(["SET", KV_STATE_KEY, JSON.stringify(state)]),
      signal: AbortSignal.timeout(6000)
    });
    return res.ok;
  } catch (err) {
    console.warn("KV set fallback:", err);
    return false;
  }
}

async function kvGetLiveMeta(): Promise<LiveSyncMeta | null> {
  if (!HAS_KV_STORAGE) return null;
  try {
    const res = await fetch(`${KV_URL.replace(/\/+$/, "")}/get/${encodeURIComponent(KV_LIVE_KEY)}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${KV_TOKEN}`
      },
      cache: "no-store",
      signal: AbortSignal.timeout(4000)
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { result?: string | LiveSyncMeta | null };
    if (!data || data.result === null || data.result === undefined) return null;
    const parsed =
      typeof data.result === "string"
        ? (JSON.parse(data.result) as LiveSyncMeta)
        : (data.result as LiveSyncMeta);
    if (parsed && typeof parsed === "object") {
      return parsed;
    }
  } catch {
    // Ignore transient KV live meta read error
  }
  return null;
}

async function kvSetLiveMeta(meta: LiveSyncMeta): Promise<boolean> {
  if (!HAS_KV_STORAGE) return false;
  try {
    const res = await fetch(KV_URL.replace(/\/+$/, ""), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KV_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(["SET", KV_LIVE_KEY, JSON.stringify(meta)]),
      signal: AbortSignal.timeout(4000)
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function readLiveSyncMeta(): Promise<LiveSyncMeta> {
  if (HAS_KV_STORAGE) {
    const kvMeta = await kvGetLiveMeta();
    if (kvMeta) {
      memoryLiveCache = kvMeta;
      return kvMeta;
    }
  }
  if (memoryLiveCache && !HAS_KV_STORAGE) {
    return memoryLiveCache;
  }
  const campaign = await readCampaignState();
  const meta = extractLiveMeta(campaign);
  memoryLiveCache = meta;
  return meta;
}

export async function readCampaignState(): Promise<CampaignState> {
  if (HAS_KV_STORAGE) {
    const [kvState, kvLive] = await Promise.all([kvGetCampaign(), kvGetLiveMeta()]);
    if (kvState) {
      if (kvLive?.liveView?.updatedAt) {
        const stateLvAt = kvState.liveView?.updatedAt || "";
        if (!stateLvAt || kvLive.liveView.updatedAt > stateLvAt) {
          kvState.liveView = kvLive.liveView;
          if (kvLive.currentRegionId) kvState.currentRegionId = kvLive.currentRegionId;
        }
      }
      memoryCampaignCache = kvState;
      memoryLiveCache = extractLiveMeta(kvState);
      return cloneState(kvState);
    }
    const seed = memoryCampaignCache || readLocalSeedOrFile() || cloneState(defaultCampaignState);
    memoryCampaignCache = seed;
    memoryLiveCache = extractLiveMeta(seed);
    await Promise.all([kvSetCampaign(seed), kvSetLiveMeta(memoryLiveCache)]);
    return cloneState(seed);
  }

  if (memoryCampaignCache && !IS_VERCEL) {
    return cloneState(memoryCampaignCache);
  }

  const fileState = readLocalSeedOrFile();
  if (fileState) {
    memoryCampaignCache = fileState;
    memoryLiveCache = extractLiveMeta(fileState);
    return cloneState(fileState);
  }

  if (memoryCampaignCache) {
    memoryLiveCache = extractLiveMeta(memoryCampaignCache);
    return cloneState(memoryCampaignCache);
  }

  const fallback = cloneState(defaultCampaignState);
  memoryCampaignCache = fallback;
  memoryLiveCache = extractLiveMeta(fallback);
  writeLocalCampaignFileSync(fallback);
  return cloneState(fallback);
}

export async function persistCampaignState(state: CampaignState): Promise<CampaignState> {
  latestStateVersion = Math.max(latestStateVersion + 1, (state.stateVersion || 0) + 1);
  state.stateVersion = latestStateVersion;
  memoryCampaignCache = cloneState(state);
  memoryLiveCache = extractLiveMeta(state);

  if (HAS_KV_STORAGE) {
    const [, saved] = await Promise.all([kvSetLiveMeta(memoryLiveCache), kvSetCampaign(state)]);
    if (!saved) {
      writeLocalCampaignFileSync(state);
    }
  } else if (IS_VERCEL) {
    writeLocalCampaignFileSync(state);
  } else {
    void enqueueLocalCampaignFileWrite(memoryCampaignCache);
  }

  return state;
}

export async function updateLiveViewOnly(incoming: Partial<LiveViewState>): Promise<LiveSyncMeta> {
  const next = mutationQueue.then(async () => {
    const campaign = await readCampaignState();
    if (incoming.regionId) {
      campaign.currentRegionId = incoming.regionId;
    }
    const nowIso = new Date().toISOString();
    const prevUpdated = campaign.liveView?.updatedAt || "";
    const updatedAt = incoming.updatedAt && incoming.updatedAt > prevUpdated ? incoming.updatedAt : nowIso;

    campaign.liveView = {
      regionId: incoming.regionId || campaign.currentRegionId || "sword_coast",
      navLevel: incoming.navLevel || "realm",
      cityLocationId: incoming.cityLocationId ?? null,
      buildingId: incoming.buildingId ?? null,
      battleMapLocationId: incoming.battleMapLocationId ?? null,
      battleMapBuildingId: incoming.battleMapBuildingId ?? null,
      activeInteriorMapId: incoming.activeInteriorMapId ?? null,
      isBigMapOpen: !!incoming.isBigMapOpen,
      showLines: incoming.showLines !== undefined ? incoming.showLines : true,
      showTownNames: incoming.showTownNames !== undefined ? incoming.showTownNames : true,
      updatedAt
    };

    if (!campaign.stateVersion) {
      campaign.stateVersion = latestStateVersion;
    }
    memoryCampaignCache = campaign;
    const meta = extractLiveMeta(campaign);
    memoryLiveCache = meta;

    if (HAS_KV_STORAGE) {
      await Promise.all([kvSetLiveMeta(meta), kvSetCampaign(campaign)]);
    } else if (IS_VERCEL) {
      writeLocalCampaignFileSync(campaign);
    } else {
      void enqueueLocalCampaignFileWrite(campaign);
    }

    return meta;
  });
  mutationQueue = next.catch(() => {});
  return next;
}

function recordHpChange(
  campaign: CampaignState,
  entry: Omit<CombatHpLogEntry, "id" | "timestamp">
) {
  if (entry.previousHp === entry.newHp) return;
  if (!Array.isArray(campaign.hpLogs)) {
    campaign.hpLogs = [];
  }
  const logEntry: CombatHpLogEntry = {
    ...entry,
    id: `hplog_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString()
  };
  campaign.hpLogs.unshift(logEntry);
  if (campaign.hpLogs.length > 60) {
    campaign.hpLogs.length = 60;
  }
}

function syncCharacterHpEverywhere(
  campaign: CampaignState,
  characterId: string,
  hp?: { current: number; max: number },
  isHpHidden?: boolean
) {
  if (!characterId) return;

  const charIdx = campaign.characters.findIndex((c) => c.id === characterId);
  if (charIdx > -1) {
    const existingChar = campaign.characters[charIdx];
    campaign.characters[charIdx] = {
      ...existingChar,
      ...(hp ? { hp: { current: hp.current, max: hp.max } } : {}),
      ...(isHpHidden !== undefined ? { isHpHidden } : {})
    };
  }

  if (Array.isArray(campaign.initiativeOrder)) {
    campaign.initiativeOrder = campaign.initiativeOrder.map((c) => {
      if (c.characterId !== characterId) return c;
      return {
        ...c,
        ...(hp ? { hp: { current: hp.current, max: hp.max } } : {}),
        ...(isHpHidden !== undefined ? { isHpHidden } : {})
      };
    });
  }

  campaign.locations.forEach((loc) => {
    if (Array.isArray(loc.interiorMaps)) {
      loc.interiorMaps.forEach((m) => {
        if (Array.isArray(m.tokens)) {
          m.tokens = m.tokens.map((t) =>
            t.characterId === characterId
              ? {
                  ...t,
                  ...(hp ? { hp: { current: hp.current, max: hp.max } } : {}),
                  ...(isHpHidden !== undefined ? { isHpHidden } : {})
                }
              : t
          );
        }
      });
    }
    if (Array.isArray(loc.cityBuildings)) {
      loc.cityBuildings.forEach((bld) => {
        if (Array.isArray(bld.interiorMaps)) {
          bld.interiorMaps.forEach((m) => {
            if (Array.isArray(m.tokens)) {
              m.tokens = m.tokens.map((t) =>
                t.characterId === characterId
                  ? {
                      ...t,
                      ...(hp ? { hp: { current: hp.current, max: hp.max } } : {}),
                      ...(isHpHidden !== undefined ? { isHpHidden } : {})
                    }
                  : t
              );
            }
          });
        }
      });
    }
  });
}

// Lazy load Gemini AI to avoid crashes or cold-start overhead if GEMINI_API_KEY is not set
let aiClient: GoogleGenAI | null = null;
async function getGeminiClient(): Promise<GoogleGenAI> {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY is missing. Please configure it in your environment variables."
      );
    }
    const { GoogleGenAI: GenAIClass } = await import("@google/genai");
    aiClient = new GenAIClass({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  }
  return aiClient;
}

export interface CampaignAppOptions {
  websocketEnabled?: boolean;
  onBroadcast?: (
    state: CampaignState,
    eventType?: "campaign:init" | "campaign:updated"
  ) => void;
  onLiveViewBroadcast?: (payload: LiveSyncMeta) => void;
}

export function createCampaignApp(options: CampaignAppOptions = {}): Express {
  const app = express();
  const websocketEnabled = options.websocketEnabled ?? false;

  app.use(express.json({ limit: "250mb" }));
  app.use(express.urlencoded({ limit: "250mb", extended: true }));

  type MutationOutcome<T> =
    | { ok: true; data: T }
    | { ok: false; status: number; error: string };

  const runSerializedMutation = <T>(
    work: (
      campaign: CampaignState
    ) => Promise<{ result: T; commit?: boolean }> | { result: T; commit?: boolean }
  ): Promise<T> => {
    const next = mutationQueue.then(async () => {
      const campaign = await readCampaignState();
      const { result, commit = true } = await work(campaign);
      if (commit) {
        const committed = await persistCampaignState(campaign);
        if (options.onBroadcast) {
          options.onBroadcast(committed, "campaign:updated");
        }
      }
      return result;
    });
    mutationQueue = next.catch(() => {});
    return next;
  };

  const asyncRoute =
    (handler: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
    (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(handler(req, res, next)).catch(next);
    };

  // Healthcheck & runtime capabilities endpoint
  app.get(["/health", "/api/health", "/api"], (_req, res) => {
    res.status(200).json({
      status: "healthy",
      runtime: IS_VERCEL ? "vercel" : "node",
      websocket: websocketEnabled,
      persistence: getPersistenceBackend(),
      timestamp: new Date().toISOString()
    });
  });

  // Read complete campaign state (auto-gzipped above 256 KB to stay under serverless payload limits)
  app.get(
    "/api/campaign",
    asyncRoute(async (req, res) => {
      const data = await readCampaignState();
      res.setHeader("Cache-Control", "no-store, max-age=0");
      res.setHeader("Vary", "Accept-Encoding");
      const jsonStr = JSON.stringify(data);
      const acceptEncoding = String(req.headers["accept-encoding"] || "");
      if (jsonStr.length > 256 * 1024 && /\bgzip\b/i.test(acceptEncoding)) {
        const compressed = zlib.gzipSync(Buffer.from(jsonStr, "utf-8"));
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Content-Encoding", "gzip");
        return res.status(200).send(compressed);
      }
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.status(200).send(jsonStr);
    })
  );

  // Update campaign metadata (campaign name and party name)
  app.post(
    "/api/campaign/meta",
    asyncRoute(async (req, res) => {
      const { campaignName, partyName } = req.body || {};
      const campaign = await runSerializedMutation((draft) => {
        if (campaignName !== undefined) draft.campaignName = campaignName;
        if (partyName !== undefined) draft.partyName = partyName;
        return { result: draft };
      });
      res.json({ success: true, campaign });
    })
  );

  // Update characters - adding/updating a hero (persists & records HP changes)
  app.post(
    "/api/campaign/character",
    asyncRoute(async (req, res) => {
      const character: Character = { ...(req.body || {}) };
      if (!character.id) {
        character.id = "char_" + Date.now();
      }
      const campaign = await runSerializedMutation((draft) => {
        const idx = draft.characters.findIndex((c) => c.id === character.id);
        const prevChar = idx > -1 ? draft.characters[idx] : undefined;

        if (idx > -1) {
          draft.characters[idx] = character;
        } else {
          draft.characters.push(character);
        }

        if (prevChar && prevChar.hp && character.hp && prevChar.hp.current !== character.hp.current) {
          recordHpChange(draft, {
            targetId: character.id,
            characterId: character.id,
            targetName: character.name,
            targetType: "player",
            delta: character.hp.current - prevChar.hp.current,
            previousHp: prevChar.hp.current,
            newHp: character.hp.current,
            maxHp: character.hp.max,
            context: "Party Roster"
          });
        }

        syncCharacterHpEverywhere(draft, character.id, character.hp, character.isHpHidden);
        return { result: draft };
      });
      res.json({ success: true, character, campaign });
    })
  );

  // Delete a character
  app.post(
    "/api/campaign/character/delete",
    asyncRoute(async (req, res) => {
      const { characterId } = req.body || {};
      if (!characterId) return res.status(400).json({ error: "characterId is required" });
      const campaign = await runSerializedMutation((draft) => {
        draft.characters = draft.characters.filter((c) => c.id !== characterId);
        return { result: draft };
      });
      res.json({ success: true, campaign });
    })
  );

  // Move Party along the map & auto-discover connected locations
  app.post(
    "/api/campaign/move",
    asyncRoute(async (req, res) => {
      const { targetLocationId } = req.body || {};
      const outcome = await runSerializedMutation<MutationOutcome<CampaignState>>((draft) => {
        const loc = draft.locations.find((l) => l.id === targetLocationId);
        if (!loc) {
          return { result: { ok: false, status: 404, error: "Location not found" }, commit: false };
        }
        draft.partyLocationId = targetLocationId;
        loc.isDiscovered = true;
        loc.connectedTo.forEach((connId) => {
          const connectedLoc = draft.locations.find((l) => l.id === connId);
          if (connectedLoc && !connectedLoc.isHidden) {
            connectedLoc.isDiscovered = true;
          }
        });
        return { result: { ok: true, data: draft } };
      });
      if (outcome.ok === false) return res.status(outcome.status).json({ error: outcome.error });
      res.json({ success: true, campaign: outcome.data });
    })
  );

  // Toggle hidden status for Campaign location
  app.post(
    "/api/campaign/location/toggle-discovered",
    asyncRoute(async (req, res) => {
      const { locationId } = req.body || {};
      const outcome = await runSerializedMutation<MutationOutcome<CampaignState>>((draft) => {
        const loc = draft.locations.find((l) => l.id === locationId);
        if (!loc) {
          return { result: { ok: false, status: 404, error: "Location not found" }, commit: false };
        }
        loc.isDiscovered = !loc.isDiscovered;
        if (loc.isDiscovered && loc.isHidden) loc.isHidden = false;
        return { result: { ok: true, data: draft } };
      });
      if (outcome.ok === false) return res.status(outcome.status).json({ error: outcome.error });
      res.json({ success: true, campaign: outcome.data });
    })
  );

  // Update location details
  app.post(
    "/api/campaign/location/update",
    asyncRoute(async (req, res) => {
      const { location } = req.body || {};
      if (!location || !location.id) {
        return res.status(400).json({ error: "Location data with ID is required" });
      }
      const outcome = await runSerializedMutation<
        MutationOutcome<{ location: CampaignLocation; campaign: CampaignState }>
      >((draft) => {
        const idx = draft.locations.findIndex((l) => l.id === location.id);
        if (idx === -1) {
          return { result: { ok: false, status: 404, error: "Location not found" }, commit: false };
        }
        draft.locations[idx] = { ...draft.locations[idx], ...location };
        return { result: { ok: true, data: { location: draft.locations[idx], campaign: draft } } };
      });
      if (outcome.ok === false) return res.status(outcome.status).json({ error: outcome.error });
      res.json({ success: true, location: outcome.data.location, campaign: outcome.data.campaign });
    })
  );

  // Delete location from campaign map
  app.post(
    "/api/campaign/location/delete",
    asyncRoute(async (req, res) => {
      const { locationId } = req.body || {};
      if (!locationId) return res.status(400).json({ error: "Location ID is required" });
      const campaign = await runSerializedMutation((draft) => {
        draft.locations = draft.locations.filter((l) => l.id !== locationId);
        draft.locations.forEach((loc) => {
          loc.connectedTo = loc.connectedTo.filter((id) => id !== locationId);
        });
        if (draft.partyLocationId === locationId && draft.locations.length > 0) {
          draft.partyLocationId = draft.locations[0].id;
          draft.locations[0].isDiscovered = true;
        }
        return { result: draft };
      });
      res.json({ success: true, campaign });
    })
  );

  // Toggle Boss Slain on location
  app.post(
    "/api/campaign/location/toggle-boss-slain",
    asyncRoute(async (req, res) => {
      const { locationId } = req.body || {};
      const outcome = await runSerializedMutation<
        MutationOutcome<{ location: CampaignLocation; campaign: CampaignState }>
      >((draft) => {
        const loc = draft.locations.find((l) => l.id === locationId);
        if (!loc) {
          return { result: { ok: false, status: 404, error: "Location not found" }, commit: false };
        }
        loc.bossSlain = !loc.bossSlain;
        return { result: { ok: true, data: { location: loc, campaign: draft } } };
      });
      if (outcome.ok === false) return res.status(outcome.status).json({ error: outcome.error });
      res.json({ success: true, location: outcome.data.location, campaign: outcome.data.campaign });
    })
  );

  // Toggle Hidden from Players (DM Eyes Only)
  app.post(
    "/api/campaign/location/toggle-hidden",
    asyncRoute(async (req, res) => {
      const { locationId } = req.body || {};
      const outcome = await runSerializedMutation<
        MutationOutcome<{ location: CampaignLocation; campaign: CampaignState }>
      >((draft) => {
        const loc = draft.locations.find((l) => l.id === locationId);
        if (!loc) {
          return { result: { ok: false, status: 404, error: "Location not found" }, commit: false };
        }
        loc.isHidden = !loc.isHidden;
        return { result: { ok: true, data: { location: loc, campaign: draft } } };
      });
      if (outcome.ok === false) return res.status(outcome.status).json({ error: outcome.error });
      res.json({ success: true, location: outcome.data.location, campaign: outcome.data.campaign });
    })
  );

  // Update or Modify Site Inside Battle Maps
  app.post(
    "/api/campaign/location/battlemap",
    asyncRoute(async (req, res) => {
      const { locationId, buildingId, interiorMaps, activeInteriorMapId } = req.body || {};
      const outcome = await runSerializedMutation<
        MutationOutcome<{ location: CampaignLocation; campaign: CampaignState }>
      >((draft) => {
        const loc = draft.locations.find((l) => l.id === locationId);
        if (!loc) {
          return { result: { ok: false, status: 404, error: "Location not found" }, commit: false };
        }

        if (buildingId && Array.isArray(loc.cityBuildings)) {
          const bld = loc.cityBuildings.find((b) => b.id === buildingId);
          if (bld) {
            bld.interiorMaps = interiorMaps;
            if (activeInteriorMapId !== undefined) bld.activeInteriorMapId = activeInteriorMapId;
          } else {
            loc.interiorMaps = interiorMaps;
            if (activeInteriorMapId !== undefined) loc.activeInteriorMapId = activeInteriorMapId;
          }
        } else {
          loc.interiorMaps = interiorMaps;
          if (activeInteriorMapId !== undefined) loc.activeInteriorMapId = activeInteriorMapId;
        }

        if (Array.isArray(interiorMaps)) {
          interiorMaps.forEach((m: any) => {
            if (Array.isArray(m?.tokens)) {
              m.tokens.forEach((t: any) => {
                if (t?.characterId && typeof t.isHpHidden === "boolean") {
                  const linkedChar = draft.characters.find((c) => c.id === t.characterId);
                  if (linkedChar && linkedChar.isHpHidden !== t.isHpHidden) {
                    syncCharacterHpEverywhere(draft, t.characterId, undefined, t.isHpHidden);
                  }
                }
              });
            }
          });
        }

        if (
          activeInteriorMapId !== undefined &&
          draft.liveView &&
          draft.liveView.battleMapLocationId === locationId &&
          (draft.liveView.battleMapBuildingId || null) === (buildingId || null)
        ) {
          draft.liveView.activeInteriorMapId = activeInteriorMapId;
          draft.liveView.updatedAt = new Date().toISOString();
        }

        return { result: { ok: true, data: { location: loc, campaign: draft } } };
      });
      if (outcome.ok === false) return res.status(outcome.status).json({ error: outcome.error });
      res.json({ success: true, location: outcome.data.location, campaign: outcome.data.campaign });
    })
  );

  // Atomic Tactical Battle Token HP & Visibility Update
  app.post(
    "/api/campaign/location/battlemap/token-hp",
    asyncRoute(async (req, res) => {
      const { locationId, buildingId, mapId, tokenId, delta, setHp, isHpHidden } = req.body || {};
      const outcome = await runSerializedMutation<
        MutationOutcome<{ token: any; campaign: CampaignState }>
      >((draft) => {
        const loc = draft.locations.find((l) => l.id === locationId);
        if (!loc) {
          return { result: { ok: false, status: 404, error: "Location not found" }, commit: false };
        }

        let mapsList = loc.interiorMaps;
        if (buildingId && Array.isArray(loc.cityBuildings)) {
          const bld = loc.cityBuildings.find((b) => b.id === buildingId);
          if (bld && Array.isArray(bld.interiorMaps)) mapsList = bld.interiorMaps;
        }

        const targetMap = mapsList?.find((m) => m.id === mapId);
        if (!targetMap) {
          return { result: { ok: false, status: 404, error: "Battle map not found" }, commit: false };
        }

        const token = targetMap.tokens?.find((t) => t.id === tokenId);
        if (!token) {
          return { result: { ok: false, status: 404, error: "Token not found" }, commit: false };
        }

        if (token.hp && (typeof delta === "number" || typeof setHp === "number")) {
          const previousHp = token.hp.current;
          const rawTarget = typeof setHp === "number" ? setHp : previousHp + (delta || 0);
          const nextHp = Math.max(0, Math.min(token.hp.max, rawTarget));
          token.hp = { ...token.hp, current: nextHp };

          if (previousHp !== nextHp) {
            recordHpChange(draft, {
              targetId: token.id,
              characterId: token.characterId,
              targetName: token.name,
              targetType: token.type === "effect" ? "npc" : token.type,
              delta: nextHp - previousHp,
              previousHp,
              newHp: nextHp,
              maxHp: token.hp.max,
              context: `Tactical Combat (${targetMap.name})`
            });
          }
        }

        if (typeof isHpHidden === "boolean") {
          token.isHpHidden = isHpHidden;
        }

        if (token.characterId) {
          syncCharacterHpEverywhere(
            draft,
            token.characterId,
            token.hp,
            typeof isHpHidden === "boolean" ? isHpHidden : undefined
          );
        }

        return { result: { ok: true, data: { token, campaign: draft } } };
      });
      if (outcome.ok === false) {
        return res.status(outcome.status).json({ success: false, error: outcome.error });
      }
      res.json({ success: true, token: outcome.data.token, campaign: outcome.data.campaign });
    })
  );

  // Clear recorded Damage / Heal combat logs
  app.post(
    "/api/campaign/hp-logs/clear",
    asyncRoute(async (_req, res) => {
      const campaign = await runSerializedMutation((draft) => {
        draft.hpLogs = [];
        return { result: draft };
      });
      res.json({ success: true, campaign });
    })
  );

  // Update Fog of War for any map level
  app.post(
    "/api/campaign/fog",
    asyncRoute(async (req, res) => {
      const { targetType, regionId, locationId, buildingId, mapId, fogOfWar } = req.body || {};
      if (!targetType || !fogOfWar || typeof fogOfWar.enabled !== "boolean" || !Array.isArray(fogOfWar.strokes)) {
        return res.status(400).json({ success: false, error: "Invalid Fog of War payload" });
      }

      const outcome = await runSerializedMutation<MutationOutcome<CampaignState>>((draft) => {
        if (targetType === "region") {
          const reg = draft.regions.find((r) => r.id === regionId);
          if (!reg) return { result: { ok: false, status: 404, error: "Region not found" }, commit: false };
          reg.fogOfWar = fogOfWar;
        } else if (targetType === "city") {
          const loc = draft.locations.find((l) => l.id === locationId);
          if (!loc) return { result: { ok: false, status: 404, error: "Location not found" }, commit: false };
          loc.cityFogOfWar = fogOfWar;
        } else if (targetType === "building") {
          const loc = draft.locations.find((l) => l.id === locationId);
          const bld = loc?.cityBuildings?.find((b) => b.id === buildingId);
          if (!bld) return { result: { ok: false, status: 404, error: "Building not found" }, commit: false };
          bld.fogOfWar = fogOfWar;
        } else if (targetType === "battlemap") {
          const loc = draft.locations.find((l) => l.id === locationId);
          if (!loc) return { result: { ok: false, status: 404, error: "Location not found" }, commit: false };
          let mapsList = loc.interiorMaps;
          if (buildingId && Array.isArray(loc.cityBuildings)) {
            const bld = loc.cityBuildings.find((b) => b.id === buildingId);
            if (bld && Array.isArray(bld.interiorMaps)) mapsList = bld.interiorMaps;
          }
          const targetMap = mapsList?.find((m) => m.id === mapId);
          if (!targetMap) {
            return { result: { ok: false, status: 404, error: "Battle map not found" }, commit: false };
          }
          targetMap.fogOfWar = fogOfWar;
        } else {
          return {
            result: { ok: false, status: 400, error: "Unsupported Fog of War targetType" },
            commit: false
          };
        }
        return { result: { ok: true, data: draft } };
      });

      if (outcome.ok === false) {
        return res.status(outcome.status).json({ success: false, error: outcome.error });
      }
      res.json({ success: true, campaign: outcome.data });
    })
  );

  // Update Region Background Image
  app.post(
    "/api/campaign/region/image",
    asyncRoute(async (req, res) => {
      const { regionId, imageUrl, name, description } = req.body || {};
      const outcome = await runSerializedMutation<
        MutationOutcome<{ region: CampaignState["regions"][number]; campaign: CampaignState }>
      >((draft) => {
        const reg = draft.regions.find((r) => r.id === regionId);
        if (!reg) {
          return { result: { ok: false, status: 404, error: "Region not found" }, commit: false };
        }
        if (imageUrl) reg.backgroundUrl = imageUrl;
        if (name) reg.name = name;
        if (description) reg.description = description;
        return { result: { ok: true, data: { region: reg, campaign: draft } } };
      });
      if (outcome.ok === false) return res.status(outcome.status).json({ error: outcome.error });
      res.json({ success: true, region: outcome.data.region, campaign: outcome.data.campaign });
    })
  );

  // Export complete campaign save state as downloadable JSON file
  app.get(
    "/api/campaign/export-data",
    asyncRoute(async (_req, res) => {
      try {
        const campaign = await readCampaignState();
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        const safeName = (campaign.campaignName || "aethelgard")
          .toLowerCase()
          .replace(/[^a-z0-9_-]/g, "_");
        const filename = `${safeName}-campaign-save-${timestamp}.json`;

        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.send(JSON.stringify(campaign, null, 2));
      } catch (err) {
        console.error("Export error:", err);
        res.status(500).json({ success: false, error: "Failed to export campaign data" });
      }
    })
  );

  // Import complete campaign save state from JSON
  app.post(
    "/api/campaign/import-data",
    asyncRoute(async (req, res) => {
      try {
        let payload = req.body;
        if (typeof payload === "string") {
          try {
            payload = JSON.parse(payload);
          } catch {
            return res
              .status(400)
              .json({ success: false, error: "Invalid JSON syntax in uploaded file" });
          }
        }

        let imported = payload;
        if (payload && typeof payload === "object") {
          if (payload.campaign && typeof payload.campaign === "object") {
            imported = payload.campaign;
          } else if (payload.state && typeof payload.state === "object") {
            imported = payload.state;
          }
        }

        if (!imported || typeof imported !== "object") {
          return res.status(400).json({ success: false, error: "Empty or invalid save file payload." });
        }

        if (!Array.isArray(imported.locations) && !Array.isArray(imported.characters)) {
          return res.status(400).json({
            success: false,
            error: "Invalid save file structure. File must contain locations or characters."
          });
        }

        const sanitizedCampaign: CampaignState = {
          ...defaultCampaignState,
          ...imported,
          currentRegionId: imported.currentRegionId || defaultCampaignState.currentRegionId,
          partyLocationId: imported.partyLocationId || defaultCampaignState.partyLocationId,
          campaignName: imported.campaignName || "Aethelgard",
          partyName: imported.partyName || "Campaign Party Alliance",
          regions:
            Array.isArray(imported.regions) && imported.regions.length > 0
              ? imported.regions
              : defaultCampaignState.regions,
          locations: Array.isArray(imported.locations)
            ? imported.locations
            : defaultCampaignState.locations,
          characters: Array.isArray(imported.characters)
            ? imported.characters
            : defaultCampaignState.characters,
          notes: Array.isArray(imported.notes) ? imported.notes : [],
          recentRolls: Array.isArray(imported.recentRolls) ? imported.recentRolls : [],
          initiativeOrder: Array.isArray(imported.initiativeOrder) ? imported.initiativeOrder : [],
          initiativeRound:
            typeof imported.initiativeRound === "number" ? imported.initiativeRound : 1,
          currentTurnIndex:
            typeof imported.currentTurnIndex === "number" ? imported.currentTurnIndex : 0,
          hpLogs: Array.isArray(imported.hpLogs) ? imported.hpLogs : [],
          mediaLibrary: Array.isArray(imported.mediaLibrary) ? imported.mediaLibrary : []
        };

        await runSerializedMutation((draft) => {
          Object.keys(draft).forEach((k) => delete (draft as any)[k]);
          Object.assign(draft, sanitizedCampaign);
          return { result: draft };
        });

        const fresh = await readCampaignState();
        res.json({ success: true, campaign: fresh });
      } catch (err: any) {
        console.error("Error importing campaign state:", err);
        res.status(500).json({ success: false, error: err.message || "Failed to process import data" });
      }
    })
  );

  // Add Custom Location to Map
  app.post(
    "/api/campaign/location/create",
    asyncRoute(async (req, res) => {
      const { name, description, type, x, y, isHidden } = req.body || {};
      if (!name || x === undefined || y === undefined) {
        return res.status(400).json({ error: "Missing required location inputs" });
      }
      const outcome = await runSerializedMutation((draft) => {
        const newLoc: CampaignLocation = {
          id: "loc_" + Date.now(),
          name,
          description: description || "Undiscovered territory of Faerûn.",
          type: type || "cave",
          x,
          y,
          isHidden: !!isHidden,
          isDiscovered: !isHidden,
          connectedTo: [draft.partyLocationId],
          dangerLevel: Math.floor(Math.random() * 4) + 1
        };
        const parentLoc = draft.locations.find((l) => l.id === draft.partyLocationId);
        if (parentLoc) parentLoc.connectedTo.push(newLoc.id);
        draft.locations.push(newLoc);
        return { result: { location: newLoc, campaign: draft } };
      });
      res.json({ success: true, location: outcome.location, campaign: outcome.campaign });
    })
  );

  // Sync Journal Notes
  app.post(
    "/api/notes",
    asyncRoute(async (req, res) => {
      const { id, title, content, authorCharacterId, category } = req.body || {};
      if (!title || !content) {
        return res.status(400).json({ error: "Missing title or content" });
      }
      const outcome = await runSerializedMutation((draft) => {
        const newNote: JournalNote = {
          id: id || "note_" + Date.now(),
          title,
          content,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          authorCharacterId: authorCharacterId || "dm",
          category: category || "session"
        };
        const idx = draft.notes.findIndex((n) => n.id === newNote.id);
        if (idx > -1) {
          draft.notes[idx] = {
            ...draft.notes[idx],
            title,
            content,
            category: category || draft.notes[idx].category,
            updatedAt: new Date().toISOString()
          };
          return { result: { note: draft.notes[idx], campaign: draft } };
        }
        draft.notes.unshift(newNote);
        return { result: { note: newNote, campaign: draft } };
      });
      res.json({ success: true, note: outcome.note, campaign: outcome.campaign });
    })
  );

  app.delete(
    "/api/notes/:id",
    asyncRoute(async (req, res) => {
      const { id } = req.params;
      const campaign = await runSerializedMutation((draft) => {
        draft.notes = draft.notes.filter((n) => n.id !== id);
        return { result: draft };
      });
      res.json({ success: true, campaign });
    })
  );

  // Sync Dice Roll events log
  app.post(
    "/api/dice/log",
    asyncRoute(async (req, res) => {
      const roll: DiceRollResult = { ...(req.body || {}) };
      roll.id = roll.id || "roll_" + Date.now();
      roll.timestamp = new Date().toISOString();

      const recentRolls = await runSerializedMutation((draft) => {
        draft.recentRolls.unshift(roll);
        if (draft.recentRolls.length > 30) draft.recentRolls.pop();
        return { result: draft.recentRolls };
      });
      res.json({ success: true, recentRolls });
    })
  );

  // Update Initiative Order state
  app.post(
    "/api/campaign/initiative",
    asyncRoute(async (req, res) => {
      const { initiativeOrder, initiativeRound, currentTurnIndex } = req.body || {};
      const campaign = await runSerializedMutation((draft) => {
        if (Array.isArray(initiativeOrder)) {
          const prevList = Array.isArray(draft.initiativeOrder) ? draft.initiativeOrder : [];
          initiativeOrder.forEach((incomingC: any) => {
            const prevC = prevList.find((p) => p.id === incomingC.id);
            if (prevC && prevC.hp && incomingC.hp && prevC.hp.current !== incomingC.hp.current) {
              recordHpChange(draft, {
                targetId: incomingC.id,
                characterId: incomingC.characterId,
                targetName: incomingC.name,
                targetType: incomingC.isCustom ? "enemy" : "player",
                delta: incomingC.hp.current - prevC.hp.current,
                previousHp: prevC.hp.current,
                newHp: incomingC.hp.current,
                maxHp: incomingC.hp.max,
                context: "Initiative Order"
              });
              if (incomingC.characterId) {
                syncCharacterHpEverywhere(draft, incomingC.characterId, incomingC.hp, incomingC.isHpHidden);
              }
            } else if (prevC && prevC.isHpHidden !== incomingC.isHpHidden && incomingC.characterId) {
              syncCharacterHpEverywhere(draft, incomingC.characterId, undefined, incomingC.isHpHidden);
            }
          });
          draft.initiativeOrder = initiativeOrder;
        }
        if (initiativeRound !== undefined) draft.initiativeRound = initiativeRound;
        if (currentTurnIndex !== undefined) draft.currentTurnIndex = currentTurnIndex;
        return { result: draft };
      });
      res.json({ success: true, campaign });
    })
  );

  // Ultra-lightweight live view & sync version poll endpoint (~350 bytes)
  app.get(
    "/api/campaign/live-view",
    asyncRoute(async (_req, res) => {
      const meta = await readLiveSyncMeta();
      res.setHeader("Cache-Control", "no-store, max-age=0");
      res.json({ success: true, ...meta });
    })
  );

  // Broadcast DM live active map / room / battle view for multi-browser Player sync
  app.post(
    "/api/campaign/live-view",
    asyncRoute(async (req, res) => {
      const incoming = req.body as Partial<LiveViewState>;
      if (!incoming || typeof incoming !== "object") {
        return res.status(400).json({ success: false, error: "Invalid liveView payload" });
      }
      const meta = await updateLiveViewOnly(incoming);
      if (options.onLiveViewBroadcast) {
        options.onLiveViewBroadcast(meta);
      }
      res.json({ success: true, ...meta });
    })
  );

  // Character Speak Speech Generation Engine (using Gemini TTS)
  app.post(
    "/api/character/speak",
    asyncRoute(async (req, res) => {
      const { characterId, promptContext, customLine } = req.body || {};
      if (!characterId) {
        return res.status(400).json({ error: "Character ID is required" });
      }

      const campaign = await readCampaignState();
      const char = campaign.characters.find((c) => c.id === characterId);
      if (!char) {
        return res.status(404).json({ error: "Character not found in campaign" });
      }

      try {
        let textToSpeak = customLine;
        if (!textToSpeak) {
          const prompt = `You are a D&D character speaking in a local campaign. 
Character Name: ${char.name}
Character Race & Class: ${char.race} ${char.className}
Context or Scenario: ${promptContext || "Standard conversation in the local tavern."}

Write a short, immersive, highly in-character speaking line (1 to 3 sentences maximum, no metadata, no parentheses, no stage instructions, just the spoken words matching their class and lore!). Use rich tavern/mystic roleplay style.`;

          const ai = await getGeminiClient();
          const textResponse = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: prompt
          });

          textToSpeak = textResponse.text || "I have nothing to say at this moment, traveler.";
        }

        textToSpeak = String(textToSpeak).replace(/^["']|["']$/g, "").trim();
        const voiceName = char.voice || "Zephyr";

        const ai = await getGeminiClient();
        const ttsResponse = await ai.models.generateContent({
          model: "gemini-3.1-flash-tts-preview",
          contents: [{ parts: [{ text: `Speak in a matching roleplay style: ${textToSpeak}` }] }],
          config: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName }
              }
            }
          }
        });

        const base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

        res.json({
          success: true,
          text: textToSpeak,
          voiceName,
          audio: base64Audio || null
        });
      } catch (error: any) {
        console.error("Error generating dialogue speech:", error);
        res.json({
          success: false,
          text:
            customLine ||
            `Hail traveler! My name is ${char.name}. (API Voice fallback active: configure GEMINI_API_KEY in environment variables.)`,
          error: error.message,
          voiceName: char.voice,
          audio: null
        });
      }
    })
  );

  // Express JSON error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error("API error:", err);
    const status = err?.status || err?.statusCode || 500;
    res.status(status).json({
      success: false,
      error: err?.message || "Internal server error"
    });
  });

  return app;
}
