import React, { useState, useRef, useEffect } from "react";
import { CampaignLocation, SiteBattleMap, MapToken, Character, LocationType } from "../types";
import { 
  X, 
  Upload, 
  Image as ImageIcon, 
  Grid, 
  Plus, 
  Trash2, 
  Edit3, 
  Shield, 
  Users, 
  Swords, 
  Move, 
  ZoomIn, 
  ZoomOut, 
  Eye, 
  EyeOff, 
  RotateCcw, 
  Sparkles, 
  Ruler, 
  Check, 
  Layers, 
  FolderPlus,
  Heart,
  Navigation,
  Skull
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface SiteBattleMapModalProps {
  location: CampaignLocation;
  characters: Character[];
  partyLocationId: string;
  onClose: () => void;
  onSaveBattleMaps: (locationId: string, interiorMaps: SiteBattleMap[], activeInteriorMapId: string) => Promise<void>;
}

// Preset Curated High-Resolution Battle Map Textures
const BATTLEMAP_PRESETS = [
  {
    id: "cavern",
    name: "Subterranean Cavern & Underground Pool",
    category: "cave",
    url: "https://images.unsplash.com/photo-1507163011986-e3d1796fd042?auto=format&fit=crop&q=80&w=1200",
    cols: 14,
    rows: 10
  },
  {
    id: "dungeon",
    name: "Ancient Stone Dungeon & Torch Vault",
    category: "dungeon",
    url: "https://images.unsplash.com/photo-1590402494682-cd3fb53b1f70?auto=format&fit=crop&q=80&w=1200",
    cols: 14,
    rows: 10
  },
  {
    id: "tavern",
    name: "Rustic Fantasy Tavern & Inn Floor",
    category: "town",
    url: "https://images.unsplash.com/photo-1543007630-9710e4a00a20?auto=format&fit=crop&q=80&w=1200",
    cols: 12,
    rows: 9
  },
  {
    id: "forest",
    name: "Mossy Forest Clearing & Dirt Path",
    category: "forest",
    url: "https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&q=80&w=1200",
    cols: 16,
    rows: 11
  },
  {
    id: "ruins",
    name: "Cracked Marble Ruins & Arcane Circle",
    category: "ruins",
    url: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80&w=1200",
    cols: 14,
    rows: 10
  },
  {
    id: "castle",
    name: "Fortress Stronghold & Stone Flagstones",
    category: "castle",
    url: "https://images.unsplash.com/photo-1584968153986-3fbae48835a7?auto=format&fit=crop&q=80&w=1200",
    cols: 15,
    rows: 10
  }
];

export default function SiteBattleMapModal({
  location,
  characters,
  partyLocationId,
  onClose,
  onSaveBattleMaps
}: SiteBattleMapModalProps) {
  // Determine initial maps or create default
  const getDefaultMap = (): SiteBattleMap => {
    const matchedPreset = BATTLEMAP_PRESETS.find(p => p.category === location.type) || BATTLEMAP_PRESETS[0];
    return {
      id: "map_" + Date.now(),
      locationId: location.id,
      name: `${location.name} - Tactical Chamber`,
      description: `Interior layout for ${location.name}. Prepared for tactical party positioning and battle encounters.`,
      imageUrl: matchedPreset.url,
      gridCols: matchedPreset.cols,
      gridRows: matchedPreset.rows,
      showGrid: true,
      gridColor: "rgba(255, 255, 255, 0.18)",
      tokens: []
    };
  };

  const [interiorMaps, setInteriorMaps] = useState<SiteBattleMap[]>(() => {
    if (location.interiorMaps && location.interiorMaps.length > 0) {
      return location.interiorMaps;
    }
    return [getDefaultMap()];
  });

  const [activeMapId, setActiveMapId] = useState<string>(() => {
    if (location.activeInteriorMapId && location.interiorMaps?.some(m => m.id === location.activeInteriorMapId)) {
      return location.activeInteriorMapId;
    }
    return location.interiorMaps?.[0]?.id || interiorMaps[0]?.id || "map_default";
  });

  // Current active map
  const activeMap = interiorMaps.find(m => m.id === activeMapId) || interiorMaps[0];

  // Tool selection: 'select' | 'place-hero' | 'spawn-enemy' | 'ruler'
  const [activeTool, setActiveTool] = useState<"select" | "place-hero" | "spawn-enemy" | "ruler">("select");
  const [selectedHeroToPlace, setSelectedHeroToPlace] = useState<Character | null>(null);
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);

  // Ruler state
  const [rulerStart, setRulerStart] = useState<{ x: number; y: number } | null>(null);
  const [rulerEnd, setRulerEnd] = useState<{ x: number; y: number } | null>(null);

  // Modals & Panels inside the viewer
  const [isImageImporterOpen, setIsImageImporterOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAddMapOpen, setIsAddMapOpen] = useState(false);

  // Image importer form states
  const [urlInput, setUrlInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Map settings edit form states
  const [editName, setEditName] = useState(activeMap.name);
  const [editCols, setEditCols] = useState(activeMap.gridCols);
  const [editRows, setEditRows] = useState(activeMap.gridRows);
  const [editShowGrid, setEditShowGrid] = useState(activeMap.showGrid);

  // New map form states
  const [newMapName, setNewMapName] = useState("");
  const [newMapCols, setNewMapCols] = useState(14);
  const [newMapRows, setNewMapRows] = useState(10);
  const [newMapPresetId, setNewMapPresetId] = useState("cavern");

  // Zoom scale
  const [zoom, setZoom] = useState(1);

  // Battle Map Fit Mode (Contain vs Cover)
  const [battleMapFitMode, setBattleMapFitMode] = useState<"contain" | "cover">("contain");

  // Custom Monster Spawner Modal state
  const [isCustomMonsterModalOpen, setIsCustomMonsterModalOpen] = useState(false);
  const [customMonsterName, setCustomMonsterName] = useState("Dire Wolf");
  const [customMonsterHp, setCustomMonsterHp] = useState(25);
  const [customMonsterType, setCustomMonsterType] = useState<"enemy" | "npc">("enemy");
  const [customMonsterImageUrl, setCustomMonsterImageUrl] = useState("");
  const [customMonsterColor, setCustomMonsterColor] = useState("#ef4444");
  const monsterFileInputRef = useRef<HTMLInputElement>(null);

  const MONSTER_PRESETS = [
    { name: "Goblin Raider", hp: 10, color: "#ef4444", avatarUrl: "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&q=80&w=300" },
    { name: "Orc Berserker", hp: 25, color: "#dc2626", avatarUrl: "https://images.unsplash.com/photo-1563089145-599997674d42?auto=format&fit=crop&q=80&w=300" },
    { name: "Skeleton Guard", hp: 13, color: "#991b1b", avatarUrl: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&q=80&w=300" },
    { name: "Young Red Dragon", hp: 110, color: "#7f1d1d", avatarUrl: "https://images.unsplash.com/photo-1577495508048-b635879837f1?auto=format&fit=crop&q=80&w=300" },
    { name: "Beholder Eye Tyrant", hp: 80, color: "#9333ea", avatarUrl: "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&q=80&w=300" },
    { name: "Tavern Brawler", hp: 18, color: "#d97706", avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=300" }
  ];

  // Sync edits to parent and server
  const saveChanges = async (updatedMaps: SiteBattleMap[], targetMapId = activeMapId) => {
    setInteriorMaps(updatedMaps);
    await onSaveBattleMaps(location.id, updatedMaps, targetMapId);
  };

  // Switch active map
  const handleSelectMap = (mapId: string) => {
    setActiveMapId(mapId);
    setSelectedTokenId(null);
    setRulerStart(null);
    setRulerEnd(null);
    const target = interiorMaps.find(m => m.id === mapId);
    if (target) {
      setEditName(target.name);
      setEditCols(target.gridCols);
      setEditRows(target.gridRows);
      setEditShowGrid(target.showGrid);
    }
    saveChanges(interiorMaps, mapId);
  };

  // Add new interior map floor
  const handleAddNewMap = async (e: React.FormEvent) => {
    e.preventDefault();
    const preset = BATTLEMAP_PRESETS.find(p => p.id === newMapPresetId) || BATTLEMAP_PRESETS[0];
    const newMap: SiteBattleMap = {
      id: "map_" + Date.now(),
      locationId: location.id,
      name: newMapName.trim() || `Level ${interiorMaps.length + 1} Chamber`,
      description: `Interior sector of ${location.name}.`,
      imageUrl: preset.url,
      gridCols: Number(newMapCols) || 14,
      gridRows: Number(newMapRows) || 10,
      showGrid: true,
      gridColor: "rgba(255, 255, 255, 0.18)",
      tokens: []
    };

    const updated = [...interiorMaps, newMap];
    setIsAddMapOpen(false);
    setNewMapName("");
    setActiveMapId(newMap.id);
    await saveChanges(updated, newMap.id);
  };

  // Delete current interior map
  const handleDeleteCurrentMap = async () => {
    if (interiorMaps.length <= 1) {
      if (window.confirm("Reset this interior map to a blank template?")) {
        const fresh = [getDefaultMap()];
        setActiveMapId(fresh[0].id);
        await saveChanges(fresh, fresh[0].id);
      }
      return;
    }

    if (window.confirm(`Delete inside map "${activeMap.name}"?`)) {
      const updated = interiorMaps.filter(m => m.id !== activeMap.id);
      const nextActiveId = updated[0].id;
      setActiveMapId(nextActiveId);
      await saveChanges(updated, nextActiveId);
    }
  };

  // Save map settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const updated = interiorMaps.map(m => {
      if (m.id === activeMap.id) {
        return {
          ...m,
          name: editName.trim() || m.name,
          gridCols: Math.max(6, Math.min(30, Number(editCols) || 12)),
          gridRows: Math.max(6, Math.min(30, Number(editRows) || 10)),
          showGrid: editShowGrid
        };
      }
      return m;
    });
    setIsSettingsOpen(false);
    await saveChanges(updated);
  };

  // Apply Imported Image (from URL or file upload)
  const handleApplyImage = async (url: string) => {
    if (!url.trim()) return;
    const updated = interiorMaps.map(m => {
      if (m.id === activeMap.id) {
        return { ...m, imageUrl: url.trim() };
      }
      return m;
    });
    setUrlInput("");
    setIsImageImporterOpen(false);
    await saveChanges(updated);
  };

  // Handle Local File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        await handleApplyImage(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  // Click on a Grid Cell (handles placement, token movement, ruler)
  const handleCellClick = async (x: number, y: number) => {
    // 1. If in Ruler mode:
    if (activeTool === "ruler") {
      if (!rulerStart) {
        setRulerStart({ x, y });
        setRulerEnd(null);
      } else {
        setRulerEnd({ x, y });
      }
      return;
    }

    // 2. If placing a hero from party:
    if (activeTool === "place-hero" && selectedHeroToPlace) {
      // Check if this hero is already on map; if so, move them to this cell!
      const existingToken = activeMap.tokens.find(t => t.characterId === selectedHeroToPlace.id);
      let updatedTokens: MapToken[];

      if (existingToken) {
        updatedTokens = activeMap.tokens.map(t => 
          t.id === existingToken.id ? { ...t, x, y } : t
        );
      } else {
        const newToken: MapToken = {
          id: "token_" + Date.now(),
          name: selectedHeroToPlace.name,
          characterId: selectedHeroToPlace.id,
          avatarUrl: selectedHeroToPlace.avatarUrl,
          type: "player",
          x,
          y,
          hp: selectedHeroToPlace.hp ? { current: selectedHeroToPlace.hp.current, max: selectedHeroToPlace.hp.max } : undefined
        };
        updatedTokens = [...activeMap.tokens, newToken];
      }

      const updatedMaps = interiorMaps.map(m => m.id === activeMap.id ? { ...m, tokens: updatedTokens } : m);
      setSelectedHeroToPlace(null);
      setActiveTool("select");
      await saveChanges(updatedMaps);
      return;
    }

    // 3. If moving an already-selected token to a new cell:
    if (selectedTokenId) {
      const token = activeMap.tokens.find(t => t.id === selectedTokenId);
      if (token && (token.x !== x || token.y !== y)) {
        const updatedTokens = activeMap.tokens.map(t => 
          t.id === selectedTokenId ? { ...t, x, y } : t
        );
        const updatedMaps = interiorMaps.map(m => m.id === activeMap.id ? { ...m, tokens: updatedTokens } : m);
        setSelectedTokenId(null);
        await saveChanges(updatedMaps);
        return;
      }
    }

    // 4. Default: If clicking a cell that has a token, select that token
    const tokenAtCell = activeMap.tokens.find(t => t.x === x && t.y === y);
    if (tokenAtCell) {
      setSelectedTokenId(tokenAtCell.id);
    } else {
      setSelectedTokenId(null);
    }
  };

  // Deploy All Party Members to map entrance (bottom-left area)
  const handleDeployAllParty = async () => {
    const existingCharIds = new Set(activeMap.tokens.map(t => t.characterId).filter(Boolean));
    const newTokens: MapToken[] = [];
    let startX = 1;
    let startY = activeMap.gridRows - 2;

    characters.forEach((char) => {
      if (char.id === "dm" && characters.length > 1) return;
      if (!existingCharIds.has(char.id)) {
        newTokens.push({
          id: "token_" + char.id + "_" + Date.now(),
          name: char.name,
          characterId: char.id,
          avatarUrl: char.avatarUrl,
          type: "player",
          x: Math.min(activeMap.gridCols - 1, startX),
          y: Math.max(0, startY),
          hp: char.hp ? { current: char.hp.current, max: char.hp.max } : undefined
        });
        startX++;
        if (startX > 4) {
          startX = 1;
          startY--;
        }
      }
    });

    const updatedTokens = [...activeMap.tokens, ...newTokens];
    const updatedMaps = interiorMaps.map(m => m.id === activeMap.id ? { ...m, tokens: updatedTokens } : m);
    await saveChanges(updatedMaps);
  };

  // Quick Spawn Monster / Adversary Token onto Map
  const handleSpawnEnemy = async (name: string, hp = 15, color = "#ef4444") => {
    // Find an empty cell near the top center
    let placedX = Math.floor(activeMap.gridCols / 2);
    let placedY = 2;

    // Shift if occupied
    while (activeMap.tokens.some(t => t.x === placedX && t.y === placedY) && placedY < activeMap.gridRows - 1) {
      placedX = (placedX + 1) % activeMap.gridCols;
      if (placedX === 0) placedY++;
    }

    const newEnemy: MapToken = {
      id: "enemy_" + Date.now(),
      name,
      type: "enemy",
      x: placedX,
      y: placedY,
      color,
      hp: { current: hp, max: hp }
    };

    const updatedTokens = [...activeMap.tokens, newEnemy];
    const updatedMaps = interiorMaps.map(m => m.id === activeMap.id ? { ...m, tokens: updatedTokens } : m);
    await saveChanges(updatedMaps);
  };

  // Handle Monster Token Picture File Upload
  const handleMonsterFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setCustomMonsterImageUrl(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  // Spawn Custom Monster Token onto battle grid
  const handleSpawnCustomMonster = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!customMonsterName.trim()) return;

    let placedX = Math.floor(activeMap.gridCols / 2);
    let placedY = 2;
    while (activeMap.tokens.some(t => t.x === placedX && t.y === placedY) && placedY < activeMap.gridRows - 1) {
      placedX = (placedX + 1) % activeMap.gridCols;
      if (placedX === 0) placedY++;
    }

    const newToken: MapToken = {
      id: "monster_" + Date.now(),
      name: customMonsterName.trim(),
      type: customMonsterType,
      avatarUrl: customMonsterImageUrl.trim() || undefined,
      color: customMonsterColor,
      x: placedX,
      y: placedY,
      hp: { current: customMonsterHp, max: customMonsterHp }
    };

    const updatedTokens = [...activeMap.tokens, newToken];
    const updatedMaps = interiorMaps.map(m => m.id === activeMap.id ? { ...m, tokens: updatedTokens } : m);
    setIsCustomMonsterModalOpen(false);
    await saveChanges(updatedMaps);
  };

  // Delete token from map
  const handleDeleteToken = async (tokenId: string) => {
    const updatedTokens = activeMap.tokens.filter(t => t.id !== tokenId);
    const updatedMaps = interiorMaps.map(m => m.id === activeMap.id ? { ...m, tokens: updatedTokens } : m);
    if (selectedTokenId === tokenId) setSelectedTokenId(null);
    await saveChanges(updatedMaps);
  };

  // Adjust token HP
  const handleTokenHpDelta = async (tokenId: string, delta: number) => {
    const updatedTokens = activeMap.tokens.map(t => {
      if (t.id === tokenId && t.hp) {
        const newHp = Math.max(0, Math.min(t.hp.max, t.hp.current + delta));
        return { ...t, hp: { ...t.hp, current: newHp } };
      }
      return t;
    });
    const updatedMaps = interiorMaps.map(m => m.id === activeMap.id ? { ...m, tokens: updatedTokens } : m);
    await saveChanges(updatedMaps);
  };

  // Calculate Ruler Distance
  const getRulerDistanceInFeet = () => {
    if (!rulerStart || !rulerEnd) return null;
    const dx = Math.abs(rulerEnd.x - rulerStart.x);
    const dy = Math.abs(rulerEnd.y - rulerStart.y);
    // Chebyshev (D&D 5e standard): max(dx, dy) * 5ft, or Euclidean
    const cells = Math.max(dx, dy);
    return cells * 5;
  };

  const selectedToken = activeMap.tokens.find(t => t.id === selectedTokenId);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col p-2 md:p-5 text-slate-200 overflow-hidden font-sans select-none animate-in fade-in duration-200">
      
      {/* TOP HEADER COMMAND BAR */}
      <div className="bg-[#0f1117] border border-white/10 rounded-2xl p-3 md:p-4 mb-3 flex flex-wrap items-center justify-between gap-3 shadow-2xl shrink-0">
        
        {/* Left: Multi-level Breadcrumbs & Location Identification */}
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-amber-500/10 border border-amber-500/30 text-amber-500 rounded-xl">
            <Swords className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5 text-3xs font-mono uppercase tracking-wider text-slate-400">
              <button 
                onClick={onClose}
                className="hover:text-amber-400 text-slate-400 transition-colors flex items-center space-x-0.5 cursor-pointer"
                title="Return to Realm Map"
              >
                <span>🌍 Realm Map</span>
              </button>
              <span>/</span>
              <button 
                onClick={onClose}
                className="hover:text-amber-400 text-slate-300 transition-colors flex items-center space-x-0.5 cursor-pointer"
                title="Return to Location / City"
              >
                <span>🏰 {location.name}</span>
              </button>
              <span>/</span>
              <span className="text-amber-400 font-bold">
                ⚔️ {activeMap.name}
              </span>
            </div>
            <div className="flex items-center space-x-2 mt-0.5">
              <h2 className="text-base font-serif italic text-white font-bold tracking-wide">
                {activeMap.name}
              </h2>
              <span className="text-3xs uppercase font-mono px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold">
                Tactical Grid {activeMap.gridCols}×{activeMap.gridRows}
              </span>
            </div>
          </div>
        </div>

        {/* Center: Interior Map Floor/Chamber Switcher Tabs */}
        <div className="flex items-center space-x-1.5 bg-[#141622] p-1 rounded-xl border border-white/5 overflow-x-auto max-w-full">
          {interiorMaps.map((m, idx) => (
            <button
              key={m.id}
              onClick={() => handleSelectMap(m.id)}
              className={`px-3 py-1.5 rounded-lg text-2xs font-mono uppercase transition-all whitespace-nowrap cursor-pointer flex items-center space-x-1.5 ${
                m.id === activeMap.id
                  ? "bg-amber-500 text-black font-bold shadow"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Layers className="w-3 h-3" />
              <span>{m.name || `Floor ${idx + 1}`}</span>
            </button>
          ))}

          {/* Add Another Inside Map Tab */}
          <button
            onClick={() => setIsAddMapOpen(true)}
            className="px-2.5 py-1.5 rounded-lg text-2xs font-mono uppercase bg-white/5 hover:bg-amber-500/15 text-slate-300 hover:text-amber-400 border border-dashed border-white/20 transition-all cursor-pointer flex items-center space-x-1"
            title="Add a new interior room, chamber, or level to this site"
          >
            <FolderPlus className="w-3 h-3 text-amber-500" />
            <span>+ Add Room</span>
          </button>
        </div>

        {/* Right: Map Actions (Fit Mode, Import Image, Settings, Delete, Close) */}
        <div className="flex items-center space-x-2">
          {/* Fit Map Picture Toggle (No Crop) */}
          <button
            onClick={() => setBattleMapFitMode(m => m === "contain" ? "cover" : "contain")}
            className={`px-3 py-1.5 rounded-lg text-2xs uppercase font-mono font-bold transition-all flex items-center space-x-1.5 cursor-pointer border ${
              battleMapFitMode === "contain"
                ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                : "bg-[#1a1c28] text-slate-300 border-white/10 hover:text-white"
            }`}
            title="Toggle between showing entire uncropped map picture vs filling grid"
          >
            <ImageIcon className="w-3.5 h-3.5 text-amber-500" />
            <span>{battleMapFitMode === "contain" ? "🖼️ Uncropped Fit" : "↔️ Fill Grid"}</span>
          </button>

          {/* Import / Change Image button */}
          <button
            onClick={() => setIsImageImporterOpen(true)}
            className="px-3 py-1.5 bg-[#1a1c28] hover:bg-amber-500/20 text-slate-200 hover:text-amber-300 border border-white/10 hover:border-amber-500/40 rounded-lg text-2xs uppercase font-mono font-bold transition-all flex items-center space-x-1.5 cursor-pointer shadow-sm"
            title="Import custom image/picture as the battle map of this site"
          >
            <Upload className="w-3.5 h-3.5 text-amber-500" />
            <span>Import Image</span>
          </button>

          {/* Map Settings button */}
          <button
            onClick={() => {
              setEditName(activeMap.name);
              setEditCols(activeMap.gridCols);
              setEditRows(activeMap.gridRows);
              setEditShowGrid(activeMap.showGrid);
              setIsSettingsOpen(true);
            }}
            className="p-1.5 bg-[#1a1c28] hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 rounded-lg transition-all cursor-pointer"
            title="Modify Grid Dimensions & Map Title"
          >
            <Edit3 className="w-4 h-4" />
          </button>

          {/* Delete current inside map */}
          <button
            onClick={handleDeleteCurrentMap}
            className="p-1.5 bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-500/30 rounded-lg transition-all cursor-pointer"
            title="Remove/Delete this inside battle map"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <div className="h-6 w-px bg-white/10 mx-1" />

          {/* Close Modal */}
          <button
            onClick={onClose}
            className="p-1.5 bg-white/5 hover:bg-red-950/50 text-slate-400 hover:text-red-400 border border-white/10 rounded-lg transition-all cursor-pointer"
            title="Exit Site Interior Map"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

      </div>

      {/* MAIN BATTLE MAP VIEWPORT & SIDE PANELS */}
      <div className="flex-1 flex flex-col lg:flex-row gap-3 min-h-0 overflow-hidden relative">
        
        {/* LEFT / CENTER: THE INTERACTIVE TACTICAL COMBAT GRID CANVAS */}
        <div className="flex-1 bg-[#0a0c10] border border-white/10 rounded-2xl overflow-hidden relative shadow-inner flex flex-col">
          
          {/* Canvas Floating Overlay Controls (Tools, Zoom, Ruler distance) */}
          <div className="absolute top-3 left-3 z-30 flex items-center space-x-2 bg-[#0f1117]/90 backdrop-blur border border-white/10 p-1.5 rounded-xl shadow-lg">
            
            {/* Tool: Select/Move */}
            <button
              onClick={() => {
                setActiveTool("select");
                setSelectedHeroToPlace(null);
                setRulerStart(null);
                setRulerEnd(null);
              }}
              className={`px-2.5 py-1 rounded text-3xs font-mono uppercase font-bold flex items-center space-x-1 cursor-pointer transition-all ${
                activeTool === "select"
                  ? "bg-amber-500 text-black shadow"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Move className="w-3 h-3" />
              <span>Select / Move</span>
            </button>

            {/* Tool: Ruler Range Tool */}
            <button
              onClick={() => {
                setActiveTool("ruler");
                setSelectedTokenId(null);
                setSelectedHeroToPlace(null);
                setRulerStart(null);
                setRulerEnd(null);
              }}
              className={`px-2.5 py-1 rounded text-3xs font-mono uppercase font-bold flex items-center space-x-1 cursor-pointer transition-all ${
                activeTool === "ruler"
                  ? "bg-amber-500 text-black shadow"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Ruler className="w-3 h-3" />
              <span>Range Ruler</span>
            </button>

            {/* Grid Visibility Toggle */}
            <button
              onClick={() => {
                const updated = interiorMaps.map(m => m.id === activeMap.id ? { ...m, showGrid: !m.showGrid } : m);
                saveChanges(updated);
              }}
              className={`p-1 rounded text-3xs font-mono uppercase transition-all ${
                activeMap.showGrid ? "text-amber-400" : "text-slate-500"
              }`}
              title="Toggle Grid Lines"
            >
              <Grid className="w-3.5 h-3.5" />
            </button>

            {/* Zoom Controls */}
            <div className="flex items-center space-x-1 border-l border-white/10 pl-2">
              <button
                onClick={() => setZoom(z => Math.max(0.7, z - 0.15))}
                className="p-1 hover:bg-white/10 text-slate-400 hover:text-white rounded"
                title="Zoom Out"
              >
                <ZoomOut className="w-3 h-3" />
              </button>
              <span className="text-3xs font-mono text-slate-400 w-8 text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => setZoom(z => Math.min(2.0, z + 0.15))}
                className="p-1 hover:bg-white/10 text-slate-400 hover:text-white rounded"
                title="Zoom In"
              >
                <ZoomIn className="w-3 h-3" />
              </button>
            </div>

            {/* Ruler Distance Result Readout */}
            {activeTool === "ruler" && rulerStart && rulerEnd && (
              <div className="ml-2 px-2 py-0.5 rounded bg-amber-500 text-black font-mono font-bold text-2xs animate-pulse">
                📏 {getRulerDistanceInFeet()} ft ({Math.max(Math.abs(rulerEnd.x - rulerStart.x), Math.abs(rulerEnd.y - rulerStart.y))} squares)
              </div>
            )}
          </div>

          {/* Quick Helper Floating Banner */}
          <div className="absolute top-3 right-3 z-30">
            {activeTool === "place-hero" && selectedHeroToPlace && (
              <div className="bg-amber-500 text-black px-3 py-1 rounded-xl font-mono text-2xs font-bold shadow-lg animate-bounce flex items-center space-x-1.5">
                <span>🎯 Click any grid square to deploy {selectedHeroToPlace.name}</span>
                <button
                  onClick={() => {
                    setSelectedHeroToPlace(null);
                    setActiveTool("select");
                  }}
                  className="ml-2 text-black hover:text-red-950"
                >
                  ✕
                </button>
              </div>
            )}

            {selectedTokenId && (
              <div className="bg-[#141622]/95 border border-amber-500/40 text-amber-300 px-3 py-1 rounded-xl font-mono text-2xs shadow-lg flex items-center space-x-2">
                <span>Token Selected: <strong className="text-white">{selectedToken?.name}</strong></span>
                <span className="text-slate-400 text-3xs">• Click another cell to move</span>
                <button
                  onClick={() => setSelectedTokenId(null)}
                  className="text-slate-400 hover:text-white ml-1 text-xs"
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          {/* SCROLLABLE MAP & TACTICAL GRID AREA */}
          <div className="flex-1 overflow-auto p-4 flex items-center justify-center custom-scrollbar">
            <div
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: "center center",
                transition: "transform 0.15s ease-out"
              }}
              className="relative shadow-2xl rounded-xl overflow-hidden border border-white/20 shrink-0"
            >
              {/* Battle Map Background Image */}
              <div
                style={{
                  backgroundImage: `url(${activeMap.imageUrl})`,
                  backgroundSize: battleMapFitMode === "contain" ? "contain" : "cover",
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "center",
                  backgroundColor: "#07080c",
                  width: `${activeMap.gridCols * 56}px`,
                  height: `${activeMap.gridRows * 56}px`
                }}
                className="relative"
              >
                {/* Vignette / ambient battle lighting */}
                <div className="absolute inset-0 bg-black/25 pointer-events-none" />

                {/* Tactical Grid Overlay Cells */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${activeMap.gridCols}, 56px)`,
                    gridTemplateRows: `repeat(${activeMap.gridRows}, 56px)`
                  }}
                  className="absolute inset-0 z-10"
                >
                  {Array.from({ length: activeMap.gridRows }).map((_, rIdx) =>
                    Array.from({ length: activeMap.gridCols }).map((_, cIdx) => {
                      const tokenHere = activeMap.tokens.find(t => t.x === cIdx && t.y === rIdx);
                      const isSelectedCell = selectedToken && selectedToken.x === cIdx && selectedToken.y === rIdx;
                      const isRulerPoint = (rulerStart?.x === cIdx && rulerStart?.y === rIdx) || (rulerEnd?.x === cIdx && rulerEnd?.y === rIdx);

                      return (
                        <div
                          key={`cell-${cIdx}-${rIdx}`}
                          onClick={() => handleCellClick(cIdx, rIdx)}
                          style={{
                            borderColor: activeMap.showGrid ? (activeMap.gridColor || "rgba(255, 255, 255, 0.18)") : "transparent"
                          }}
                          className={`relative border flex items-center justify-center transition-colors cursor-pointer ${
                            isSelectedCell
                              ? "bg-amber-500/25 ring-2 ring-amber-400 ring-inset"
                              : isRulerPoint
                              ? "bg-cyan-500/30 ring-2 ring-cyan-400 ring-inset"
                              : "hover:bg-amber-500/15"
                          }`}
                          title={`Square (${cIdx + 1}, ${rIdx + 1})`}
                        >
                          {/* Token in this grid cell */}
                          {tokenHere && (
                            <div className="relative group/token z-20 flex flex-col items-center">
                              {/* Avatar circle */}
                              <div
                                className={`w-10 h-10 rounded-full border-2 overflow-hidden flex items-center justify-center font-bold text-xs shadow-xl transition-transform ${
                                  tokenHere.type === "player"
                                    ? "border-amber-400 bg-amber-950 text-amber-200 ring-2 ring-amber-500/40"
                                    : "border-red-400 bg-red-950 text-red-200 ring-2 ring-red-500/40"
                                } ${selectedTokenId === tokenHere.id ? "scale-115 ring-4 ring-amber-300 animate-pulse" : "hover:scale-105"}`}
                              >
                                {tokenHere.avatarUrl ? (
                                  <img src={tokenHere.avatarUrl} alt={tokenHere.name} className="w-full h-full object-cover" />
                                ) : (
                                  tokenHere.name[0]
                                )}
                              </div>

                              {/* Tiny HP indicator bar */}
                              {tokenHere.hp && (
                                <div className="w-8 h-1 bg-black/60 rounded-full overflow-hidden mt-0.5 border border-white/20">
                                  <div
                                    style={{ width: `${Math.min(100, Math.floor((tokenHere.hp.current / tokenHere.hp.max) * 100))}%` }}
                                    className={`h-full ${
                                      tokenHere.hp.current / tokenHere.hp.max > 0.5
                                        ? "bg-emerald-400"
                                        : tokenHere.hp.current / tokenHere.hp.max > 0.2
                                        ? "bg-amber-400"
                                        : "bg-red-500"
                                    }`}
                                  />
                                </div>
                              )}

                              {/* Name label tag */}
                              <span className="text-[8px] font-mono font-bold px-1 rounded bg-black/80 text-slate-100 whitespace-nowrap mt-0.5 max-w-[50px] truncate shadow">
                                {tokenHere.name.split(" ")[0]}
                              </span>
                            </div>
                          )}

                          {/* Coordinates watermark */}
                          <span className="absolute bottom-0.5 right-0.5 text-[6px] font-mono text-white/10 pointer-events-none select-none">
                            {cIdx},{rIdx}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Ruler SVG vector line if measurement is active */}
                {rulerStart && rulerEnd && (
                  <svg className="absolute inset-0 w-full h-full pointer-events-none z-20">
                    <line
                      x1={rulerStart.x * 56 + 28}
                      y1={rulerStart.y * 56 + 28}
                      x2={rulerEnd.x * 56 + 28}
                      y2={rulerEnd.y * 56 + 28}
                      stroke="#06b6d4"
                      strokeWidth="3.5"
                      strokeDasharray="6,4"
                    />
                  </svg>
                )}

              </div>
            </div>
          </div>

          {/* BOTTOM TRAY: PARTY CHARACTERS & COMBAT SPAWN DECK */}
          <div className="p-3 bg-[#0d0f15] border-t border-white/10 flex flex-wrap items-center justify-between gap-3 shrink-0">
            
            {/* Party heroes for placement */}
            <div className="flex items-center space-x-2 overflow-x-auto max-w-full py-0.5">
              <span className="text-3xs font-mono uppercase text-slate-500 font-bold shrink-0">
                Deploy Hero:
              </span>

              {characters.map(char => {
                if (char.id === "dm" && characters.length > 1) return null;
                const isAlreadyOnMap = activeMap.tokens.some(t => t.characterId === char.id);
                const isSelectedForPlacement = selectedHeroToPlace?.id === char.id;

                return (
                  <button
                    key={char.id}
                    onClick={() => {
                      setSelectedHeroToPlace(char);
                      setActiveTool("place-hero");
                      setSelectedTokenId(null);
                    }}
                    className={`px-2 py-1 rounded-lg border text-2xs font-mono flex items-center space-x-1.5 transition-all cursor-pointer whitespace-nowrap ${
                      isSelectedForPlacement
                        ? "bg-amber-500 text-black border-amber-300 font-bold scale-105"
                        : isAlreadyOnMap
                        ? "bg-[#181a24] text-slate-300 border-amber-500/30 hover:border-amber-500"
                        : "bg-[#13151f] text-slate-400 border-white/10 hover:text-white hover:border-white/20"
                    }`}
                  >
                    <div className="w-4 h-4 rounded-full overflow-hidden bg-slate-800 shrink-0">
                      {char.avatarUrl ? (
                        <img src={char.avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        char.name[0]
                      )}
                    </div>
                    <span>{char.name.split(" ")[0]}</span>
                    {isAlreadyOnMap && <span className="text-[8px] text-amber-400">●</span>}
                  </button>
                );
              })}

              {/* 1-Click Deploy All Party */}
              <button
                onClick={handleDeployAllParty}
                className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-3xs uppercase font-mono font-bold transition-all flex items-center space-x-1 cursor-pointer shrink-0"
                title="Deploy all adventurers to entrance area"
              >
                <Users className="w-3 h-3 text-amber-500" />
                <span>Deploy All Party</span>
              </button>
            </div>

            {/* Custom Monster Spawner button */}
            <button
              onClick={() => setIsCustomMonsterModalOpen(true)}
              className="px-2.5 py-1 bg-red-600/30 hover:bg-red-600/50 text-red-200 border border-red-500/50 rounded-lg text-2xs font-mono font-bold transition-all cursor-pointer flex items-center space-x-1.5 shadow-sm"
              title="Spawn monster with custom uploaded photo/token, HP, and stats"
            >
              <Skull className="w-3.5 h-3.5 text-red-400" />
              <span>+ Custom Monster (Photo Token)</span>
            </button>

            {/* Quick Adversary / Monster spawners */}
            <div className="flex items-center space-x-1.5 shrink-0">
              <span className="text-3xs font-mono uppercase text-red-400 font-bold">
                Quick:
              </span>
              {[
                { name: "Goblin", hp: 10, color: "#ef4444" },
                { name: "Orc", hp: 18, color: "#dc2626" },
                { name: "Bandit", hp: 14, color: "#b91c1c" },
                { name: "Skeleton", hp: 12, color: "#991b1b" },
                { name: "Boss Lair", hp: 45, color: "#7f1d1d" }
              ].map(foe => (
                <button
                  key={foe.name}
                  onClick={() => handleSpawnEnemy(foe.name, foe.hp, foe.color)}
                  className="px-2 py-0.5 bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-500/30 rounded text-3xs font-mono transition-all cursor-pointer"
                >
                  +{foe.name}
                </button>
              ))}
            </div>

          </div>

        </div>

        {/* RIGHT / SIDE PANEL: TACTICAL TOKEN INSPECTOR & CHAMBER REPORT */}
        <div className="w-full lg:w-80 bg-[#0f1117] border border-white/10 rounded-2xl p-4 flex flex-col justify-between shrink-0 space-y-4 shadow-xl overflow-y-auto">
          
          <div className="space-y-4">
            
            {/* Header / Active Map details */}
            <div className="border-b border-white/10 pb-3">
              <div className="flex items-center justify-between">
                <span className="text-3xs uppercase font-mono text-amber-500 font-bold">
                  Tactical Chamber HUD
                </span>
                <span className="text-3xs font-mono text-slate-400">
                  {activeMap.tokens.length} Token{activeMap.tokens.length === 1 ? "" : "s"}
                </span>
              </div>
              <h3 className="text-base font-bold text-white font-serif italic mt-1">
                {activeMap.name}
              </h3>
              <p className="text-2xs text-slate-400 font-editorial mt-1 leading-relaxed">
                "{activeMap.description || `Tactical layout of ${location.name}.`}"
              </p>
            </div>

            {/* Token Inspector (when a token is selected) */}
            {selectedToken ? (
              <div className="p-3 bg-[#141622] border border-amber-500/40 rounded-xl space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-800 border border-amber-400 flex items-center justify-center font-bold text-amber-400 text-xs">
                      {selectedToken.avatarUrl ? (
                        <img src={selectedToken.avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        selectedToken.name[0]
                      )}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white font-serif">{selectedToken.name}</h4>
                      <span className="text-3xs font-mono text-amber-400 uppercase">
                        {selectedToken.type === "player" ? "Heroic Adventurer" : "Adversary"} • Pos ({selectedToken.x + 1}, {selectedToken.y + 1})
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeleteToken(selectedToken.id)}
                    className="p-1 text-slate-500 hover:text-red-400 rounded transition-colors"
                    title="Remove token from grid"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* HP adjustments */}
                {selectedToken.hp && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-2xs font-mono text-slate-300">
                      <span>Vitality Pool</span>
                      <span className="text-amber-400 font-bold">{selectedToken.hp.current} / {selectedToken.hp.max} HP</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <button
                        onClick={() => handleTokenHpDelta(selectedToken.id, -5)}
                        className="px-2 py-0.5 bg-red-950/60 hover:bg-red-900 text-red-300 rounded font-mono text-3xs border border-red-500/30"
                      >
                        -5
                      </button>
                      <button
                        onClick={() => handleTokenHpDelta(selectedToken.id, -1)}
                        className="px-2 py-0.5 bg-red-950/60 hover:bg-red-900 text-red-300 rounded font-mono text-3xs border border-red-500/30"
                      >
                        -1
                      </button>
                      <div className="flex-1 h-2 bg-black/60 rounded-full overflow-hidden border border-white/10">
                        <div
                          style={{ width: `${Math.min(100, Math.floor((selectedToken.hp.current / selectedToken.hp.max) * 100))}%` }}
                          className="h-full bg-amber-500 transition-all"
                        />
                      </div>
                      <button
                        onClick={() => handleTokenHpDelta(selectedToken.id, 1)}
                        className="px-2 py-0.5 bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300 rounded font-mono text-3xs border border-emerald-500/30"
                      >
                        +1
                      </button>
                      <button
                        onClick={() => handleTokenHpDelta(selectedToken.id, 5)}
                        className="px-2 py-0.5 bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300 rounded font-mono text-3xs border border-emerald-500/30"
                      >
                        +5
                      </button>
                    </div>
                  </div>
                )}

                <p className="text-3xs font-mono text-slate-400 italic">
                  💡 Tap any empty square on the battle grid to move this token instantly.
                </p>
              </div>
            ) : (
              <div className="p-4 bg-white/2 border border-white/5 rounded-xl text-center space-y-1.5">
                <Shield className="w-6 h-6 text-slate-600 mx-auto" />
                <span className="text-2xs font-mono text-slate-400 block font-bold">
                  No Token Selected
                </span>
                <p className="text-3xs font-mono text-slate-500">
                  Click a token on the grid to inspect vitality or move them across squares.
                </p>
              </div>
            )}

            {/* Tokens Roster Summary List */}
            <div className="space-y-1.5">
              <span className="text-3xs font-mono uppercase text-slate-500 font-bold block">
                Deployed Combatants ({activeMap.tokens.length}):
              </span>
              <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                {activeMap.tokens.length === 0 ? (
                  <p className="text-3xs text-slate-600 font-mono italic">
                    Grid clear. Deploy characters or spawn adversaries below.
                  </p>
                ) : (
                  activeMap.tokens.map(token => (
                    <div
                      key={token.id}
                      onClick={() => setSelectedTokenId(token.id)}
                      className={`p-2 rounded-lg border text-2xs font-mono flex items-center justify-between cursor-pointer transition-all ${
                        selectedTokenId === token.id
                          ? "bg-amber-500/15 border-amber-500 text-amber-300 font-bold"
                          : "bg-[#13151f] border-white/5 text-slate-300 hover:border-white/20"
                      }`}
                    >
                      <div className="flex items-center space-x-2 min-w-0">
                        <span className={`w-2 h-2 rounded-full ${token.type === "player" ? "bg-amber-400" : "bg-red-400"}`} />
                        <span className="truncate">{token.name}</span>
                      </div>
                      <span className="text-3xs text-slate-500 font-mono">
                        ({token.x + 1},{token.y + 1})
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

          {/* Quick Footer Summary */}
          <div className="pt-3 border-t border-white/10 text-3xs font-mono text-slate-500 space-y-1">
            <div className="flex justify-between">
              <span>Grid Scale:</span>
              <span className="text-slate-300">1 cell = 5 ft</span>
            </div>
            <div className="flex justify-between">
              <span>Map Dimensions:</span>
              <span className="text-slate-300">{activeMap.gridCols * 5} ft × {activeMap.gridRows * 5} ft</span>
            </div>
          </div>

        </div>

      </div>

      {/* MODAL 1: IMPORT PICTURE / IMAGE DIALOG */}
      <AnimatePresence>
        {isImageImporterOpen && (
          <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-xl bg-[#0f1117] border border-amber-500/40 rounded-2xl p-5 shadow-2xl space-y-4 font-sans text-slate-200"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center space-x-2">
                  <Upload className="w-5 h-5 text-amber-500" />
                  <h3 className="text-base font-serif italic text-white font-bold">
                    Import Site Battle Map Image
                  </h3>
                </div>
                <button
                  onClick={() => setIsImageImporterOpen(false)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              {/* Option A: Upload local image file */}
              <div className="space-y-2">
                <label className="block text-2xs uppercase font-mono text-amber-400 font-bold">
                  Option 1: Upload Image File (PNG, JPG, WEBP)
                </label>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-4 border-2 border-dashed border-white/20 hover:border-amber-500 rounded-xl bg-white/2 hover:bg-amber-500/5 transition-all flex flex-col items-center justify-center space-y-1.5 cursor-pointer text-slate-300 hover:text-amber-400"
                >
                  <Upload className="w-6 h-6 text-amber-500" />
                  <span className="text-xs font-mono font-bold uppercase">Click to Select Map File</span>
                  <span className="text-3xs text-slate-500 font-mono">Uploads instantly from your computer into this location map</span>
                </button>
              </div>

              {/* Option B: Direct Image URL */}
              <div className="space-y-2">
                <label className="block text-2xs uppercase font-mono text-amber-400 font-bold">
                  Option 2: Web Image URL
                </label>
                <div className="flex space-x-2">
                  <input
                    type="url"
                    placeholder="https://... (e.g. from Reddit battlemaps, Imgur, DnD image)"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    className="flex-1 bg-[#161822] border border-white/10 text-slate-200 px-3 py-2 rounded-lg text-xs font-mono focus:outline-none focus:border-amber-500"
                  />
                  <button
                    onClick={() => handleApplyImage(urlInput)}
                    disabled={!urlInput.trim()}
                    className="px-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-mono font-bold text-xs uppercase rounded-lg transition-colors cursor-pointer"
                  >
                    Apply URL
                  </button>
                </div>
              </div>

              {/* Option C: Preset Fantasy Battle Maps Gallery */}
              <div className="space-y-2 pt-2 border-t border-white/10">
                <label className="block text-2xs uppercase font-mono text-slate-400 font-bold">
                  Option 3: Curated Fantasy Preset Textures
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                  {BATTLEMAP_PRESETS.map(preset => (
                    <div
                      key={preset.id}
                      onClick={() => handleApplyImage(preset.url)}
                      className="group/p relative rounded-lg overflow-hidden border border-white/10 hover:border-amber-500 cursor-pointer h-20 transition-all shadow"
                    >
                      <img src={preset.url} alt={preset.name} className="w-full h-full object-cover group-hover/p:scale-105 transition-transform" />
                      <div className="absolute inset-0 bg-black/50 group-hover/p:bg-black/30 transition-colors flex items-end p-1.5">
                        <span className="text-[9px] font-mono font-bold text-white leading-tight truncate">
                          {preset.name}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: MAP SETTINGS & GRID DIMENSIONS */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-[#0f1117] border border-amber-500/40 rounded-2xl p-5 shadow-2xl space-y-4 font-sans text-slate-200"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center space-x-2">
                  <Edit3 className="w-5 h-5 text-amber-500" />
                  <h3 className="text-base font-serif italic text-white font-bold">
                    Modify Map & Grid Settings
                  </h3>
                </div>
                <button onClick={() => setIsSettingsOpen(false)} className="text-slate-400 hover:text-white">
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveSettings} className="space-y-3 font-mono text-xs">
                <div>
                  <label className="block text-3xs uppercase text-slate-400 mb-1">Chamber / Level Title</label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-[#161822] border border-white/10 text-white px-3 py-1.5 rounded-lg text-xs font-sans focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-3xs uppercase text-slate-400 mb-1">Grid Columns (Width)</label>
                    <input
                      type="number"
                      min={6}
                      max={30}
                      value={editCols}
                      onChange={(e) => setEditCols(parseInt(e.target.value) || 12)}
                      className="w-full bg-[#161822] border border-white/10 text-amber-400 font-bold px-3 py-1.5 rounded-lg text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-3xs uppercase text-slate-400 mb-1">Grid Rows (Height)</label>
                    <input
                      type="number"
                      min={6}
                      max={30}
                      value={editRows}
                      onChange={(e) => setEditRows(parseInt(e.target.value) || 10)}
                      className="w-full bg-[#161822] border border-white/10 text-amber-400 font-bold px-3 py-1.5 rounded-lg text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2 pt-1">
                  <input
                    type="checkbox"
                    id="showGridCheckbox"
                    checked={editShowGrid}
                    onChange={(e) => setEditShowGrid(e.target.checked)}
                    className="rounded bg-[#161822] border-white/20 text-amber-500 focus:ring-0"
                  />
                  <label htmlFor="showGridCheckbox" className="text-2xs text-slate-300 cursor-pointer">
                    Display 5ft Tactical Grid Lines
                  </label>
                </div>

                <div className="flex space-x-2 pt-2">
                  <button
                    type="submit"
                    className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold uppercase rounded-lg transition-colors cursor-pointer"
                  >
                    Save Changes
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsSettingsOpen(false)}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-400 rounded-lg transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 3: ADD NEW INTERIOR MAP FLOOR */}
      <AnimatePresence>
        {isAddMapOpen && (
          <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-[#0f1117] border border-amber-500/40 rounded-2xl p-5 shadow-2xl space-y-4 font-sans text-slate-200"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center space-x-2">
                  <FolderPlus className="w-5 h-5 text-amber-500" />
                  <h3 className="text-base font-serif italic text-white font-bold">
                    Create New Interior Site Chamber
                  </h3>
                </div>
                <button onClick={() => setIsAddMapOpen(false)} className="text-slate-400 hover:text-white">
                  ✕
                </button>
              </div>

              <form onSubmit={handleAddNewMap} className="space-y-3 font-mono text-xs">
                <div>
                  <label className="block text-3xs uppercase text-slate-400 mb-1">Chamber / Level Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Upper Ramparts, Lower Crypt, Boss Lair"
                    value={newMapName}
                    onChange={(e) => setNewMapName(e.target.value)}
                    className="w-full bg-[#161822] border border-white/10 text-white px-3 py-1.5 rounded-lg text-xs font-sans focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-3xs uppercase text-slate-400 mb-1">Preset Environment</label>
                  <select
                    value={newMapPresetId}
                    onChange={(e) => setNewMapPresetId(e.target.value)}
                    className="w-full bg-[#161822] border border-white/10 text-slate-200 px-3 py-1.5 rounded-lg text-xs focus:outline-none focus:border-amber-500 uppercase"
                  >
                    <option value="cavern">Underground Cavern 🕳️</option>
                    <option value="dungeon">Dungeon Vault 💀</option>
                    <option value="tavern">Tavern Common Room 🍺</option>
                    <option value="forest">Forest Glade 🌲</option>
                    <option value="ruins">Ancient Ruined Sanctuary 🏚️</option>
                    <option value="castle">Stone Stronghold 🛡️</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-3xs uppercase text-slate-400 mb-1">Grid Columns</label>
                    <input
                      type="number"
                      min={6}
                      max={30}
                      value={newMapCols}
                      onChange={(e) => setNewMapCols(parseInt(e.target.value) || 14)}
                      className="w-full bg-[#161822] border border-white/10 text-amber-400 font-bold px-3 py-1.5 rounded-lg text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-3xs uppercase text-slate-400 mb-1">Grid Rows</label>
                    <input
                      type="number"
                      min={6}
                      max={30}
                      value={newMapRows}
                      onChange={(e) => setNewMapRows(parseInt(e.target.value) || 10)}
                      className="w-full bg-[#161822] border border-white/10 text-amber-400 font-bold px-3 py-1.5 rounded-lg text-xs focus:outline-none"
                    />
                  </div>
                </div>

                <p className="text-3xs text-slate-500 italic">
                  Note: You can import your own picture/image for this room at any time using the Import tool.
                </p>

                <div className="flex space-x-2 pt-2">
                  <button
                    type="submit"
                    className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold uppercase rounded-lg transition-colors cursor-pointer"
                  >
                    Create Inside Map
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddMapOpen(false)}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-400 rounded-lg transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 4: CUSTOM MONSTER SPAWNER WITH PICTURE UPLOAD */}
      <AnimatePresence>
        {isCustomMonsterModalOpen && (
          <div className="fixed inset-0 z-60 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-[#0f1117] border border-red-500/40 rounded-2xl p-6 shadow-2xl space-y-5 font-sans text-slate-200"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center space-x-2">
                  <Skull className="w-5 h-5 text-red-500" />
                  <h3 className="text-base font-serif italic text-white font-bold">
                    Spawn Custom Monster / Token
                  </h3>
                </div>
                <button 
                  onClick={() => setIsCustomMonsterModalOpen(false)} 
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSpawnCustomMonster} className="space-y-4 font-mono text-xs">
                
                {/* Live Token Preview + Picture Upload */}
                <div className="bg-[#141622] border border-white/10 rounded-xl p-4 flex items-center space-x-4">
                  {/* Circular preview token */}
                  <div className="flex flex-col items-center shrink-0">
                    <div 
                      className="w-16 h-16 rounded-full border-2 overflow-hidden flex items-center justify-center font-bold text-sm shadow-xl ring-4"
                      style={{ 
                        borderColor: customMonsterColor, 
                        boxShadow: `0 0 15px ${customMonsterColor}55`,
                        backgroundColor: "#1f1315" 
                      }}
                    >
                      {customMonsterImageUrl ? (
                        <img src={customMonsterImageUrl} alt="Token Preview" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-2xl font-serif text-white">{customMonsterName ? customMonsterName[0].toUpperCase() : "M"}</span>
                      )}
                    </div>
                    <span className="text-3xs font-mono font-bold px-1.5 py-0.5 rounded bg-black/80 text-red-300 mt-1 max-w-[70px] truncate">
                      {customMonsterName || "Monster"}
                    </span>
                    <span className="text-3xs text-emerald-400 font-bold">{customMonsterHp} HP</span>
                  </div>

                  {/* Picture controls */}
                  <div className="flex-1 space-y-2">
                    <label className="block text-3xs uppercase text-amber-400 font-bold">Token Picture / Portrait</label>
                    
                    <div className="flex items-center space-x-2">
                      <input
                        type="file"
                        ref={monsterFileInputRef}
                        accept="image/*"
                        onChange={handleMonsterFileUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => monsterFileInputRef.current?.click()}
                        className="px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-2xs uppercase font-mono font-bold transition-all cursor-pointer flex items-center space-x-1.5 shadow-sm"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload Picture File</span>
                      </button>
                      {customMonsterImageUrl && (
                        <button
                          type="button"
                          onClick={() => setCustomMonsterImageUrl("")}
                          className="px-2 py-1.5 bg-white/5 hover:bg-red-950 text-slate-400 hover:text-red-400 rounded-lg text-2xs transition-all"
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    <div>
                      <input
                        type="url"
                        placeholder="Or paste an image web URL..."
                        value={customMonsterImageUrl}
                        onChange={(e) => setCustomMonsterImageUrl(e.target.value)}
                        className="w-full bg-[#1a1c28] border border-white/10 text-white px-2.5 py-1 rounded text-2xs font-mono focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Monster Name and Category */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-3xs uppercase text-slate-400 mb-1">Monster / NPC Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Young Red Dragon, Owlbear, Orc Shaman"
                      value={customMonsterName}
                      onChange={(e) => setCustomMonsterName(e.target.value)}
                      className="w-full bg-[#161822] border border-white/10 text-white px-3 py-1.5 rounded-lg text-xs font-sans focus:outline-none focus:border-red-500"
                    />
                  </div>
                  <div>
                    <label className="block text-3xs uppercase text-slate-400 mb-1">Category & Allegiance</label>
                    <select
                      value={customMonsterType}
                      onChange={(e) => setCustomMonsterType(e.target.value as "enemy" | "npc")}
                      className="w-full bg-[#161822] border border-white/10 text-slate-200 px-3 py-1.5 rounded-lg text-xs focus:outline-none focus:border-red-500"
                    >
                      <option value="enemy">Hostile Foe / Monster 👹</option>
                      <option value="npc">Neutral NPC / Ally 🛡️</option>
                    </select>
                  </div>
                </div>

                {/* HP and Color */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-3xs uppercase text-slate-400 mb-1">Hit Points (HP)</label>
                    <input
                      type="number"
                      min={1}
                      max={999}
                      value={customMonsterHp}
                      onChange={(e) => setCustomMonsterHp(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full bg-[#161822] border border-white/10 text-amber-400 font-bold px-3 py-1.5 rounded-lg text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-3xs uppercase text-slate-400 mb-1">Border Accent Tint</label>
                    <div className="flex items-center space-x-2 mt-1">
                      {[
                        { color: "#ef4444", label: "Red" },
                        { color: "#dc2626", label: "Crimson" },
                        { color: "#9333ea", label: "Purple" },
                        { color: "#d97706", label: "Amber" },
                        { color: "#059669", label: "Emerald" },
                        { color: "#2563eb", label: "Blue" }
                      ].map(tint => (
                        <button
                          key={tint.color}
                          type="button"
                          onClick={() => setCustomMonsterColor(tint.color)}
                          style={{ backgroundColor: tint.color }}
                          className={`w-6 h-6 rounded-full cursor-pointer transition-transform ${
                            customMonsterColor === tint.color ? "ring-2 ring-white scale-110" : "opacity-80 hover:opacity-100"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Quick Presets */}
                <div>
                  <label className="block text-3xs uppercase text-slate-400 mb-1.5">Or Choose an Iconic Preset with Portrait:</label>
                  <div className="grid grid-cols-3 gap-2">
                    {MONSTER_PRESETS.map((preset) => (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => {
                          setCustomMonsterName(preset.name);
                          setCustomMonsterHp(preset.hp);
                          setCustomMonsterColor(preset.color);
                          setCustomMonsterImageUrl(preset.avatarUrl);
                        }}
                        className="p-1.5 bg-[#141622] hover:bg-white/5 border border-white/5 hover:border-red-500/40 rounded-lg flex items-center space-x-2 text-left transition-all cursor-pointer group"
                      >
                        <img src={preset.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover shrink-0 border border-white/20" />
                        <div className="min-w-0">
                          <p className="text-3xs font-bold text-slate-200 truncate group-hover:text-red-300">{preset.name}</p>
                          <p className="text-3xs text-slate-500">{preset.hp} HP</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex space-x-2 pt-2 border-t border-white/10">
                  <button
                    type="submit"
                    className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white font-bold uppercase rounded-lg transition-colors cursor-pointer flex items-center justify-center space-x-2 shadow-lg shadow-red-950"
                  >
                    <Skull className="w-4 h-4" />
                    <span>Spawn onto Battle Grid</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCustomMonsterModalOpen(false)}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-400 rounded-lg transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
