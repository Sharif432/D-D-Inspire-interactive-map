import express from "express";
import http from "http";
import path from "path";
import fs from "fs";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { CampaignState, JournalNote, CampaignLocation, Character, DiceRollResult, LiveViewState } from "./src/types";

const app = express();

function getPort(): number {
  const portIndex = process.argv.indexOf("--port");
  if (portIndex !== -1 && process.argv[portIndex + 1]) {
    const p = parseInt(process.argv[portIndex + 1], 10);
    if (!isNaN(p)) return p;
  }
  if (process.env.DEFAULT_APP_PORT) {
    const p = parseInt(process.env.DEFAULT_APP_PORT, 10);
    if (!isNaN(p)) return p;
  }
  return 3000;
}

function getHost(): string {
  const hostIndex = process.argv.indexOf("--host");
  if (hostIndex !== -1 && process.argv[hostIndex + 1]) {
    return process.argv[hostIndex + 1];
  }
  return "0.0.0.0";
}

const PORT = getPort();
const HOST = getHost();

app.use(express.json({ limit: "250mb" }));
app.use(express.urlencoded({ limit: "250mb", extended: true }));

// Healthcheck endpoint for readiness probes
app.get(["/health", "/api/health"], (_req, res) => {
  res.status(200).json({ status: "healthy", timestamp: new Date().toISOString() });
});

const CAMPAIGN_FILE = path.join(process.cwd(), "campaign-data.json");

// Default D&D Campaign State
const defaultCampaignState: CampaignState = {
  currentRegionId: "sword_coast",
  partyLocationId: "phandalin",
  regions: [
    {
      id: "sword_coast",
      name: "The Sword Coast",
      description: "A rugged region of Northern Faerûn featuring majestic trade-cities, ancient ruins, and dense untamed wilderness.",
      backgroundUrl: "https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&q=80&w=1200"
    },
    {
      id: "underdark",
      name: "The Underdark",
      description: "A vast subterranean wonderland of hazard and mystery, lit by phosphorescent fungi and deep bioluminescence.",
      backgroundUrl: "https://images.unsplash.com/photo-1507163011986-e3d1796fd042?auto=format&fit=crop&q=80&w=1200"
    }
  ],
  locations: [
    // Sword Coast Locations
    {
      id: "neverwinter",
      name: "City of Neverwinter",
      description: "A bustling metropolis rising from the ashes of destruction, now a major hub of civilizations.",
      type: "town",
      x: 15,
      y: 20,
      isHidden: false,
      isDiscovered: true,
      connectedTo: ["neverwinter_wood", "high_road"],
      dangerLevel: 1,
      cityMapImageUrl: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80&w=1200",
      cityBuildings: [
        {
          id: "moonstone_mask",
          name: "The Moonstone Mask Inn & Tavern",
          description: "Neverwinter's most famous roadhouse and tavern, floating above the harbor. Renowned for its masked clientele and spiced mulled wine.",
          type: "tavern",
          x: 42,
          y: 38,
          imageUrl: "https://images.unsplash.com/photo-1543007630-9710e4a00a20?auto=format&fit=crop&q=80&w=1200",
          interiorMaps: [
            {
              id: "map_moonstone_taproom",
              locationId: "neverwinter",
              name: "Moonstone Mask - Grand Taproom & Hearth",
              description: "The floating main lounge with mahogany tables, crystal chandeliers, and a lavish bar.",
              imageUrl: "https://images.unsplash.com/photo-1543007630-9710e4a00a20?auto=format&fit=crop&q=80&w=1200",
              gridCols: 14,
              gridRows: 10,
              showGrid: true,
              tokens: []
            },
            {
              id: "map_moonstone_suites",
              locationId: "neverwinter",
              name: "Moonstone Mask - Second Floor Suites",
              description: "Private meeting rooms and guest chambers overlooking Neverwinter Bay.",
              imageUrl: "https://images.unsplash.com/photo-1590402494682-cd3fb53b1f70?auto=format&fit=crop&q=80&w=1200",
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
          description: "A boisterous seaside tavern constructed from the hull of a stranded pirate galleon. Filled with sailors and treasure hunters.",
          type: "tavern",
          x: 28,
          y: 72,
          imageUrl: "https://images.unsplash.com/photo-1572116469696-31de0f17cc34?auto=format&fit=crop&q=80&w=1200",
          interiorMaps: [
            {
              id: "map_leviathan_deck",
              locationId: "neverwinter",
              name: "Beached Leviathan - Ship Deck Bar",
              description: "The weather-beaten wooden deck converted into a bustling taproom.",
              imageUrl: "https://images.unsplash.com/photo-1584968153986-3fbae48835a7?auto=format&fit=crop&q=80&w=1200",
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
          description: "The grand fortress of Lord Protector Dagult Neverember, towering proudly over the city.",
          type: "civic",
          x: 65,
          y: 28,
          imageUrl: "https://images.unsplash.com/photo-1584968153986-3fbae48835a7?auto=format&fit=crop&q=80&w=1200"
        },
        {
          id: "hall_of_justice",
          name: "Hall of Justice (Temple of Tyr)",
          description: "A colossal white marble temple dedicated to Tyr, God of Justice. Serves as city court and defensive redoubt.",
          type: "temple",
          x: 74,
          y: 55,
          imageUrl: "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&q=80&w=1200"
        },
        {
          id: "shining_serpent",
          name: "The Shining Serpent Curios & Alchemy",
          description: "An eccentric herbalist and potion shoppe run by a retired elven mage.",
          type: "shop",
          x: 52,
          y: 60,
          imageUrl: "https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&q=80&w=1200"
        }
      ]
    },
    {
      id: "neverwinter_wood",
      name: "Neverwinter Wood",
      description: "A dark, dense forest filled with fey beings, goblins, and ancient magical ruins.",
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
      description: "A ruined stronghold claimed by the Cragmaw goblin tribe to ambush travelers along the Triboar trail.",
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
      description: "A rough-and-tumble frontier town built on the ruins of a historic settlement. Safe haven for adventurers.",
      type: "town",
      x: 42,
      y: 65,
      isHidden: false,
      isDiscovered: true,
      connectedTo: ["cragmaw_castle", "wave_echo_cave", "high_road", "redbrand_hideout"],
      dangerLevel: 1,
      cityMapImageUrl: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80&w=1200",
      cityBuildings: [
        {
          id: "stonehill_inn",
          name: "Stonehill Inn & Tavern",
          description: "A comfortable, two-story stone-and-timber roadhouse. The hearth is warm, the ale is hearty, and adventurers gather here to trade rumors.",
          type: "tavern",
          x: 48,
          y: 52,
          imageUrl: "https://images.unsplash.com/photo-1543007630-9710e4a00a20?auto=format&fit=crop&q=80&w=1200",
          interiorMaps: [
            {
              id: "map_stonehill_taproom",
              locationId: "phandalin",
              name: "Stonehill Inn - Main Taproom & Hearth",
              description: "The ground floor taproom of the Stonehill Inn. Sturdy oak tables, a crackling stone fireplace, and a lively bar.",
              imageUrl: "https://images.unsplash.com/photo-1543007630-9710e4a00a20?auto=format&fit=crop&q=80&w=1200",
              gridCols: 14,
              gridRows: 10,
              showGrid: true,
              tokens: []
            },
            {
              id: "map_stonehill_cellar",
              locationId: "phandalin",
              name: "Stonehill Inn - Wine Cellar & Storeroom",
              description: "Underground cold storage for casks of Dwarven Stout and provisions.",
              imageUrl: "https://images.unsplash.com/photo-1590402494682-cd3fb53b1f70?auto=format&fit=crop&q=80&w=1200",
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
          description: "A sturdy stone building with a small bell tower. Harbin Wester holds court here and posts bounties for goblin raiders.",
          type: "civic",
          x: 68,
          y: 35,
          imageUrl: "https://images.unsplash.com/photo-1584968153986-3fbae48835a7?auto=format&fit=crop&q=80&w=1200"
        },
        {
          id: "barthens_provisions",
          name: "Barthen's Provisions",
          description: "The biggest general trading post in Phandalin, stocking adventuring gear, rations, and mining supplies.",
          type: "shop",
          x: 32,
          y: 40,
          imageUrl: "https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&q=80&w=1200"
        },
        {
          id: "sleeping_giant",
          name: "Sleeping Giant Taphouse",
          description: "A rundown, rowdy alehouse at the eastern end of town. Frequented by rough miners and Redbrand thugs.",
          type: "tavern",
          x: 82,
          y: 68,
          imageUrl: "https://images.unsplash.com/photo-1572116469696-31de0f17cc34?auto=format&fit=crop&q=80&w=1200"
        },
        {
          id: "tresendar_manor",
          name: "Tresendar Manor (Ruins)",
          description: "An abandoned manor perched on the eastern hillside. Ancient cellars are rumored to delve deep underground.",
          type: "ruin",
          x: 85,
          y: 22,
          imageUrl: "https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&q=80&w=1200"
        },
        {
          id: "shrine_of_luck",
          name: "Shrine of Luck (Tymora)",
          description: "Phandalin's only temple, constructed of stones taken from ancient ruins. Tended by Sister Garaele.",
          type: "temple",
          x: 24,
          y: 62,
          imageUrl: "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&q=80&w=1200"
        }
      ]
    },
    {
      id: "redbrand_hideout",
      name: "Redbrand Hideout",
      description: "The cellars underneath Tresendar Manor, currently used as a base of operations by the Redbrand ruffians.",
      type: "dungeon",
      x: 35,
      y: 78,
      isHidden: true, // Hidden location!
      isDiscovered: false,
      connectedTo: ["phandalin"],
      dangerLevel: 2
    },
    {
      id: "wave_echo_cave",
      name: "Wave Echo Cave",
      description: "The fabled lost mine of Phandelver, rich with magical ores and defended by the sinister Black Spider.",
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
      description: "A completely abandoned village reclaimed by overgrowth. Home to Agatha the banshee's grove.",
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
      description: "The coastal trading highway stretching south, with sea breezes and rocky cliffs prone to bandit raids.",
      type: "shrine",
      x: 12,
      y: 50,
      isHidden: false,
      isDiscovered: true,
      connectedTo: ["neverwinter", "phandalin"],
      dangerLevel: 2
    },
    // Underdark Locations (Connected via wave_echo_cave)
    {
      id: "underdark_passage",
      name: "The Shadow Portal",
      description: "A glowing crevasse in Wave Echo Cave descending deep into the subterranean caverns.",
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
      description: "A massive subterranean city of the Duergar dwarfs, filled with smelting smoke and continuous anvil hammers.",
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
      description: "A kuo-toan settlement built on the edges of the Darklake, worshiping the bizarre water god Demogorgon.",
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
      description: "A hidden arachnid cathedral, pulsing with violet light, sacred to the Spider Queen.",
      type: "shrine",
      x: 45,
      y: 20,
      isHidden: true, // Hidden Underdark location
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
      stats: { strength: 18, dexterity: 18, constitution: 18, intelligence: 20, wisdom: 20, charisma: 20 },
      voice: "Charon",
      avatarUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=200"
    },
    {
      id: "valerius",
      name: "Valerius Stoneforge",
      race: "Mountain Dwarf",
      className: "Oath of Devotion Paladin",
      level: 5,
      hp: { current: 48, max: 48 },
      stats: { strength: 16, dexterity: 10, constitution: 15, intelligence: 10, wisdom: 14, charisma: 14 },
      voice: "Fenrir",
      avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200"
    },
    {
      id: "aria",
      name: "Aria Whispershade",
      race: "Wood Elf",
      className: "Arcane Trickster Rogue",
      level: 5,
      hp: { current: 36, max: 36 },
      stats: { strength: 10, dexterity: 18, constitution: 12, intelligence: 14, wisdom: 13, charisma: 12 },
      voice: "Puck",
      avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=200"
    },
    {
      id: "elara",
      name: "Elara Suncrest",
      race: "High Elf",
      className: "Evocation Wizard",
      level: 5,
      hp: { current: 28, max: 28 },
      stats: { strength: 8, dexterity: 14, constitution: 12, intelligence: 18, wisdom: 15, charisma: 10 },
      voice: "Kore",
      avatarUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=200"
    },
    {
      id: "maldor",
      name: "Archmage Maldor",
      race: "Human",
      className: "Wild Magic Sorcerer",
      level: 5,
      hp: { current: 32, max: 32 },
      stats: { strength: 9, dexterity: 13, constitution: 14, intelligence: 11, wisdom: 11, charisma: 17 },
      voice: "Zephyr",
      avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200"
    }
  ],
  notes: [
    {
      id: "init_note_1",
      title: "The Lost Mine Legend",
      content: "Ancestors of the Stoneforge clan spoke of Wave Echo Cave. It holds the Forge of Spells, a source of legendary magic tools. We must search for clues near Phandalin town.",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      authorCharacterId: "valerius",
      category: "quest"
    },
    {
      id: "init_note_2",
      title: "Redbrand Menace Info",
      content: "Townsfolk whisper that a gang known as the Redbrands is terrorizing Phandalin. Their leader goes by the name 'Glasstaff'. It's rumored their main lair is somewhere hidden under Tresendar Manor.",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      authorCharacterId: "dm",
      category: "lore"
    }
  ],
  recentRolls: [],
  initiativeOrder: [],
  initiativeRound: 1,
  currentTurnIndex: 0
};

let latestStateVersion = 1;
let campaignWss: WebSocketServer | null = null;

// Ensure configuration / save mechanism works smoothly
function readCampaignState(): CampaignState {
  try {
    if (fs.existsSync(CAMPAIGN_FILE)) {
      const data = fs.readFileSync(CAMPAIGN_FILE, "utf-8");
      const parsed = JSON.parse(data) as CampaignState;
      if (typeof parsed.stateVersion === "number" && parsed.stateVersion > latestStateVersion) {
        latestStateVersion = parsed.stateVersion;
      }
      return parsed;
    }
  } catch (err) {
    console.error("Error reading campaign file, returning defaults:", err);
  }
  return defaultCampaignState;
}

function writeCampaignState(state: CampaignState) {
  try {
    fs.writeFileSync(CAMPAIGN_FILE, JSON.stringify(state, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing campaign file:", err);
  }
}

function broadcastCampaignState(state: CampaignState, eventType: "campaign:init" | "campaign:updated" = "campaign:updated") {
  if (!campaignWss) return;
  const payload = JSON.stringify({
    type: eventType,
    version: state.stateVersion || latestStateVersion,
    campaign: state
  });
  campaignWss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(payload);
      } catch (err) {
        console.warn("WebSocket broadcast send error:", err);
      }
    }
  });
}

function commitCampaignState(state: CampaignState, eventType: "campaign:init" | "campaign:updated" = "campaign:updated"): CampaignState {
  latestStateVersion = Math.max(latestStateVersion + 1, (state.stateVersion || 0) + 1);
  state.stateVersion = latestStateVersion;
  writeCampaignState(state);
  broadcastCampaignState(state, eventType);
  return state;
}

// Lazy load Gemini AI to avoid crashes if GEMINI_API_KEY is not set yet
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is missing. Please configure it in Settings > Secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// REST Endpoints for Campaign status syncing and devices
app.get("/api/campaign", (req, res) => {
  const data = readCampaignState();
  res.json(data);
});

// Update campaign metadata (campaign name and party name)
app.post("/api/campaign/meta", (req, res) => {
  const campaign = readCampaignState();
  const { campaignName, partyName } = req.body;
  if (campaignName !== undefined) campaign.campaignName = campaignName;
  if (partyName !== undefined) campaign.partyName = partyName;
  commitCampaignState(campaign);
  res.json({ success: true, campaign });
});

// Update characters - adding/updating a hero
app.post("/api/campaign/character", (req, res) => {
  const campaign = readCampaignState();
  const character: Character = req.body;
  
  if (!character.id) {
    character.id = "char_" + Date.now();
  }

  const idx = campaign.characters.findIndex(c => c.id === character.id);
  if (idx > -1) {
    campaign.characters[idx] = character;
  } else {
    campaign.characters.push(character);
  }

  commitCampaignState(campaign);
  res.json({ success: true, character, campaign });
});

// Delete a character
app.post("/api/campaign/character/delete", (req, res) => {
  const campaign = readCampaignState();
  const { characterId } = req.body;
  if (!characterId) return res.status(400).json({ error: "characterId is required" });
  campaign.characters = campaign.characters.filter(c => c.id !== characterId);
  commitCampaignState(campaign);
  res.json({ success: true, campaign });
});

// Move Party along the map & auto-discover connected locations
app.post("/api/campaign/move", (req, res) => {
  const campaign = readCampaignState();
  const { targetLocationId } = req.body;

  const loc = campaign.locations.find((l) => l.id === targetLocationId);
  if (!loc) {
    return res.status(404).json({ error: "Location not found" });
  }

  // Set the current party position
  campaign.partyLocationId = targetLocationId;
  loc.isDiscovered = true;

  // Auto-reveal (set isDiscovered = true) for connected locations that are not hidden initially,
  // or unlock hidden nodes if already connected and moving next to them.
  loc.connectedTo.forEach((connId) => {
    const connectedLoc = campaign.locations.find((l) => l.id === connId);
    if (connectedLoc && !connectedLoc.isHidden) {
      connectedLoc.isDiscovered = true;
    }
  });

  commitCampaignState(campaign);
  res.json({ success: true, campaign });
});

// Toggle hidden status for Campaign location
app.post("/api/campaign/location/toggle-discovered", (req, res) => {
  const campaign = readCampaignState();
  const { locationId } = req.body;

  const loc = campaign.locations.find((l) => l.id === locationId);
  if (!loc) {
    return res.status(404).json({ error: "Location not found" });
  }

  loc.isDiscovered = !loc.isDiscovered;
  // If we discover a hidden node, unhide it!
  if (loc.isDiscovered && loc.isHidden) {
    loc.isHidden = false;
  }

  commitCampaignState(campaign);
  res.json({ success: true, campaign });
});

// Update location details (name, description, type, x, y, dangerLevel, imageUrl, condition, bossSlain, isHidden)
app.post("/api/campaign/location/update", (req, res) => {
  const campaign = readCampaignState();
  const { location } = req.body;
  if (!location || !location.id) {
    return res.status(400).json({ error: "Location data with ID is required" });
  }

  const idx = campaign.locations.findIndex((l) => l.id === location.id);
  if (idx === -1) {
    return res.status(404).json({ error: "Location not found" });
  }

  campaign.locations[idx] = {
    ...campaign.locations[idx],
    ...location
  };

  commitCampaignState(campaign);
  res.json({ success: true, location: campaign.locations[idx], campaign });
});

// Delete location from campaign map
app.post("/api/campaign/location/delete", (req, res) => {
  const campaign = readCampaignState();
  const { locationId } = req.body;
  if (!locationId) {
    return res.status(400).json({ error: "Location ID is required" });
  }

  campaign.locations = campaign.locations.filter((l) => l.id !== locationId);
  // Clean up references in connectedTo of other locations
  campaign.locations.forEach((loc) => {
    loc.connectedTo = loc.connectedTo.filter((id) => id !== locationId);
  });

  // If party was at deleted location, move party to first available location
  if (campaign.partyLocationId === locationId && campaign.locations.length > 0) {
    campaign.partyLocationId = campaign.locations[0].id;
    campaign.locations[0].isDiscovered = true;
  }

  commitCampaignState(campaign);
  res.json({ success: true, campaign });
});

// Toggle Boss Slain on location (renders X across map location)
app.post("/api/campaign/location/toggle-boss-slain", (req, res) => {
  const campaign = readCampaignState();
  const { locationId } = req.body;
  const loc = campaign.locations.find((l) => l.id === locationId);
  if (!loc) {
    return res.status(404).json({ error: "Location not found" });
  }

  loc.bossSlain = !loc.bossSlain;
  commitCampaignState(campaign);
  res.json({ success: true, location: loc, campaign });
});

// Toggle Hidden from Players (DM Eyes Only)
app.post("/api/campaign/location/toggle-hidden", (req, res) => {
  const campaign = readCampaignState();
  const { locationId } = req.body;
  const loc = campaign.locations.find((l) => l.id === locationId);
  if (!loc) {
    return res.status(404).json({ error: "Location not found" });
  }

  loc.isHidden = !loc.isHidden;
  commitCampaignState(campaign);
  res.json({ success: true, location: loc, campaign });
});

// Update or Modify Site Inside Battle Maps (Supports both Location and City Building battle maps)
app.post("/api/campaign/location/battlemap", (req, res) => {
  const campaign = readCampaignState();
  const { locationId, buildingId, interiorMaps, activeInteriorMapId } = req.body;

  const loc = campaign.locations.find((l) => l.id === locationId);
  if (!loc) {
    return res.status(404).json({ error: "Location not found" });
  }

  if (buildingId && Array.isArray(loc.cityBuildings)) {
    const bld = loc.cityBuildings.find((b) => b.id === buildingId);
    if (bld) {
      bld.interiorMaps = interiorMaps;
      if (activeInteriorMapId !== undefined) {
        bld.activeInteriorMapId = activeInteriorMapId;
      }
    } else {
      loc.interiorMaps = interiorMaps;
      if (activeInteriorMapId !== undefined) {
        loc.activeInteriorMapId = activeInteriorMapId;
      }
    }
  } else {
    loc.interiorMaps = interiorMaps;
    if (activeInteriorMapId !== undefined) {
      loc.activeInteriorMapId = activeInteriorMapId;
    }
  }

  if (
    activeInteriorMapId !== undefined &&
    campaign.liveView &&
    campaign.liveView.battleMapLocationId === locationId &&
    (campaign.liveView.battleMapBuildingId || null) === (buildingId || null)
  ) {
    campaign.liveView.activeInteriorMapId = activeInteriorMapId;
    campaign.liveView.updatedAt = new Date().toISOString();
  }

  commitCampaignState(campaign);
  res.json({ success: true, location: loc, campaign });
});

// Update Fog of War for any map level: 'region' | 'city' | 'building' | 'battlemap'
app.post("/api/campaign/fog", (req, res) => {
  const campaign = readCampaignState();
  const { targetType, regionId, locationId, buildingId, mapId, fogOfWar } = req.body;

  if (!targetType || !fogOfWar || typeof fogOfWar.enabled !== "boolean" || !Array.isArray(fogOfWar.strokes)) {
    return res.status(400).json({ success: false, error: "Invalid Fog of War payload" });
  }

  if (targetType === "region") {
    const reg = campaign.regions.find((r) => r.id === regionId);
    if (!reg) return res.status(404).json({ success: false, error: "Region not found" });
    reg.fogOfWar = fogOfWar;
  } else if (targetType === "city") {
    const loc = campaign.locations.find((l) => l.id === locationId);
    if (!loc) return res.status(404).json({ success: false, error: "Location not found" });
    loc.cityFogOfWar = fogOfWar;
  } else if (targetType === "building") {
    const loc = campaign.locations.find((l) => l.id === locationId);
    const bld = loc?.cityBuildings?.find((b) => b.id === buildingId);
    if (!bld) return res.status(404).json({ success: false, error: "Building not found" });
    bld.fogOfWar = fogOfWar;
  } else if (targetType === "battlemap") {
    const loc = campaign.locations.find((l) => l.id === locationId);
    if (!loc) return res.status(404).json({ success: false, error: "Location not found" });

    let mapsList = loc.interiorMaps;
    if (buildingId && Array.isArray(loc.cityBuildings)) {
      const bld = loc.cityBuildings.find((b) => b.id === buildingId);
      if (bld && Array.isArray(bld.interiorMaps)) {
        mapsList = bld.interiorMaps;
      }
    }

    const targetMap = mapsList?.find((m) => m.id === mapId);
    if (!targetMap) return res.status(404).json({ success: false, error: "Battle map not found" });
    targetMap.fogOfWar = fogOfWar;
  } else {
    return res.status(400).json({ success: false, error: "Unsupported Fog of War targetType" });
  }

  commitCampaignState(campaign);
  res.json({ success: true, campaign });
});

// Update Region Background Image (for Big Map & Region Maps)
app.post("/api/campaign/region/image", (req, res) => {
  const campaign = readCampaignState();
  const { regionId, imageUrl, name, description } = req.body;

  const reg = campaign.regions.find((r) => r.id === regionId);
  if (!reg) {
    return res.status(404).json({ error: "Region not found" });
  }

  if (imageUrl) reg.backgroundUrl = imageUrl;
  if (name) reg.name = name;
  if (description) reg.description = description;

  commitCampaignState(campaign);
  res.json({ success: true, region: reg, campaign });
});

// Export complete campaign save state as downloadable JSON file
app.get("/api/campaign/export-data", (req, res) => {
  try {
    const campaign = readCampaignState();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const safeName = (campaign.campaignName || "aethelgard").toLowerCase().replace(/[^a-z0-9_-]/g, "_");
    const filename = `${safeName}-campaign-save-${timestamp}.json`;

    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.send(JSON.stringify(campaign, null, 2));
  } catch (err: any) {
    console.error("Export error:", err);
    res.status(500).json({ success: false, error: "Failed to export campaign data" });
  }
});

// Import complete campaign save state from JSON
app.post("/api/campaign/import-data", (req, res) => {
  try {
    let payload = req.body;
    if (typeof payload === "string") {
      try {
        payload = JSON.parse(payload);
      } catch (e) {
        return res.status(400).json({ success: false, error: "Invalid JSON syntax in uploaded file" });
      }
    }

    // Unwrap if wrapped inside { campaign: ... } or { state: ... }
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

    // Sanitize and ensure clean fallback defaults without leaking stale fields from current session
    const sanitizedCampaign: CampaignState = {
      ...defaultCampaignState,
      ...imported,
      currentRegionId: imported.currentRegionId || defaultCampaignState.currentRegionId,
      partyLocationId: imported.partyLocationId || defaultCampaignState.partyLocationId,
      campaignName: imported.campaignName || "Aethelgard",
      partyName: imported.partyName || "Campaign Party Alliance",
      regions: Array.isArray(imported.regions) && imported.regions.length > 0 ? imported.regions : defaultCampaignState.regions,
      locations: Array.isArray(imported.locations) ? imported.locations : defaultCampaignState.locations,
      characters: Array.isArray(imported.characters) ? imported.characters : defaultCampaignState.characters,
      notes: Array.isArray(imported.notes) ? imported.notes : [],
      recentRolls: Array.isArray(imported.recentRolls) ? imported.recentRolls : [],
      initiativeOrder: Array.isArray(imported.initiativeOrder) ? imported.initiativeOrder : [],
      initiativeRound: typeof imported.initiativeRound === "number" ? imported.initiativeRound : 1,
      currentTurnIndex: typeof imported.currentTurnIndex === "number" ? imported.currentTurnIndex : 0,
      mediaLibrary: Array.isArray(imported.mediaLibrary) ? imported.mediaLibrary : []
    };

    commitCampaignState(sanitizedCampaign);
    console.log(`Campaign imported successfully: ${sanitizedCampaign.locations.length} locations, ${sanitizedCampaign.characters.length} characters.`);
    res.json({ success: true, campaign: sanitizedCampaign });
  } catch (err: any) {
    console.error("Error importing campaign state:", err);
    res.status(500).json({ success: false, error: err.message || "Failed to process import data" });
  }
});

// Add exciting Custom Region or Location to Map
app.post("/api/campaign/location/create", (req, res) => {
  const campaign = readCampaignState();
  const { name, description, type, x, y, isHidden } = req.body;

  if (!name || x === undefined || y === undefined) {
    return res.status(400).json({ error: "Missing required location inputs" });
  }

  const newLoc: CampaignLocation = {
    id: "loc_" + Date.now(),
    name,
    description: description || "Undiscovered territory of Faerûn.",
    type: type || "cave",
    x,
    y,
    isHidden: !!isHidden,
    isDiscovered: !isHidden,
    connectedTo: [campaign.partyLocationId], // Connect dynamically to present spot
    dangerLevel: Math.floor(Math.random() * 4) + 1
  };

  // Bind reverse connection to keep bidirectional paths
  const parentLoc = campaign.locations.find(l => l.id === campaign.partyLocationId);
  if (parentLoc) {
    parentLoc.connectedTo.push(newLoc.id);
  }

  campaign.locations.push(newLoc);
  commitCampaignState(campaign);
  res.json({ success: true, location: newLoc, campaign });
});

// Sync Journal Notes (REST CRUD with file persistence for instant cloud-state replication)
app.post("/api/notes", (req, res) => {
  const campaign = readCampaignState();
  const { id, title, content, authorCharacterId, category } = req.body;

  if (!title || !content) {
    return res.status(400).json({ error: "Missing title or content" });
  }

  const newNote: JournalNote = {
    id: id || "note_" + Date.now(),
    title,
    content,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    authorCharacterId: authorCharacterId || "dm",
    category: category || "session"
  };

  const idx = campaign.notes.findIndex(n => n.id === newNote.id);
  if (idx > -1) {
    campaign.notes[idx] = {
      ...campaign.notes[idx],
      title,
      content,
      category: category || campaign.notes[idx].category,
      updatedAt: new Date().toISOString()
    };
  } else {
    campaign.notes.unshift(newNote);
  }

  commitCampaignState(campaign);
  res.json({ success: true, note: newNote, campaign });
});

app.delete("/api/notes/:id", (req, res) => {
  const campaign = readCampaignState();
  const { id } = req.params;

  campaign.notes = campaign.notes.filter(n => n.id !== id);
  commitCampaignState(campaign);
  res.json({ success: true, campaign });
});

// Sync Dice Roll events log so all players see them
app.post("/api/dice/log", (req, res) => {
  const campaign = readCampaignState();
  const roll: DiceRollResult = req.body;

  roll.id = roll.id || "roll_" + Date.now();
  roll.timestamp = new Date().toISOString();

  campaign.recentRolls.unshift(roll);
  // Cap at 30 rolls to save file performance
  if (campaign.recentRolls.length > 30) {
    campaign.recentRolls.pop();
  }

  commitCampaignState(campaign);
  res.json({ success: true, recentRolls: campaign.recentRolls });
});

// Update Initiative Order state
app.post("/api/campaign/initiative", (req, res) => {
  const campaign = readCampaignState();
  const { initiativeOrder, initiativeRound, currentTurnIndex } = req.body;

  if (initiativeOrder !== undefined) {
    campaign.initiativeOrder = initiativeOrder;
  }
  if (initiativeRound !== undefined) {
    campaign.initiativeRound = initiativeRound;
  }
  if (currentTurnIndex !== undefined) {
    campaign.currentTurnIndex = currentTurnIndex;
  }

  commitCampaignState(campaign);
  res.json({
    success: true,
    campaign
  });
});

// Broadcast DM live active map / room / battle view for multi-browser Player sync
app.post("/api/campaign/live-view", (req, res) => {
  const campaign = readCampaignState();
  const incoming = req.body as Partial<LiveViewState>;
  if (!incoming || typeof incoming !== "object") {
    return res.status(400).json({ success: false, error: "Invalid liveView payload" });
  }

  if (incoming.regionId) {
    campaign.currentRegionId = incoming.regionId;
  }

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
    updatedAt: new Date().toISOString()
  };

  commitCampaignState(campaign);
  res.json({ success: true, campaign });
});

// Character Speak Speech Generation Engine (using Gemini TTS)
app.post("/api/character/speak", async (req, res) => {
  const { characterId, promptContext, customLine } = req.body;

  if (!characterId) {
    return res.status(400).json({ error: "Character ID is required" });
  }

  const campaign = readCampaignState();
  const char = campaign.characters.find(c => c.id === characterId);
  if (!char) {
    return res.status(404).json({ error: "Character not found in campaign" });
  }

  try {
    let textToSpeak = customLine;

    // 1. If no custom line is provided, call Gemini to generate a tailored D&D dialogue line
    if (!textToSpeak) {
      const prompt = `You are a D&D character speaking in a local campaign. 
Character Name: ${char.name}
Character Race & Class: ${char.race} ${char.className}
Context or Scenario: ${promptContext || 'Standard conversation in the local tavern.'}

Write a short, immersive, highly in-character speaking line (1 to 3 sentences maximum, no metadata, no parentheses, no stage instructions, just the spoken words matching their class and lore!). Use rich tavern/mystic roleplay style.`;

      const ai = getGeminiClient();
      const textResponse = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
      });

      textToSpeak = textResponse.text || "I have nothing to say at this moment, traveler.";
    }

    // Strip any quotes that the LLM may wrap around character dialogue
    textToSpeak = textToSpeak.replace(/^["']|["']$/g, "").trim();

    // 2. Generate actual audio base64 using tts preview
    // Select Voice Name Map based on stats or preset character voice
    // Prebuilt names are: 'Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'
    const voiceName = char.voice || "Zephyr";

    const ai = getGeminiClient();
    const ttsResponse = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      // Guide voice emotional tonality in the instruction
      contents: [{ parts: [{ text: `Speak in a matching roleplay style: ${textToSpeak}` }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });

    const base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    res.json({
      success: true,
      text: textToSpeak,
      voiceName,
      audio: base64Audio || null,
    });

  } catch (error: any) {
    console.error("Error generating dialogue speech:", error);
    // Provide a super clean web fallback if GEMINI_API_KEY is not defined or hits issues
    res.json({
      success: false,
      text: customLine || `Hail traveler! My name is ${char.name}. (API Voice fallback active: please check your GEMINI_API_KEY setup in the top-right Secrets tab.)`,
      error: error.message,
      voiceName: char.voice,
      audio: null // clients will fall back to SpeechSynthesis or play a placeholder sound
    });
  }
});


// Hot Module Replacement (HMR) and dev server setup
async function startServer() {
  let viteServer: Awaited<ReturnType<typeof createViteServer>> | null = null;

  if (process.env.NODE_ENV !== "production") {
    viteServer = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === "true" ? false : undefined,
      },
      appType: "spa",
    });
    app.use(viteServer.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });
  campaignWss = wss;

  wss.on("connection", (ws) => {
    try {
      const current = readCampaignState();
      ws.send(
        JSON.stringify({
          type: "campaign:init",
          version: current.stateVersion || latestStateVersion,
          campaign: current
        })
      );
    } catch (err) {
      console.warn("WebSocket init send error:", err);
    }

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg?.type === "request:sync") {
          const current = readCampaignState();
          ws.send(
            JSON.stringify({
              type: "campaign:init",
              version: current.stateVersion || latestStateVersion,
              campaign: current
            })
          );
        }
      } catch {
        // Ignore malformed client frames
      }
    });
  });

  server.on("upgrade", (req, socket, head) => {
    const pathname = (req.url || "").split("?")[0];
    if (pathname === "/ws/campaign") {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    }
  });

  server.listen(PORT, HOST, () => {
    console.log(`\n  VITE v6.2.3  ready in 180 ms\n`);
    console.log(`  ➜  Local:   http://localhost:${PORT}/`);
    console.log(`  ➜  Network: http://${HOST}:${PORT}/\n`);
    console.log(`D&D Companion Server + Live WebSocket running at http://${HOST}:${PORT}`);
  });

  const cleanup = async () => {
    const forceTimer = setTimeout(() => process.exit(0), 1500);
    forceTimer.unref();
    wss.clients.forEach((client) => {
      try {
        client.close();
      } catch {
        // Ignore
      }
    });
    if (viteServer) {
      try {
        await viteServer.close();
      } catch {
        // Ignore
      }
    }
    if (typeof (server as any).closeAllConnections === "function") {
      (server as any).closeAllConnections();
    }
    server.close(() => {
      process.exit(0);
    });
  };

  process.on("SIGTERM", cleanup);
  process.on("SIGINT", cleanup);
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
