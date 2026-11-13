import express from "express";
import path from "path";
import fs from "fs";
import { exec } from "child_process";
import { CampaignState } from "./src/types";

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Target working folder is the directory where the .exe / script is placed
const WORKING_DIR = process.cwd();
const CAMPAIGN_FILE = path.join(WORKING_DIR, "campaign-data.json");

// Default initial state for fresh standalone installations
const defaultCampaignState = {
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
      isHidden: true,
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

function readCampaignState() {
  try {
    if (fs.existsSync(CAMPAIGN_FILE)) {
      const data = fs.readFileSync(CAMPAIGN_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("Error reading campaign file, returning defaults:", err);
  }
  return defaultCampaignState;
}

function writeCampaignState(state: any) {
  try {
    fs.writeFileSync(CAMPAIGN_FILE, JSON.stringify(state, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing campaign file:", err);
  }
}

// Ensure campaign file exists on startup
if (!fs.existsSync(CAMPAIGN_FILE)) {
  writeCampaignState(defaultCampaignState);
}

// REST Endpoints
app.get("/api/campaign", (req, res) => {
  res.json(readCampaignState());
});

app.post("/api/campaign/meta", (req, res) => {
  const campaign = readCampaignState();
  const { campaignName, partyName } = req.body;
  if (campaignName !== undefined) campaign.campaignName = campaignName;
  if (partyName !== undefined) campaign.partyName = partyName;
  writeCampaignState(campaign);
  res.json({ success: true, campaign });
});

app.post("/api/campaign/character", (req, res) => {
  const campaign = readCampaignState();
  const character = req.body;
  if (!character.id) character.id = "char_" + Date.now();
  const idx = campaign.characters.findIndex((c: any) => c.id === character.id);
  if (idx > -1) campaign.characters[idx] = character;
  else campaign.characters.push(character);
  writeCampaignState(campaign);
  res.json({ success: true, character, campaign });
});

app.post("/api/campaign/character/delete", (req, res) => {
  const campaign = readCampaignState();
  const { characterId } = req.body;
  if (!characterId) return res.status(400).json({ error: "characterId is required" });
  campaign.characters = campaign.characters.filter((c: any) => c.id !== characterId);
  writeCampaignState(campaign);
  res.json({ success: true, campaign });
});

app.post("/api/campaign/move", (req, res) => {
  const campaign = readCampaignState();
  const { targetLocationId } = req.body;
  const loc = campaign.locations.find((l: any) => l.id === targetLocationId);
  if (!loc) return res.status(404).json({ error: "Location not found" });
  campaign.partyLocationId = targetLocationId;
  loc.isDiscovered = true;
  loc.connectedTo.forEach((connId: string) => {
    const connectedLoc = campaign.locations.find((l: any) => l.id === connId);
    if (connectedLoc && !connectedLoc.isHidden) connectedLoc.isDiscovered = true;
  });
  writeCampaignState(campaign);
  res.json({ success: true, campaign });
});

app.post("/api/campaign/location/toggle-discovered", (req, res) => {
  const campaign = readCampaignState();
  const { locationId } = req.body;
  const loc = campaign.locations.find((l: any) => l.id === locationId);
  if (!loc) return res.status(404).json({ error: "Location not found" });
  loc.isDiscovered = !loc.isDiscovered;
  if (loc.isDiscovered && loc.isHidden) loc.isHidden = false;
  writeCampaignState(campaign);
  res.json({ success: true, campaign });
});

app.post("/api/campaign/location/update", (req, res) => {
  const campaign = readCampaignState();
  const { location } = req.body;
  if (!location || !location.id) return res.status(400).json({ error: "Location data required" });
  const idx = campaign.locations.findIndex((l: any) => l.id === location.id);
  if (idx === -1) return res.status(404).json({ error: "Location not found" });
  campaign.locations[idx] = { ...campaign.locations[idx], ...location };
  writeCampaignState(campaign);
  res.json({ success: true, location: campaign.locations[idx], campaign });
});

app.post("/api/campaign/location/delete", (req, res) => {
  const campaign = readCampaignState();
  const { locationId } = req.body;
  if (!locationId) return res.status(400).json({ error: "Location ID required" });
  campaign.locations = campaign.locations.filter((l: any) => l.id !== locationId);
  campaign.locations.forEach((loc: any) => {
    loc.connectedTo = loc.connectedTo.filter((id: string) => id !== locationId);
  });
  if (campaign.partyLocationId === locationId && campaign.locations.length > 0) {
    campaign.partyLocationId = campaign.locations[0].id;
    campaign.locations[0].isDiscovered = true;
  }
  writeCampaignState(campaign);
  res.json({ success: true, campaign });
});

app.post("/api/campaign/location/toggle-boss-slain", (req, res) => {
  const campaign = readCampaignState();
  const { locationId } = req.body;
  const loc = campaign.locations.find((l: any) => l.id === locationId);
  if (!loc) return res.status(404).json({ error: "Location not found" });
  loc.bossSlain = !loc.bossSlain;
  writeCampaignState(campaign);
  res.json({ success: true, location: loc, campaign });
});

app.post("/api/campaign/location/toggle-hidden", (req, res) => {
  const campaign = readCampaignState();
  const { locationId } = req.body;
  const loc = campaign.locations.find((l: any) => l.id === locationId);
  if (!loc) return res.status(404).json({ error: "Location not found" });
  loc.isHidden = !loc.isHidden;
  writeCampaignState(campaign);
  res.json({ success: true, location: loc, campaign });
});

app.post("/api/campaign/location/battlemap", (req, res) => {
  const campaign = readCampaignState();
  const { locationId, interiorMaps, activeInteriorMapId } = req.body;
  const loc = campaign.locations.find((l: any) => l.id === locationId);
  if (!loc) return res.status(404).json({ error: "Location not found" });
  loc.interiorMaps = interiorMaps;
  if (activeInteriorMapId !== undefined) loc.activeInteriorMapId = activeInteriorMapId;
  writeCampaignState(campaign);
  res.json({ success: true, location: loc, campaign });
});

app.post("/api/campaign/region/image", (req, res) => {
  const campaign = readCampaignState();
  const { regionId, imageUrl, name, description } = req.body;
  const reg = campaign.regions.find((r: any) => r.id === regionId);
  if (!reg) return res.status(404).json({ error: "Region not found" });
  if (imageUrl) reg.backgroundUrl = imageUrl;
  if (name) reg.name = name;
  if (description) reg.description = description;
  writeCampaignState(campaign);
  res.json({ success: true, region: reg, campaign });
});

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

    const currentState = readCampaignState();
    const sanitizedCampaign: CampaignState = {
      ...defaultCampaignState,
      ...currentState,
      ...imported,
      currentRegionId: imported.currentRegionId || currentState.currentRegionId || "sword_coast",
      partyLocationId: imported.partyLocationId || currentState.partyLocationId || "phandalin",
      campaignName: imported.campaignName || currentState.campaignName || "Aethelgard",
      partyName: imported.partyName || currentState.partyName || "Campaign Party Alliance",
      regions: Array.isArray(imported.regions) && imported.regions.length > 0 ? imported.regions : currentState.regions,
      locations: Array.isArray(imported.locations) ? imported.locations : currentState.locations,
      characters: Array.isArray(imported.characters) ? imported.characters : currentState.characters,
      notes: Array.isArray(imported.notes) ? imported.notes : (currentState.notes || []),
      recentRolls: Array.isArray(imported.recentRolls) ? imported.recentRolls : (currentState.recentRolls || []),
      initiativeOrder: Array.isArray(imported.initiativeOrder) ? imported.initiativeOrder : (currentState.initiativeOrder || []),
      initiativeRound: typeof imported.initiativeRound === "number" ? imported.initiativeRound : 1,
      currentTurnIndex: typeof imported.currentTurnIndex === "number" ? imported.currentTurnIndex : 0
    };

    writeCampaignState(sanitizedCampaign);
    res.json({ success: true, campaign: sanitizedCampaign });
  } catch (err: any) {
    console.error("Error importing campaign state:", err);
    res.status(500).json({ success: false, error: err.message || "Failed to process import data" });
  }
});

app.post("/api/campaign/location/create", (req, res) => {
  const campaign = readCampaignState();
  const { name, description, type, x, y, isHidden } = req.body;
  if (!name || x === undefined || y === undefined) return res.status(400).json({ error: "Missing required inputs" });
  const newLoc = {
    id: "loc_" + Date.now(),
    name,
    description: description || "Undiscovered territory of Faerûn.",
    type: type || "cave",
    x,
    y,
    isHidden: !!isHidden,
    isDiscovered: !isHidden,
    connectedTo: [campaign.partyLocationId],
    dangerLevel: Math.floor(Math.random() * 4) + 1
  };
  const parentLoc = campaign.locations.find((l: any) => l.id === campaign.partyLocationId);
  if (parentLoc) parentLoc.connectedTo.push(newLoc.id);
  campaign.locations.push(newLoc);
  writeCampaignState(campaign);
  res.json({ success: true, location: newLoc, campaign });
});

app.post("/api/notes", (req, res) => {
  const campaign = readCampaignState();
  const { id, title, content, authorCharacterId, category } = req.body;
  if (!title || !content) return res.status(400).json({ error: "Missing title or content" });
  const newNote = {
    id: id || "note_" + Date.now(),
    title,
    content,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    authorCharacterId: authorCharacterId || "dm",
    category: category || "session"
  };
  const idx = campaign.notes.findIndex((n: any) => n.id === newNote.id);
  if (idx > -1) campaign.notes[idx] = { ...campaign.notes[idx], title, content, category, updatedAt: new Date().toISOString() };
  else campaign.notes.unshift(newNote);
  writeCampaignState(campaign);
  res.json({ success: true, note: newNote, campaign });
});

app.delete("/api/notes/:id", (req, res) => {
  const campaign = readCampaignState();
  campaign.notes = campaign.notes.filter((n: any) => n.id !== req.params.id);
  writeCampaignState(campaign);
  res.json({ success: true, campaign });
});

app.post("/api/dice/log", (req, res) => {
  const campaign = readCampaignState();
  const roll = req.body;
  roll.id = roll.id || "roll_" + Date.now();
  roll.timestamp = new Date().toISOString();
  campaign.recentRolls.unshift(roll);
  if (campaign.recentRolls.length > 30) campaign.recentRolls.pop();
  writeCampaignState(campaign);
  res.json({ success: true, recentRolls: campaign.recentRolls });
});

app.post("/api/campaign/initiative", (req, res) => {
  const campaign = readCampaignState();
  const { initiativeOrder, initiativeRound, currentTurnIndex } = req.body;
  if (initiativeOrder !== undefined) campaign.initiativeOrder = initiativeOrder;
  if (initiativeRound !== undefined) campaign.initiativeRound = initiativeRound;
  if (currentTurnIndex !== undefined) campaign.currentTurnIndex = currentTurnIndex;
  writeCampaignState(campaign);
  res.json({ success: true, campaign });
});

// Fallback dialogue engine for offline standalone mode
app.post("/api/character/speak", (req, res) => {
  const { characterId, promptContext, customLine } = req.body;
  const campaign = readCampaignState();
  const char = campaign.characters.find((c: any) => c.id === characterId);
  if (!char) return res.status(404).json({ error: "Character not found" });

  const roleplayQuotes: Record<string, string[]> = {
    valerius: [
      "By Moradin's hammer! We shall stand firm against whatever lurks in these shadows.",
      "Sharpen your blades, companions. The Stoneforge clan never backs down from a righteous battle.",
      "I sense ancient dwarven craftsmanship in these stones. Keep your shields raised."
    ],
    aria: [
      "Keep quiet... the shadows whisper of footsteps just ahead. Let me check for traps.",
      "A locked vault? Heh, nothing more than a welcoming challenge for these fingers.",
      "Careful where you tread! The Redbrands leave nasty surprises for uninvited guests."
    ],
    elara: [
      "The arcane leylines hum with unspent sorcery here. Prepare your incantations.",
      "Knowledge is our greatest armor, though a well-placed fireball rarely hurts either.",
      "The runes on this parchment speak of Netherese magic... proceed with reverence."
    ],
    maldor: [
      "Wild magic surges through my blood! Let's see what wonders the weave unveils today.",
      "Did you see that spark? Sometimes even I don't know which spell is about to erupt!",
      "A good adventure requires daring, a touch of chaos, and plenty of ale at the tavern."
    ],
    dm: [
      "The torchlight flickers as cold wind sweeps through the damp corridors of the ancient keep.",
      "Roll for initiative, brave travelers. Fate draws its sword upon this ground.",
      "Before you lies an ancient threshold. What do you choose to do?"
    ]
  };

  const pool = roleplayQuotes[char.id] || roleplayQuotes.dm;
  const text = customLine || pool[Math.floor(Math.random() * pool.length)];

  res.json({
    success: true,
    text,
    voiceName: char.voice,
    audio: null // browser client will smoothly use Web SpeechSynthesis
  });
});

// Serve static frontend assets from dist folder
const possibleDistPaths = [
  path.join(WORKING_DIR, "dist"),
  path.join(__dirname, "dist"),
  path.join(__dirname),
  WORKING_DIR
];

let distPath = possibleDistPaths.find(p => fs.existsSync(path.join(p, "index.html"))) || path.join(WORKING_DIR, "dist");

app.use(express.static(distPath));
app.get("*", (req, res) => {
  const indexPath = path.join(distPath, "index.html");
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.send(`
      <!DOCTYPE html>
      <html>
        <head><title>Aethelgard Standalone Server</title></head>
        <body style="background:#0c0e12;color:#f3f4f6;font-family:sans-serif;padding:40px;text-align:center;">
          <h1 style="color:#f59e0b;">Aethelgard Standalone Server Active</h1>
          <p>Listening on port ${PORT}. Ensure the 'dist' directory is placed next to this executable.</p>
        </body>
      </html>
    `);
  }
});

// Auto launch browser
function openBrowser(url: string) {
  const cmd = process.platform === "win32" 
    ? `start ${url}` 
    : process.platform === "darwin" 
    ? `open ${url}` 
    : `xdg-open ${url}`;
  
  exec(cmd, (err) => {
    if (err) console.log(`Please navigate to ${url} in your browser.`);
  });
}

// Start Server
app.listen(PORT, "0.0.0.0", () => {
  const url = `http://localhost:${PORT}`;
  console.log(`\n==============================================================`);
  console.log(` 🏰 AETHELGARD: D&D CAMPAIGN CONSOLE - STANDALONE EDITION`);
  console.log(`==============================================================`);
  console.log(` Server active at: ${url}`);
  console.log(` Game Save File:   ${CAMPAIGN_FILE}`);
  console.log(` All player progress, maps, initiative & notes auto-saved!`);
  console.log(`==============================================================\n`);
  
  openBrowser(url);
});
