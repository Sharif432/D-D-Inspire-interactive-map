import React, { useState, useRef, useEffect } from "react";
import { CampaignLocation, SiteBattleMap, MapToken, Character, LocationType, FogOfWarState, CombatHpLogEntry } from "../types";
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
  Maximize2,
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
  Skull,
  Cloud,
  CloudOff,
  Eraser,
  Undo2,
  PanelRightClose,
  PanelRightOpen,
  PanelTopClose,
  PanelTopOpen,
  Flame,
  Hourglass
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import FogOfWarOverlay from "./FogOfWarOverlay";
import { isPointVisibleToPlayers } from "../utils/fogOfWar";
import { ExtractedCampaignImage, processUploadedImage } from "../utils/imageUtils";

interface SiteBattleMapModalProps {
  location: CampaignLocation;
  buildingId?: string;
  characters: Character[];
  partyLocationId: string;
  isDmMode?: boolean;
  onToggleDmMode?: () => void;
  followDm?: boolean;
  onToggleFollowDm?: () => void;
  savedImages?: ExtractedCampaignImage[];
  onClose: () => void;
  onSaveBattleMaps: (locationId: string, interiorMaps: SiteBattleMap[], activeInteriorMapId: string, buildingId?: string) => Promise<void>;
  onAdjustTokenHp?: (payload: {
    locationId: string;
    buildingId?: string;
    mapId: string;
    tokenId: string;
    delta?: number;
    setHp?: number;
    isHpHidden?: boolean;
  }) => Promise<boolean>;
  hpLogs?: CombatHpLogEntry[];
  onClearHpLogs?: () => Promise<void>;
  onUpdateFog?: (payload: {
    targetType: "region" | "city" | "building" | "battlemap";
    regionId?: string;
    locationId?: string;
    buildingId?: string;
    mapId?: string;
    fogOfWar: FogOfWarState;
  }) => Promise<void>;
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

interface EnvironmentEffectDraft {
  name: string;
  effectType: string;
  effectIcon: string;
  color: string;
  areaRadius: number;
  effectDuration?: number;
  notes?: string;
  isEffectHidden?: boolean;
}

const ENVIRONMENT_EFFECT_PRESETS: EnvironmentEffectDraft[] = [
  {
    name: "Poison Cloud",
    effectType: "poison",
    effectIcon: "☠️",
    color: "#22c55e",
    areaRadius: 1,
    effectDuration: 10,
    notes: "Heavily obscured. CON save vs poison damage when entering or starting turn inside."
  },
  {
    name: "Burning Ground",
    effectType: "fire",
    effectIcon: "🔥",
    color: "#f97316",
    areaRadius: 1,
    effectDuration: 10,
    notes: "Wall / Area of Fire. DEX save or take fire damage upon entry or ending turn inside."
  },
  {
    name: "Sleep Mist",
    effectType: "sleep",
    effectIcon: "💤",
    color: "#a855f7",
    areaRadius: 1,
    effectDuration: 10,
    notes: "Hypnotic / Sleep zone. Creatures in area roll HP threshold or WIS save vs unconscious/charmed."
  },
  {
    name: "Entangling Web",
    effectType: "web",
    effectIcon: "🕸️",
    color: "#cbd5e1",
    areaRadius: 1,
    effectDuration: 10,
    notes: "Difficult terrain. DEX save on entry/turn start or become Restrained. Flammable."
  },
  {
    name: "Darkness",
    effectType: "darkness",
    effectIcon: "🌑",
    color: "#6366f1",
    areaRadius: 1,
    effectDuration: 10,
    notes: "Magical Darkness. Heavily obscured; non-magical light & darkvision cannot pierce."
  },
  {
    name: "Fog Cloud",
    effectType: "fog",
    effectIcon: "🌫️",
    color: "#94a3b8",
    areaRadius: 2,
    effectDuration: 10,
    notes: "Heavy obscurement. Creatures inside effectively suffer the Blinded condition."
  },
  {
    name: "Ice Slick",
    effectType: "ice",
    effectIcon: "❄️",
    color: "#38bdf8",
    areaRadius: 1,
    effectDuration: 10,
    notes: "Grease / Sleet zone. Difficult terrain; DEX save on entry or fall Prone."
  },
  {
    name: "Acid Pool",
    effectType: "acid",
    effectIcon: "🧪",
    color: "#84cc16",
    areaRadius: 0,
    notes: "Corrosive hazard. Takes acid damage on contact or when starting turn in the tile."
  },
  {
    name: "Storm Arc",
    effectType: "lightning",
    effectIcon: "⚡",
    color: "#eab308",
    areaRadius: 0,
    effectDuration: 3,
    notes: "Crackling storm aura. DEX save vs lightning damage when ending turn nearby."
  },
  {
    name: "Healing Aura",
    effectType: "healing",
    effectIcon: "✨",
    color: "#10b981",
    areaRadius: 1,
    effectDuration: 10,
    notes: "Sanctuary / Aura of Vitality. Allies restore HP at start or end of turn."
  },
  {
    name: "Silence Zone",
    effectType: "silence",
    effectIcon: "🔇",
    color: "#ec4899",
    areaRadius: 2,
    effectDuration: 10,
    notes: "No sound passes. Creatures inside are Deafened, immune to thunder, and cannot cast verbal spells."
  }
];

export default function SiteBattleMapModal({
  location,
  buildingId,
  characters,
  partyLocationId,
  isDmMode: externalDmMode,
  onToggleDmMode,
  followDm = true,
  onToggleFollowDm,
  savedImages = [],
  onClose,
  onSaveBattleMaps,
  onAdjustTokenHp,
  hpLogs = [],
  onClearHpLogs,
  onUpdateFog
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

  // Authoritative live refs + serialized save queue so rapid HP edits and token moves NEVER race or overwrite each other
  const interiorMapsRef = useRef<SiteBattleMap[]>(interiorMaps);
  interiorMapsRef.current = interiorMaps;
  const activeMapIdRef = useRef<string>(activeMapId);
  activeMapIdRef.current = activeMapId;
  const pendingSavesRef = useRef<number>(0);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  // Current active map
  const activeMap = interiorMaps.find(m => m.id === activeMapId) || interiorMaps[0];

  // Tool selection: 'select' | 'place-hero' | 'spawn-enemy' | 'place-effect' | 'ruler'
  const [activeTool, setActiveTool] = useState<"select" | "place-hero" | "spawn-enemy" | "place-effect" | "ruler">("select");
  const [selectedHeroToPlace, setSelectedHeroToPlace] = useState<Character | null>(null);
  const [selectedEffectToPlace, setSelectedEffectToPlace] = useState<EnvironmentEffectDraft | null>(null);
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);

  // Ruler state
  const [rulerStart, setRulerStart] = useState<{ x: number; y: number } | null>(null);
  const [rulerEnd, setRulerEnd] = useState<{ x: number; y: number } | null>(null);

  // Modals & Panels inside the viewer
  const [isImageImporterOpen, setIsImageImporterOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAddMapOpen, setIsAddMapOpen] = useState(false);
  const [isHudOpen, setIsHudOpen] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem("dnd_battle_hud") !== "false";
    } catch {
      return true;
    }
  });
  const [isTopBarOpen, setIsTopBarOpen] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem("dnd_battle_top_bar") !== "false";
    } catch {
      return true;
    }
  });

  const handleToggleHud = () => {
    setIsHudOpen((prev) => {
      const next = !prev;
      try {
        sessionStorage.setItem("dnd_battle_hud", next ? "true" : "false");
      } catch {
        // Ignore
      }
      return next;
    });
  };

  const handleToggleTopBar = () => {
    setIsTopBarOpen((prev) => {
      const next = !prev;
      try {
        sessionStorage.setItem("dnd_battle_top_bar", next ? "true" : "false");
      } catch {
        // Ignore
      }
      return next;
    });
  };

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

  // Zoom & Pan states (supports 25% up to 400% + smooth drag, wheel & pinch)
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDraggingMap, setIsDraggingMap] = useState(false);
  const [viewportSize, setViewportSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [hoverCell, setHoverCell] = useState<{ x: number; y: number } | null>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const battleViewportRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const pointerDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const didDragMapRef = useRef<boolean>(false);
  const touchDistanceRef = useRef<number | null>(null);
  const lastAutoFittedKeyRef = useRef<string>("");

  // Battle Map Fit Mode (Contain vs Cover)
  const [battleMapFitMode, setBattleMapFitMode] = useState<"contain" | "cover">("contain");

  // DM Mode vs Player View + Fog of War Controls
  const [localDmMode, setLocalDmMode] = useState<boolean>(externalDmMode ?? true);
  useEffect(() => {
    if (externalDmMode !== undefined) {
      setLocalDmMode(externalDmMode);
    }
  }, [externalDmMode]);
  const effectiveDmMode = externalDmMode !== undefined ? externalDmMode : localDmMode;
  const handleSwitchDmMode = () => {
    if (onToggleDmMode) {
      onToggleDmMode();
    } else {
      setLocalDmMode((p) => !p);
    }
  };

  // Sync rooms, tokens, grid dimensions, and battle fog from real-time server updates
  // Guarded by pendingSavesRef so in-flight serialized saves are never clobbered by intermediate responses
  useEffect(() => {
    if (pendingSavesRef.current > 0) return;
    if (location.interiorMaps && location.interiorMaps.length > 0) {
      interiorMapsRef.current = location.interiorMaps;
      setInteriorMaps(location.interiorMaps);
      const activeStillExists = location.interiorMaps.some((m) => m.id === activeMapIdRef.current);
      const nextId = activeStillExists
        ? activeMapIdRef.current
        : (location.activeInteriorMapId && location.interiorMaps.some((m) => m.id === location.activeInteriorMapId)
            ? location.activeInteriorMapId
            : location.interiorMaps[0].id);
      if (nextId !== activeMapIdRef.current) {
        activeMapIdRef.current = nextId;
        setActiveMapId(nextId);
      }
      if (!isSettingsOpen) {
        const target = location.interiorMaps.find((m) => m.id === nextId) || location.interiorMaps[0];
        if (target) {
          setEditName(target.name);
          setEditCols(target.gridCols);
          setEditRows(target.gridRows);
          setEditShowGrid(target.showGrid);
        }
      }
    }
  }, [location.interiorMaps]);

  // Follow DM's room/chamber switch in real time (when Player Follow is enabled or when initial sync arrives)
  useEffect(() => {
    if (
      (effectiveDmMode || followDm) &&
      location.activeInteriorMapId &&
      location.activeInteriorMapId !== activeMapId &&
      location.interiorMaps?.some((m) => m.id === location.activeInteriorMapId)
    ) {
      activeMapIdRef.current = location.activeInteriorMapId;
      setActiveMapId(location.activeInteriorMapId);
      setSelectedTokenId(null);
      setRulerStart(null);
      setRulerEnd(null);
    }
  }, [location.activeInteriorMapId, location.interiorMaps, followDm, effectiveDmMode]);

  const [isFogToolbarOpen, setIsFogToolbarOpen] = useState<boolean>(false);
  const [fogBrushMode, setFogBrushMode] = useState<"off" | "reveal" | "hide">("off");
  const [fogBrushRadius, setFogBrushRadius] = useState<number>(12);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState<boolean>(false);
  const [customHpAmount, setCustomHpAmount] = useState<number>(5);

  // Custom Monster Spawner Modal state
  const [isCustomMonsterModalOpen, setIsCustomMonsterModalOpen] = useState(false);
  const [customMonsterName, setCustomMonsterName] = useState("Dire Wolf");
  const [customMonsterHp, setCustomMonsterHp] = useState(25);
  const [customMonsterType, setCustomMonsterType] = useState<"enemy" | "npc">("enemy");
  const [customMonsterImageUrl, setCustomMonsterImageUrl] = useState("");
  const [customMonsterColor, setCustomMonsterColor] = useState("#ef4444");
  const [customMonsterIsHpHidden, setCustomMonsterIsHpHidden] = useState<boolean>(true);
  const monsterFileInputRef = useRef<HTMLInputElement>(null);

  // Custom Environment Effect Modal state
  const [isEffectModalOpen, setIsEffectModalOpen] = useState(false);
  const [customEffectName, setCustomEffectName] = useState("Poison Cloud");
  const [customEffectType, setCustomEffectType] = useState("poison");
  const [customEffectIcon, setCustomEffectIcon] = useState("☠️");
  const [customEffectColor, setCustomEffectColor] = useState("#22c55e");
  const [customEffectRadius, setCustomEffectRadius] = useState<number>(1);
  const [customEffectDuration, setCustomEffectDuration] = useState<string>("10");
  const [customEffectNotes, setCustomEffectNotes] = useState("Heavily obscured. CON save vs poison damage when entering or starting turn inside.");
  const [customEffectIsHidden, setCustomEffectIsHidden] = useState<boolean>(false);

  const MONSTER_PRESETS = [
    { name: "Goblin Raider", hp: 10, color: "#ef4444", avatarUrl: "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&q=80&w=300" },
    { name: "Orc Berserker", hp: 25, color: "#dc2626", avatarUrl: "https://images.unsplash.com/photo-1563089145-599997674d42?auto=format&fit=crop&q=80&w=300" },
    { name: "Skeleton Guard", hp: 13, color: "#991b1b", avatarUrl: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&q=80&w=300" },
    { name: "Young Red Dragon", hp: 110, color: "#7f1d1d", avatarUrl: "https://images.unsplash.com/photo-1577495508048-b635879837f1?auto=format&fit=crop&q=80&w=300" },
    { name: "Beholder Eye Tyrant", hp: 80, color: "#9333ea", avatarUrl: "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&q=80&w=300" },
    { name: "Tavern Brawler", hp: 18, color: "#d97706", avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=300" }
  ];

  // Enqueue atomic or full-map mutations using authoritative refs so rapid damage + token moves never revert each other
  const enqueueMapMutation = (
    mutator: (prevMaps: SiteBattleMap[], currentActiveId: string) => { maps: SiteBattleMap[]; nextActiveId?: string },
    customRemoteSync?: (resolvedMaps: SiteBattleMap[], resolvedActiveId: string) => Promise<boolean>
  ) => {
    const currentActiveId = activeMapIdRef.current;
    const { maps: nextMaps, nextActiveId } = mutator(interiorMapsRef.current, currentActiveId);
    const resolvedActiveId = nextActiveId || currentActiveId;

    interiorMapsRef.current = nextMaps;
    activeMapIdRef.current = resolvedActiveId;
    setInteriorMaps(nextMaps);
    if (nextActiveId) {
      setActiveMapId(nextActiveId);
    }

    pendingSavesRef.current += 1;
    const task = saveQueueRef.current.then(async () => {
      try {
        if (customRemoteSync) {
          const ok = await customRemoteSync(nextMaps, resolvedActiveId);
          if (!ok) {
            await onSaveBattleMaps(location.id, nextMaps, resolvedActiveId, buildingId);
          }
        } else {
          await onSaveBattleMaps(location.id, nextMaps, resolvedActiveId, buildingId);
        }
      } finally {
        pendingSavesRef.current = Math.max(0, pendingSavesRef.current - 1);
      }
    });
    saveQueueRef.current = task.catch(() => {});
    return task;
  };

  // Sync edits to parent and server (serialized through queue)
  const saveChanges = async (updatedMaps: SiteBattleMap[], targetMapId = activeMapIdRef.current) => {
    await enqueueMapMutation(() => ({
      maps: updatedMaps,
      nextActiveId: targetMapId
    }));
  };

  // Update Fog of War on active battle map
  const handleUpdateBattleFog = async (nextFog: FogOfWarState) => {
    await enqueueMapMutation((prevMaps, currentActiveId) => ({
      maps: prevMaps.map((m) => (m.id === currentActiveId ? { ...m, fogOfWar: nextFog } : m))
    }));
  };

  const handleToggleBattleFogOrOpen = async () => {
    if (!activeMap.fogOfWar?.enabled) {
      await handleUpdateBattleFog({
        enabled: true,
        strokes: activeMap.fogOfWar?.strokes || []
      });
      setIsFogToolbarOpen(true);
      setFogBrushMode("reveal");
    } else {
      setIsFogToolbarOpen((prev) => {
        const nextOpen = !prev;
        if (!nextOpen) setFogBrushMode("off");
        return nextOpen;
      });
    }
  };

  const gridAspect = activeMap.gridCols / activeMap.gridRows;
  const maxDim = Math.max(activeMap.gridCols, activeMap.gridRows);
  const cellPx = maxDim <= 20 ? 56 : Math.max(16, Math.floor(1120 / maxDim));
  const boardWidth = activeMap.gridCols * cellPx;
  const boardHeight = activeMap.gridRows * cellPx;
  const gridLineColor = activeMap.gridColor || "rgba(255, 255, 255, 0.18)";
  const tokenPx = Math.max(12, Math.round(cellPx * 0.72));

  const computeFitZoom = (vw: number, vh: number, bw: number, bh: number) => {
    if (vw <= 0 || vh <= 0 || bw <= 0 || bh <= 0) return 1;
    const pad = 24;
    const scale = Math.min((vw - pad) / bw, (vh - pad) / bh);
    return Math.min(2.0, Math.max(0.25, parseFloat(scale.toFixed(2))));
  };

  const handleFitToScreen = () => {
    const nextZoom = computeFitZoom(viewportSize.width, viewportSize.height, boardWidth, boardHeight);
    setZoom(nextZoom);
    setPanOffset({ x: 0, y: 0 });
  };

  // Observe battle canvas viewport size so it always fits any window/screen size cleanly
  useEffect(() => {
    const el = battleViewportRef.current;
    if (!el) return;
    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      setViewportSize({ width: Math.floor(rect.width), height: Math.floor(rect.height) });
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isHudOpen, isTopBarOpen]);

  // Auto-fit tactical grid into viewport on initial open, room switch, or grid size change
  useEffect(() => {
    if (viewportSize.width <= 0 || viewportSize.height <= 0) return;
    const fitKey = `${activeMap.id}:${boardWidth}x${boardHeight}`;
    if (lastAutoFittedKeyRef.current !== fitKey) {
      lastAutoFittedKeyRef.current = fitKey;
      const fitZoom = computeFitZoom(viewportSize.width, viewportSize.height, boardWidth, boardHeight);
      setZoom(fitZoom);
      setPanOffset({ x: 0, y: 0 });
    }
  }, [activeMap.id, boardWidth, boardHeight, viewportSize.width, viewportSize.height]);

  // Non-passive wheel listener for smooth mouse-wheel zoom on tactical battle grid
  useEffect(() => {
    const el = battleViewportRef.current;
    if (!el) return;
    const handleNativeWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
      setZoom((prev) => Math.min(4.0, Math.max(0.25, parseFloat((prev * zoomFactor).toFixed(2)))));
    };
    el.addEventListener("wheel", handleNativeWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleNativeWheel);
  }, []);

  // Reliable global mouseup cleanup when panning
  useEffect(() => {
    if (!isDraggingMap) return;
    const handleGlobalMouseUp = () => {
      setIsDraggingMap(false);
      pointerDownPosRef.current = null;
    };
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => window.removeEventListener("mouseup", handleGlobalMouseUp);
  }, [isDraggingMap]);

  const handleBattleMouseDown = (e: React.MouseEvent) => {
    // Allow DM Fog Brush painting with left button; middle-click always pans
    if (effectiveDmMode && activeMap.fogOfWar?.enabled && fogBrushMode !== "off" && e.button === 0) {
      return;
    }
    if (e.button !== 0 && e.button !== 1) return;
    if (e.button === 1) e.preventDefault();
    setIsDraggingMap(true);
    didDragMapRef.current = false;
    pointerDownPosRef.current = { x: e.clientX, y: e.clientY };
    dragStartRef.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
  };

  const handleBattleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingMap) return;
    if (pointerDownPosRef.current) {
      const moved = Math.hypot(
        e.clientX - pointerDownPosRef.current.x,
        e.clientY - pointerDownPosRef.current.y
      );
      if (moved > 5) {
        didDragMapRef.current = true;
      }
    }
    setPanOffset({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y
    });
  };

  const handleBattleMouseUp = () => {
    setIsDraggingMap(false);
    pointerDownPosRef.current = null;
  };

  const handleBattleTouchStart = (e: React.TouchEvent) => {
    if (effectiveDmMode && activeMap.fogOfWar?.enabled && fogBrushMode !== "off" && e.touches.length === 1) {
      return;
    }
    if (e.touches.length === 1) {
      setIsDraggingMap(true);
      didDragMapRef.current = false;
      pointerDownPosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      dragStartRef.current = {
        x: e.touches[0].clientX - panOffset.x,
        y: e.touches[0].clientY - panOffset.y
      };
    } else if (e.touches.length === 2) {
      setIsDraggingMap(false);
      didDragMapRef.current = true;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchDistanceRef.current = Math.hypot(dx, dy);
    }
  };

  const handleBattleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDraggingMap) {
      if (pointerDownPosRef.current) {
        const moved = Math.hypot(
          e.touches[0].clientX - pointerDownPosRef.current.x,
          e.touches[0].clientY - pointerDownPosRef.current.y
        );
        if (moved > 5) {
          didDragMapRef.current = true;
        }
      }
      setPanOffset({
        x: e.touches[0].clientX - dragStartRef.current.x,
        y: e.touches[0].clientY - dragStartRef.current.y
      });
    } else if (e.touches.length === 2 && touchDistanceRef.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const newDistance = Math.hypot(dx, dy);
      const ratio = newDistance / touchDistanceRef.current;
      setZoom((prev) => Math.min(4.0, Math.max(0.25, parseFloat((prev * ratio).toFixed(2)))));
      touchDistanceRef.current = newDistance;
    }
  };

  const handleBattleTouchEnd = () => {
    setIsDraggingMap(false);
    touchDistanceRef.current = null;
    pointerDownPosRef.current = null;
  };

  const isCellVisibleToPlayers = (cIdx: number, rIdx: number) => {
    if (effectiveDmMode) return true;
    if (!activeMap.fogOfWar?.enabled) return true;
    const xPct = ((cIdx + 0.5) / activeMap.gridCols) * 100;
    const yPct = ((rIdx + 0.5) / activeMap.gridRows) * 100;
    return isPointVisibleToPlayers(activeMap.fogOfWar, xPct, yPct, gridAspect);
  };

  // Switch active map
  const handleSelectMap = (mapId: string) => {
    activeMapIdRef.current = mapId;
    setActiveMapId(mapId);
    setSelectedTokenId(null);
    setRulerStart(null);
    setRulerEnd(null);
    const target = interiorMapsRef.current.find(m => m.id === mapId);
    if (target) {
      setEditName(target.name);
      setEditCols(target.gridCols);
      setEditRows(target.gridRows);
      setEditShowGrid(target.showGrid);
    }
    enqueueMapMutation((prevMaps) => ({
      maps: prevMaps,
      nextActiveId: mapId
    }));
  };

  // Add new interior map floor
  const handleAddNewMap = async (e: React.FormEvent) => {
    e.preventDefault();
    const preset = BATTLEMAP_PRESETS.find(p => p.id === newMapPresetId) || BATTLEMAP_PRESETS[0];
    const safeCols = Math.max(4, Math.min(100, Number(newMapCols) || 14));
    const safeRows = Math.max(4, Math.min(100, Number(newMapRows) || 10));
    const trimmedName = newMapName.trim();
    setIsAddMapOpen(false);
    setNewMapName("");

    await enqueueMapMutation((prevMaps) => {
      const newMap: SiteBattleMap = {
        id: "map_" + Date.now(),
        locationId: location.id,
        name: trimmedName || `Level ${prevMaps.length + 1} Chamber`,
        description: `Interior sector of ${location.name}.`,
        imageUrl: preset.url,
        gridCols: safeCols,
        gridRows: safeRows,
        showGrid: true,
        gridColor: "rgba(255, 255, 255, 0.18)",
        tokens: []
      };
      return {
        maps: [...prevMaps, newMap],
        nextActiveId: newMap.id
      };
    });
  };

  // Delete or reset current interior map (in-app confirm, no window.confirm)
  const handleDeleteCurrentMap = async () => {
    setIsDeleteConfirmOpen(false);
    await enqueueMapMutation((prevMaps, currentActiveId) => {
      if (prevMaps.length <= 1) {
        const fresh = [getDefaultMap()];
        return { maps: fresh, nextActiveId: fresh[0].id };
      }
      const updated = prevMaps.filter(m => m.id !== currentActiveId);
      return { maps: updated, nextActiveId: updated[0].id };
    });
  };

  // Save map settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextCols = Math.max(4, Math.min(100, Number(editCols) || 12));
    const nextRows = Math.max(4, Math.min(100, Number(editRows) || 10));
    const nextName = editName.trim();
    const nextShowGrid = editShowGrid;
    setIsSettingsOpen(false);

    await enqueueMapMutation((prevMaps, currentActiveId) => ({
      maps: prevMaps.map(m => {
        if (m.id === currentActiveId) {
          const clampedTokens = m.tokens.map(t => ({
            ...t,
            x: Math.min(nextCols - 1, Math.max(0, t.x)),
            y: Math.min(nextRows - 1, Math.max(0, t.y))
          }));
          return {
            ...m,
            name: nextName || m.name,
            gridCols: nextCols,
            gridRows: nextRows,
            showGrid: nextShowGrid,
            tokens: clampedTokens
          };
        }
        return m;
      })
    }));
  };

  // Apply Imported Image (from URL or file upload)
  const handleApplyImage = async (url: string) => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;
    setUrlInput("");
    setIsImageImporterOpen(false);
    await enqueueMapMutation((prevMaps, currentActiveId) => ({
      maps: prevMaps.map(m => (m.id === currentActiveId ? { ...m, imageUrl: trimmedUrl } : m))
    }));
  };

  // Handle Local File Upload (auto-optimizes large images for fast JSON save/load)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await processUploadedImage(file);
      if (dataUrl) {
        await handleApplyImage(dataUrl);
      }
    } catch (err) {
      console.error("Failed to process battle map upload:", err);
    }
  };

  // Helper: Determine if a token's HP is hidden from players (checks both token flag and linked hero flag)
  const isTokenHpHidden = (token: MapToken): boolean => {
    if (token.isHpHidden !== undefined) return !!token.isHpHidden;
    if (token.characterId) {
      const linked = characters.find((c) => c.id === token.characterId);
      if (linked) return !!linked.isHpHidden;
    }
    return false;
  };

  const canViewTokenHp = (token: MapToken): boolean => {
    return effectiveDmMode || !isTokenHpHidden(token);
  };

  // Click on a Grid Cell (handles placement, token movement, ruler)
  // Always mutates from interiorMapsRef.current through serialized queue so token HP/notes NEVER revert when moving!
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

    const currentMaps = interiorMapsRef.current;
    const currentMap = currentMaps.find((m) => m.id === activeMapIdRef.current) || currentMaps[0];
    if (!currentMap) return;

    // 2. If placing a hero from party:
    if (activeTool === "place-hero" && selectedHeroToPlace) {
      const heroToPlace = selectedHeroToPlace;
      setSelectedHeroToPlace(null);
      setActiveTool("select");

      await enqueueMapMutation((prevMaps, curActiveId) => ({
        maps: prevMaps.map((m) => {
          if (m.id !== curActiveId) return m;
          const existingToken = m.tokens.find((t) => t.characterId === heroToPlace.id);
          const updatedTokens: MapToken[] = existingToken
            ? m.tokens.map((t) => (t.id === existingToken.id ? { ...t, x, y } : t))
            : [
                ...m.tokens,
                {
                  id: "token_" + Date.now(),
                  name: heroToPlace.name,
                  characterId: heroToPlace.id,
                  avatarUrl: heroToPlace.avatarUrl,
                  type: "player",
                  x,
                  y,
                  hp: heroToPlace.hp ? { current: heroToPlace.hp.current, max: heroToPlace.hp.max } : undefined,
                  isHpHidden: heroToPlace.isHpHidden
                }
              ];
          return { ...m, tokens: updatedTokens };
        })
      }));
      return;
    }

    // 2b. If placing an Environment Effect / Spell AoE token:
    if (activeTool === "place-effect" && selectedEffectToPlace) {
      const effectDraft = selectedEffectToPlace;
      setSelectedEffectToPlace(null);
      setActiveTool("select");
      await handleSpawnEffectAt(effectDraft, x, y);
      return;
    }

    // 3. If moving an already-selected token to a new cell:
    if (selectedTokenId) {
      const movingId = selectedTokenId;
      const token = currentMap.tokens.find((t) => t.id === movingId);
      if (token && (token.x !== x || token.y !== y)) {
        setSelectedTokenId(null);
        await enqueueMapMutation((prevMaps, curActiveId) => ({
          maps: prevMaps.map((m) => {
            if (m.id !== curActiveId) return m;
            return {
              ...m,
              tokens: m.tokens.map((t) => (t.id === movingId ? { ...t, x, y } : t))
            };
          })
        }));
        return;
      }
    }

    // 4. Default: Prioritize unit tokens on this square, then visible environment effect zones covering this square
    const unitAtCell = currentMap.tokens.find((t) => t.type !== "effect" && t.x === x && t.y === y);
    if (unitAtCell) {
      setSelectedTokenId(unitAtCell.id);
      return;
    }

    const visibleEffects = currentMap.tokens.filter(
      (t) => t.type === "effect" && (effectiveDmMode || (!t.isEffectHidden && isCellVisibleToPlayers(t.x, t.y)))
    );
    const effectAtCenter = visibleEffects.find((t) => t.x === x && t.y === y);
    const effectCoveringCell = visibleEffects.find(
      (t) => Math.abs(t.x - x) <= (t.areaRadius || 0) && Math.abs(t.y - y) <= (t.areaRadius || 0)
    );
    const matchedEffect = effectAtCenter || effectCoveringCell;
    if (matchedEffect) {
      setSelectedTokenId(matchedEffect.id);
    } else {
      setSelectedTokenId(null);
    }
  };

  // Deploy All Party Members to map entrance (bottom-left area)
  const handleDeployAllParty = async () => {
    await enqueueMapMutation((prevMaps, curActiveId) => ({
      maps: prevMaps.map((m) => {
        if (m.id !== curActiveId) return m;
        const existingCharIds = new Set(m.tokens.map((t) => t.characterId).filter(Boolean));
        const newTokens: MapToken[] = [];
        let startX = 1;
        let startY = m.gridRows - 2;

        characters.forEach((char) => {
          if (char.id === "dm" && characters.length > 1) return;
          if (!existingCharIds.has(char.id)) {
            newTokens.push({
              id: "token_" + char.id + "_" + Date.now(),
              name: char.name,
              characterId: char.id,
              avatarUrl: char.avatarUrl,
              type: "player",
              x: Math.min(m.gridCols - 1, startX),
              y: Math.max(0, startY),
              hp: char.hp ? { current: char.hp.current, max: char.hp.max } : undefined,
              isHpHidden: char.isHpHidden
            });
            startX++;
            if (startX > 4) {
              startX = 1;
              startY--;
            }
          }
        });

        return { ...m, tokens: [...m.tokens, ...newTokens] };
      })
    }));
  };

  // Quick Spawn Monster / Adversary Token onto Map (HP defaults to hidden from players)
  const handleSpawnEnemy = async (name: string, hp = 15, color = "#ef4444") => {
    await enqueueMapMutation((prevMaps, curActiveId) => ({
      maps: prevMaps.map((m) => {
        if (m.id !== curActiveId) return m;
        let placedX = Math.floor(m.gridCols / 2);
        let placedY = 2;
        while (m.tokens.some((t) => t.x === placedX && t.y === placedY) && placedY < m.gridRows - 1) {
          placedX = (placedX + 1) % m.gridCols;
          if (placedX === 0) placedY++;
        }
        const newEnemy: MapToken = {
          id: "enemy_" + Date.now(),
          name,
          type: "enemy",
          x: placedX,
          y: placedY,
          color,
          hp: { current: hp, max: hp },
          isHpHidden: true
        };
        return { ...m, tokens: [...m.tokens, newEnemy] };
      })
    }));
  };

  // Handle Monster Token Picture File Upload
  const handleMonsterFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await processUploadedImage(file);
      if (dataUrl) {
        setCustomMonsterImageUrl(dataUrl);
      }
    } catch (err) {
      console.error("Monster image upload error:", err);
    }
  };

  // Spawn Custom Monster Token onto battle grid
  const handleSpawnCustomMonster = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!customMonsterName.trim()) return;

    const tokenDraft = {
      name: customMonsterName.trim(),
      type: customMonsterType,
      avatarUrl: customMonsterImageUrl.trim() || undefined,
      color: customMonsterColor,
      hp: { current: customMonsterHp, max: customMonsterHp },
      isHpHidden: customMonsterIsHpHidden
    };
    setIsCustomMonsterModalOpen(false);

    await enqueueMapMutation((prevMaps, curActiveId) => ({
      maps: prevMaps.map((m) => {
        if (m.id !== curActiveId) return m;
        let placedX = Math.floor(m.gridCols / 2);
        let placedY = 2;
        while (m.tokens.some((t) => t.x === placedX && t.y === placedY) && placedY < m.gridRows - 1) {
          placedX = (placedX + 1) % m.gridCols;
          if (placedX === 0) placedY++;
        }
        const newToken: MapToken = {
          id: "monster_" + Date.now(),
          ...tokenDraft,
          x: placedX,
          y: placedY
        };
        return { ...m, tokens: [...m.tokens, newToken] };
      })
    }));
  };

  // Spawn an Environment Effect / Spell AoE Token at specific coordinates
  const handleSpawnEffectAt = async (draft: EnvironmentEffectDraft, x: number, y: number) => {
    const newId = "effect_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
    await enqueueMapMutation((prevMaps, curActiveId) => ({
      maps: prevMaps.map((m) => {
        if (m.id !== curActiveId) return m;
        const boundedX = Math.max(0, Math.min(m.gridCols - 1, x));
        const boundedY = Math.max(0, Math.min(m.gridRows - 1, y));
        const newEffect: MapToken = {
          id: newId,
          name: draft.name,
          type: "effect",
          x: boundedX,
          y: boundedY,
          color: draft.color,
          effectType: draft.effectType,
          effectIcon: draft.effectIcon,
          areaRadius: draft.areaRadius,
          effectDuration: draft.effectDuration,
          isEffectHidden: draft.isEffectHidden,
          notes: draft.notes
        };
        return { ...m, tokens: [...m.tokens, newEffect] };
      })
    }));
    setSelectedTokenId(newId);
  };

  // Spawn an Environment Effect at the center of the active tactical grid
  const handleSpawnEffectAtCenter = async (draft: EnvironmentEffectDraft) => {
    const curMap = interiorMapsRef.current.find((m) => m.id === activeMapIdRef.current) || activeMap;
    const cx = Math.floor((curMap?.gridCols || 14) / 2);
    const cy = Math.floor((curMap?.gridRows || 10) / 2);
    await handleSpawnEffectAt(draft, cx, cy);
  };

  // Update Environment Effect token properties (radius, duration, notes, DM hidden trap toggle)
  const handleUpdateEffectProps = async (
    tokenId: string,
    patch: Partial<Pick<MapToken, "areaRadius" | "effectDuration" | "isEffectHidden" | "notes" | "name" | "color" | "effectIcon">>
  ) => {
    await enqueueMapMutation((prevMaps, curActiveId) => ({
      maps: prevMaps.map((m) => {
        if (m.id !== curActiveId) return m;
        return {
          ...m,
          tokens: m.tokens.map((t) => (t.id === tokenId ? { ...t, ...patch } : t))
        };
      })
    }));
  };

  // Advance / Tick down round duration across all timed Environment Effects on this map
  const handleTickAllEffectDurations = async () => {
    await enqueueMapMutation((prevMaps, curActiveId) => ({
      maps: prevMaps.map((m) => {
        if (m.id !== curActiveId) return m;
        return {
          ...m,
          tokens: m.tokens.map((t) => {
            if (t.type !== "effect" || t.effectDuration === undefined) return t;
            return { ...t, effectDuration: Math.max(0, t.effectDuration - 1) };
          })
        };
      })
    }));
  };

  // Delete token from map
  const handleDeleteToken = async (tokenId: string) => {
    if (selectedTokenId === tokenId) setSelectedTokenId(null);
    await enqueueMapMutation((prevMaps, curActiveId) => ({
      maps: prevMaps.map((m) =>
        m.id === curActiveId
          ? { ...m, tokens: m.tokens.filter((t) => t.id !== tokenId) }
          : m
      )
    }));
  };

  // Adjust token HP via serialized atomic queue (persists, logs Damage/Heal, and never collides with token moves)
  const handleTokenHpDelta = async (tokenId: string, delta: number) => {
    const curMap = interiorMapsRef.current.find((m) => m.id === activeMapIdRef.current) || activeMap;
    const targetTok = curMap?.tokens.find((t) => t.id === tokenId);
    if (!targetTok || (!effectiveDmMode && isTokenHpHidden(targetTok))) return;

    await enqueueMapMutation(
      (prevMaps, curActiveId) => ({
        maps: prevMaps.map((m) => {
          if (m.id !== curActiveId) return m;
          return {
            ...m,
            tokens: m.tokens.map((t) => {
              if (t.id === tokenId && t.hp) {
                const newHp = Math.max(0, Math.min(t.hp.max, t.hp.current + delta));
                return { ...t, hp: { ...t.hp, current: newHp } };
              }
              return t;
            })
          };
        })
      }),
      onAdjustTokenHp
        ? async (_resolvedMaps, resolvedActiveId) =>
            onAdjustTokenHp({
              locationId: location.id,
              buildingId,
              mapId: resolvedActiveId,
              tokenId,
              delta
            })
        : undefined
    );
  };

  // Toggle individual token HP visibility (DM Only)
  const handleToggleTokenHpHidden = async (tokenId: string) => {
    if (!effectiveDmMode) return;
    const curMap = interiorMapsRef.current.find((m) => m.id === activeMapIdRef.current) || activeMap;
    const targetTok = curMap?.tokens.find((t) => t.id === tokenId);
    if (!targetTok) return;
    const nextHidden = !isTokenHpHidden(targetTok);

    await enqueueMapMutation(
      (prevMaps, curActiveId) => ({
        maps: prevMaps.map((m) => {
          if (m.id !== curActiveId) return m;
          return {
            ...m,
            tokens: m.tokens.map((t) => (t.id === tokenId ? { ...t, isHpHidden: nextHidden } : t))
          };
        })
      }),
      onAdjustTokenHp
        ? async (_resolvedMaps, resolvedActiveId) =>
            onAdjustTokenHp({
              locationId: location.id,
              buildingId,
              mapId: resolvedActiveId,
              tokenId,
              isHpHidden: nextHidden
            })
        : undefined
    );
  };

  // Bulk hide/show enemy & NPC HP or all tokens (DM Only)
  const handleBulkSetTokenHpVisibility = async (mode: "hide-non-players" | "show-all") => {
    if (!effectiveDmMode) return;
    await enqueueMapMutation((prevMaps, curActiveId) => ({
      maps: prevMaps.map((m) => {
        if (m.id !== curActiveId) return m;
        return {
          ...m,
          tokens: m.tokens.map((t) => {
            if (mode === "hide-non-players" && t.type !== "player") {
              return { ...t, isHpHidden: true };
            }
            if (mode === "show-all") {
              return { ...t, isHpHidden: false };
            }
            return t;
          })
        };
      })
    }));
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

  const rawSelectedToken = activeMap.tokens.find(t => t.id === selectedTokenId);
  const selectedToken = rawSelectedToken && (
    effectiveDmMode ||
    rawSelectedToken.type === "player" ||
    (rawSelectedToken.type === "effect"
      ? !rawSelectedToken.isEffectHidden && isCellVisibleToPlayers(rawSelectedToken.x, rawSelectedToken.y)
      : isCellVisibleToPlayers(rawSelectedToken.x, rawSelectedToken.y))
  )
    ? rawSelectedToken
    : undefined;

  return (
    <div className="fixed inset-0 z-50 h-[100dvh] max-h-[100dvh] bg-black/90 backdrop-blur-md flex flex-col p-2 md:p-4 text-slate-200 overflow-hidden font-sans select-none animate-in fade-in duration-200">
      
      {/* TOP HEADER COMMAND BAR */}
      {isTopBarOpen && (
      <div className="bg-[#0f1117] border border-white/10 rounded-2xl p-2.5 md:p-3.5 mb-2.5 flex flex-wrap items-center justify-between gap-2.5 shadow-2xl shrink-0">
        
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

        {/* Right: Map Actions (DM/Player Toggle, Fog of War, Fit Mode, Import Image, Settings, Delete, Close) */}
        <div className="flex items-center flex-wrap gap-1.5 sm:gap-2">
          {/* DM View / Player View Toggle */}
          <button
            onClick={handleSwitchDmMode}
            className={`px-2.5 py-1.5 rounded-lg text-2xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1 border ${
              effectiveDmMode
                ? "bg-amber-500 text-black border-amber-300"
                : "bg-blue-600 text-white border-blue-400"
            }`}
            title="Switch between DM Mode (manage fog & see all tokens) and Player View"
          >
            <span>{effectiveDmMode ? "🎭 DM View" : "🛡️ Player View"}</span>
          </button>

          {/* Follow DM Toggle in Player View */}
          {!effectiveDmMode && onToggleFollowDm && (
            <button
              onClick={onToggleFollowDm}
              className={`px-2.5 py-1.5 rounded-lg text-2xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1 border ${
                followDm
                  ? "bg-emerald-950/70 text-emerald-300 border-emerald-500/50"
                  : "bg-[#1a1c28] text-slate-400 border-white/10 hover:text-white"
              }`}
              title="Automatically follow the DM when they switch battle chambers or maps"
            >
              <span>{followDm ? "📡 Follow DM: ON" : "📡 Follow DM: OFF"}</span>
            </button>
          )}

          {/* Fog of War DM Button */}
          {effectiveDmMode && (
            <button
              onClick={handleToggleBattleFogOrOpen}
              className={`px-2.5 py-1.5 rounded-lg text-2xs uppercase font-mono font-bold transition-all flex items-center space-x-1.5 cursor-pointer border ${
                activeMap.fogOfWar?.enabled
                  ? "bg-purple-600/30 text-purple-200 border-purple-400/60 shadow"
                  : "bg-[#1a1c28] text-slate-300 border-white/10 hover:text-white"
              }`}
              title="Manage Fog of War on this battle map"
            >
              <Cloud className="w-3.5 h-3.5 text-purple-400" />
              <span>{activeMap.fogOfWar?.enabled ? "☁️ Fog: ON" : "☁️ Fog of War"}</span>
            </button>
          )}

          {/* Fit Map Picture Toggle (No Crop) */}
          <button
            onClick={() => setBattleMapFitMode(m => m === "contain" ? "cover" : "contain")}
            className={`px-2.5 py-1.5 rounded-lg text-2xs uppercase font-mono font-bold transition-all flex items-center space-x-1.5 cursor-pointer border ${
              battleMapFitMode === "contain"
                ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                : "bg-[#1a1c28] text-slate-300 border-white/10 hover:text-white"
            }`}
            title="Toggle between showing entire uncropped map picture vs filling grid"
          >
            <ImageIcon className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden sm:inline">{battleMapFitMode === "contain" ? "🖼️ Uncropped Fit" : "↔️ Fill Grid"}</span>
          </button>

          {/* Import / Change Image button */}
          <button
            onClick={() => setIsImageImporterOpen(true)}
            className="px-2.5 py-1.5 bg-[#1a1c28] hover:bg-amber-500/20 text-slate-200 hover:text-amber-300 border border-white/10 hover:border-amber-500/40 rounded-lg text-2xs uppercase font-mono font-bold transition-all flex items-center space-x-1.5 cursor-pointer shadow-sm"
            title="Import custom image/picture as the battle map of this site"
          >
            <Upload className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden sm:inline">Import Image</span>
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
            onClick={() => setIsDeleteConfirmOpen(true)}
            className="p-1.5 bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-500/30 rounded-lg transition-all cursor-pointer"
            title="Remove/Delete this inside battle map"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          {/* Toggle Top Command Bar */}
          <button
            type="button"
            onClick={handleToggleTopBar}
            className="px-2.5 py-1.5 rounded-lg text-2xs uppercase font-mono font-bold transition-all flex items-center space-x-1.5 cursor-pointer border bg-[#1a1c28] text-slate-300 border-white/10 hover:text-white"
            title="Collapse Top Command Bar"
          >
            <PanelTopClose className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Hide Top</span>
          </button>

          {/* Toggle Right Tactical Chamber HUD */}
          <button
            type="button"
            onClick={handleToggleHud}
            className={`px-2.5 py-1.5 rounded-lg text-2xs uppercase font-mono font-bold transition-all flex items-center space-x-1.5 cursor-pointer border ${
              isHudOpen
                ? "bg-[#1a1c28] text-slate-300 border-white/10 hover:text-white"
                : "bg-amber-500/20 text-amber-300 border-amber-500/40"
            }`}
            title={isHudOpen ? "Collapse Tactical HUD to widen grid" : "Open Tactical HUD"}
          >
            {isHudOpen ? (
              <PanelRightClose className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <PanelRightOpen className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span className="hidden sm:inline">{isHudOpen ? "Hide HUD" : "Show HUD"}</span>
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
      )}

      {/* DM FOG OF WAR MANAGEMENT BAR FOR BATTLE MAP */}
      {effectiveDmMode && isFogToolbarOpen && (
        <div className="bg-[#151224] border border-purple-500/40 rounded-xl px-4 py-2 mb-3 flex flex-wrap items-center justify-between gap-2 text-xs font-mono shadow-lg shrink-0">
          <div className="flex items-center flex-wrap gap-2">
            <span className="text-purple-300 font-bold flex items-center gap-1">
              <Cloud className="w-4 h-4 text-purple-400" />
              <span>Fog of War:</span>
            </span>

            <button
              onClick={() => setFogBrushMode(fogBrushMode === "reveal" ? "off" : "reveal")}
              className={`px-2.5 py-1 rounded-lg border font-bold flex items-center gap-1 cursor-pointer transition-all ${
                fogBrushMode === "reveal"
                  ? "bg-amber-500 text-black border-amber-300 shadow"
                  : "bg-white/5 hover:bg-white/10 text-slate-200 border-white/15"
              }`}
              title="Click and drag over battle grid to reveal rooms to players"
            >
              <Eraser className="w-3.5 h-3.5" />
              <span>Clear Fog (Reveal)</span>
            </button>

            <button
              onClick={() => setFogBrushMode(fogBrushMode === "hide" ? "off" : "hide")}
              className={`px-2.5 py-1 rounded-lg border font-bold flex items-center gap-1 cursor-pointer transition-all ${
                fogBrushMode === "hide"
                  ? "bg-purple-500 text-white border-purple-300 shadow"
                  : "bg-white/5 hover:bg-white/10 text-slate-200 border-white/15"
              }`}
              title="Click and drag to paint fog back over areas"
            >
              <Cloud className="w-3.5 h-3.5" />
              <span>Add Fog (Cover)</span>
            </button>

            <div className="flex items-center bg-black/40 border border-white/10 rounded-lg p-0.5">
              {[{ label: "S", r: 7 }, { label: "M", r: 14 }, { label: "L", r: 24 }].map((sz) => (
                <button
                  key={sz.label}
                  onClick={() => setFogBrushRadius(sz.r)}
                  className={`px-2 py-0.5 rounded text-2xs font-bold cursor-pointer ${
                    fogBrushRadius === sz.r ? "bg-purple-500 text-white" : "text-slate-400 hover:text-white"
                  }`}
                >
                  {sz.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-1.5">
            <button
              onClick={() => {
                const strokes = activeMap.fogOfWar?.strokes || [];
                if (strokes.length > 0) {
                  handleUpdateBattleFog({ enabled: true, strokes: strokes.slice(0, -1) });
                }
              }}
              disabled={!activeMap.fogOfWar?.strokes?.length}
              className="px-2 py-1 bg-white/5 hover:bg-white/10 disabled:opacity-40 text-slate-200 rounded-lg border border-white/10 flex items-center gap-1 cursor-pointer"
            >
              <Undo2 className="w-3 h-3" />
              <span>Undo</span>
            </button>
            <button
              onClick={() => handleUpdateBattleFog({ enabled: true, strokes: [] })}
              className="px-2 py-1 bg-purple-950/60 hover:bg-purple-900/70 text-purple-200 rounded-lg border border-purple-500/30 cursor-pointer"
            >
              Cover All
            </button>
            <button
              onClick={() => handleUpdateBattleFog({ enabled: true, strokes: [{ x: 50, y: 50, r: 150, mode: "reveal" }] })}
              className="px-2 py-1 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 rounded-lg border border-amber-500/30 cursor-pointer"
            >
              Reveal All
            </button>
            <button
              onClick={() => {
                handleUpdateBattleFog({ enabled: false, strokes: activeMap.fogOfWar?.strokes || [] });
                setFogBrushMode("off");
                setIsFogToolbarOpen(false);
              }}
              className="px-2 py-1 bg-red-950/50 hover:bg-red-900/60 text-red-300 rounded-lg border border-red-500/30 flex items-center gap-1 cursor-pointer"
            >
              <CloudOff className="w-3 h-3" />
              <span>Turn Off Fog</span>
            </button>
            <button
              onClick={() => { setFogBrushMode("off"); setIsFogToolbarOpen(false); }}
              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* MAIN BATTLE MAP VIEWPORT & SIDE PANELS */}
      <div className="flex-1 flex flex-col lg:flex-row gap-3 min-h-0 overflow-hidden relative">
        
        {/* LEFT / CENTER: THE INTERACTIVE TACTICAL COMBAT GRID CANVAS */}
        <div className="flex-1 min-h-0 bg-[#0a0c10] border border-white/10 rounded-2xl overflow-hidden relative shadow-inner flex flex-col">
          
          {/* Canvas Floating Overlay Controls (Tools, Zoom, Ruler distance, Restore Bars) */}
          <div className="absolute top-3 left-3 z-30 flex flex-wrap items-center gap-1.5 bg-[#0f1117]/90 backdrop-blur border border-white/10 p-1.5 rounded-xl shadow-lg max-w-[95%]">
            {!isTopBarOpen && (
              <>
                <button
                  type="button"
                  onClick={handleToggleTopBar}
                  className="px-2.5 py-1 rounded text-3xs font-mono uppercase font-bold flex items-center space-x-1 cursor-pointer bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30"
                  title="Show Top Command Bar"
                >
                  <PanelTopOpen className="w-3 h-3" />
                  <span>Show Top</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-2 py-1 rounded text-3xs font-mono uppercase font-bold flex items-center space-x-1 cursor-pointer bg-white/5 hover:bg-red-950/50 text-slate-300 hover:text-red-400 border border-white/10"
                  title="Exit Site Interior Map"
                >
                  <X className="w-3 h-3" />
                  <span>Exit</span>
                </button>
              </>
            )}
            {!isHudOpen && (
              <button
                type="button"
                onClick={handleToggleHud}
                className="px-2.5 py-1 rounded text-3xs font-mono uppercase font-bold flex items-center space-x-1 cursor-pointer bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30"
                title="Open Tactical HUD Panel"
              >
                <PanelRightOpen className="w-3 h-3" />
                <span>HUD</span>
              </button>
            )}
            
            {/* Tool: Select/Move */}
            <button
              onClick={() => {
                setActiveTool("select");
                setSelectedHeroToPlace(null);
                setSelectedEffectToPlace(null);
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
                setSelectedEffectToPlace(null);
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
                enqueueMapMutation((prevMaps, currentActiveId) => ({
                  maps: prevMaps.map(m => (m.id === currentActiveId ? { ...m, showGrid: !m.showGrid } : m))
                }));
              }}
              className={`p-1 rounded text-3xs font-mono uppercase transition-all ${
                activeMap.showGrid ? "text-amber-400" : "text-slate-500"
              }`}
              title="Toggle Grid Lines"
            >
              <Grid className="w-3.5 h-3.5" />
            </button>

            {/* Zoom & Fit Controls (25% - 400%) */}
            <div className="flex items-center space-x-1 border-l border-white/10 pl-2">
              <button
                onClick={() => setZoom(z => Math.max(0.25, parseFloat((z - 0.15).toFixed(2))))}
                className="p-1 hover:bg-white/10 text-slate-400 hover:text-white rounded cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut className="w-3 h-3" />
              </button>
              <button
                onClick={handleFitToScreen}
                className="text-3xs font-mono text-amber-400 hover:text-amber-300 w-10 text-center cursor-pointer font-bold"
                title="Click to Fit & Center Battle Map to Screen"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                onClick={() => setZoom(z => Math.min(4.0, parseFloat((z + 0.15).toFixed(2))))}
                className="p-1 hover:bg-white/10 text-slate-400 hover:text-white rounded cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn className="w-3 h-3" />
              </button>
              <button
                onClick={handleFitToScreen}
                className="px-1.5 py-0.5 hover:bg-white/10 text-slate-300 hover:text-amber-300 rounded text-3xs font-mono flex items-center gap-1 cursor-pointer border border-white/10"
                title="Fit Battle Map to Screen"
              >
                <Maximize2 className="w-2.5 h-2.5" />
                <span>Fit</span>
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

            {activeTool === "place-effect" && selectedEffectToPlace && (
              <div
                style={{ borderColor: selectedEffectToPlace.color }}
                className="bg-[#141622]/95 border-2 text-slate-100 px-3 py-1 rounded-xl font-mono text-2xs font-bold shadow-lg flex items-center space-x-2"
              >
                <span>
                  {selectedEffectToPlace.effectIcon} Click square to cast{" "}
                  <strong className="text-amber-300">{selectedEffectToPlace.name}</strong> (
                  {((selectedEffectToPlace.areaRadius || 0) * 2 + 1) * 5}ft)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const draft = selectedEffectToPlace;
                    setSelectedEffectToPlace(null);
                    setActiveTool("select");
                    handleSpawnEffectAtCenter(draft);
                  }}
                  className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/35 text-amber-300 border border-amber-500/40 text-3xs cursor-pointer"
                >
                  Center
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedEffectToPlace(null);
                    setActiveTool("select");
                  }}
                  className="ml-1 text-slate-400 hover:text-white cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {selectedTokenId && selectedToken && (
              <div className="bg-[#141622]/95 border border-amber-500/40 text-amber-300 px-3 py-1 rounded-xl font-mono text-2xs shadow-lg flex items-center space-x-2">
                <span>
                  {selectedToken.type === "effect" ? `${selectedToken.effectIcon || "✨"} Effect:` : "Token Selected:"}{" "}
                  <strong className="text-white">{selectedToken.name}</strong>
                </span>
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

          {/* Floating Pan/Zoom Helper Badge */}
          <div className="absolute bottom-3 left-3 z-30 bg-[#0f111a]/85 backdrop-blur border border-white/10 rounded-lg px-2.5 py-1 text-4xs font-mono text-slate-400 pointer-events-none shadow-md">
            Drag to pan • Wheel / pinch to zoom
          </div>

          {/* PANNABLE & ZOOMABLE TACTICAL GRID VIEWPORT */}
          <div
            ref={battleViewportRef}
            onMouseDown={handleBattleMouseDown}
            onMouseMove={handleBattleMouseMove}
            onMouseUp={handleBattleMouseUp}
            onTouchStart={handleBattleTouchStart}
            onTouchMove={handleBattleTouchMove}
            onTouchEnd={handleBattleTouchEnd}
            style={{ touchAction: "none" }}
            className={`flex-1 min-h-0 relative overflow-hidden flex items-center justify-center select-none ${
              isDraggingMap ? "cursor-grabbing" : "cursor-grab"
            }`}
          >
            {(() => {
              const getGridCoordsFromPointer = (clientX: number, clientY: number) => {
                const el = gridContainerRef.current;
                if (!el) return null;
                const rect = el.getBoundingClientRect();
                if (rect.width <= 0 || rect.height <= 0) return null;
                const cIdx = Math.max(0, Math.min(activeMap.gridCols - 1, Math.floor(((clientX - rect.left) / rect.width) * activeMap.gridCols)));
                const rIdx = Math.max(0, Math.min(activeMap.gridRows - 1, Math.floor(((clientY - rect.top) / rect.height) * activeMap.gridRows)));
                return { x: cIdx, y: rIdx };
              };

              return (
                <div
                  style={{
                    transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
                    transformOrigin: "center center",
                    transition: isDraggingMap ? "none" : "transform 0.08s ease-out"
                  }}
                  className="relative shadow-2xl rounded-xl overflow-hidden border border-white/20 shrink-0"
                >
                  {/* Battle Map Background Image */}
                  <div
                    ref={gridContainerRef}
                    onClick={(e) => {
                      if (didDragMapRef.current) {
                        didDragMapRef.current = false;
                        return;
                      }
                      const coords = getGridCoordsFromPointer(e.clientX, e.clientY);
                      if (coords) handleCellClick(coords.x, coords.y);
                    }}
                    onMouseMove={(e) => {
                      if (isDraggingMap) return;
                      const coords = getGridCoordsFromPointer(e.clientX, e.clientY);
                      setHoverCell(coords);
                    }}
                    onMouseLeave={() => setHoverCell(null)}
                    style={{
                      backgroundImage: `url(${activeMap.imageUrl})`,
                      backgroundSize: battleMapFitMode === "contain" ? "contain" : "cover",
                      backgroundRepeat: "no-repeat",
                      backgroundPosition: "center",
                      backgroundColor: "#07080c",
                      width: `${boardWidth}px`,
                      height: `${boardHeight}px`
                    }}
                    className={`relative ${isDraggingMap ? "cursor-grabbing" : "cursor-pointer"}`}
                  >
                    {/* Vignette / ambient battle lighting */}
                    <div className="absolute inset-0 bg-black/20 pointer-events-none" />

                    {/* High-Performance CSS Grid Lines (Supports up to 100x100 cleanly) */}
                    {activeMap.showGrid && (
                      <div
                        className="absolute inset-0 z-10 pointer-events-none"
                        style={{
                          backgroundImage: `linear-gradient(to right, ${gridLineColor} 1px, transparent 1px), linear-gradient(to bottom, ${gridLineColor} 1px, transparent 1px)`,
                          backgroundSize: `${cellPx}px ${cellPx}px`
                        }}
                      />
                    )}

                    {/* Hover Cell / Environment AoE Preview Highlight */}
                    {hoverCell && activeTool === "place-effect" && selectedEffectToPlace ? (() => {
                      const rad = selectedEffectToPlace.areaRadius || 0;
                      const spanCells = rad * 2 + 1;
                      return (
                        <div
                          style={{
                            left: `${((hoverCell.x + 0.5) / activeMap.gridCols) * 100}%`,
                            top: `${((hoverCell.y + 0.5) / activeMap.gridRows) * 100}%`,
                            width: `${(spanCells / activeMap.gridCols) * 100}%`,
                            height: `${(spanCells / activeMap.gridRows) * 100}%`,
                            transform: "translate(-50%, -50%)",
                            backgroundColor: `${selectedEffectToPlace.color}33`,
                            borderColor: selectedEffectToPlace.color
                          }}
                          className="absolute z-[16] rounded-lg border-2 border-dashed flex items-center justify-center pointer-events-none"
                        >
                          <span className="text-lg drop-shadow">{selectedEffectToPlace.effectIcon}</span>
                        </div>
                      );
                    })() : hoverCell ? (
                      <div
                        style={{
                          left: `${(hoverCell.x / activeMap.gridCols) * 100}%`,
                          top: `${(hoverCell.y / activeMap.gridRows) * 100}%`,
                          width: `${100 / activeMap.gridCols}%`,
                          height: `${100 / activeMap.gridRows}%`
                        }}
                        className="absolute z-10 bg-amber-500/15 pointer-events-none"
                      />
                    ) : null}

                    {/* Selected Token Cell Highlight */}
                    {selectedToken && selectedToken.type !== "effect" && (
                      <div
                        style={{
                          left: `${(selectedToken.x / activeMap.gridCols) * 100}%`,
                          top: `${(selectedToken.y / activeMap.gridRows) * 100}%`,
                          width: `${100 / activeMap.gridCols}%`,
                          height: `${100 / activeMap.gridRows}%`
                        }}
                        className="absolute z-10 bg-amber-500/25 ring-2 ring-amber-400 ring-inset pointer-events-none"
                      />
                    )}

                    {/* Ruler Point Highlights */}
                    {[rulerStart, rulerEnd].map((pt, idx) =>
                      pt ? (
                        <div
                          key={`ruler-pt-${idx}`}
                          style={{
                            left: `${(pt.x / activeMap.gridCols) * 100}%`,
                            top: `${(pt.y / activeMap.gridRows) * 100}%`,
                            width: `${100 / activeMap.gridCols}%`,
                            height: `${100 / activeMap.gridRows}%`
                          }}
                          className="absolute z-10 bg-cyan-500/30 ring-2 ring-cyan-400 ring-inset pointer-events-none"
                        />
                      ) : null
                    )}

                    {/* Environment Effects & Spell AoE Underlay Layer (z-[15] underneath unit tokens) */}
                    {activeMap.tokens
                      .filter((t) => t.type === "effect")
                      .map((effectHere) => {
                        const cellVisibleToPlayers = isCellVisibleToPlayers(effectHere.x, effectHere.y);
                        const shouldShowEffect =
                          effectiveDmMode || (!effectHere.isEffectHidden && cellVisibleToPlayers);
                        if (!shouldShowEffect) return null;

                        const rad = effectHere.areaRadius || 0;
                        const spanCells = rad * 2 + 1;
                        const tint = effectHere.color || "#22c55e";
                        const isSelected = selectedTokenId === effectHere.id;
                        const hasUnitAtCenter = activeMap.tokens.some(
                          (u) => u.type !== "effect" && u.x === effectHere.x && u.y === effectHere.y
                        );

                        return (
                          <div
                            key={effectHere.id}
                            style={{
                              left: `${((effectHere.x + 0.5) / activeMap.gridCols) * 100}%`,
                              top: `${((effectHere.y + 0.5) / activeMap.gridRows) * 100}%`,
                              width: `${(spanCells / activeMap.gridCols) * 100}%`,
                              height: `${(spanCells / activeMap.gridRows) * 100}%`,
                              transform: "translate(-50%, -50%)",
                              backgroundColor: `${tint}30`,
                              borderColor: isSelected ? "#fbbf24" : tint,
                              boxShadow: isSelected ? `0 0 18px ${tint}88` : `inset 0 0 14px ${tint}38`
                            }}
                            className={`absolute z-[15] rounded-xl border-2 ${
                              isSelected ? "ring-2 ring-amber-400 border-solid" : "border-dashed"
                            } flex flex-col items-center justify-between p-1 pointer-events-none transition-all ${
                              effectHere.isEffectHidden ? "opacity-65" : ""
                            }`}
                            title={`${effectHere.name} (${spanCells * 5}ft × ${spanCells * 5}ft)${effectHere.notes ? ` — ${effectHere.notes}` : ""}`}
                          >
                            {/* Top Corner Tags: DM Hidden Trap & Round Duration */}
                            <div className="w-full flex items-center justify-between gap-1 text-[8px] font-mono leading-none">
                              {effectHere.isEffectHidden ? (
                                <span className="px-1 py-0.5 rounded bg-black/80 text-amber-300 border border-amber-500/40">
                                  DM Trap
                                </span>
                              ) : (
                                <span />
                              )}
                              {effectHere.effectDuration !== undefined && (
                                <span
                                  className={`px-1 py-0.5 rounded font-bold ${
                                    effectHere.effectDuration === 0
                                      ? "bg-red-950/90 text-red-300 border border-red-500/40"
                                      : "bg-black/80 text-slate-200 border border-white/15"
                                  }`}
                                >
                                  ⏳ {effectHere.effectDuration}r
                                </span>
                              )}
                            </div>

                            {/* Center Emblem (faded slightly if a character stands on exact center tile) */}
                            <div
                              style={{ borderColor: `${tint}99` }}
                              className={`flex items-center justify-center rounded-full bg-black/55 border shadow ${
                                hasUnitAtCenter ? "opacity-35 scale-75" : "opacity-95"
                              } ${spanCells >= 3 ? "w-8 h-8 text-base" : "w-6 h-6 text-xs"}`}
                            >
                              <span>{effectHere.effectIcon || "✨"}</span>
                            </div>

                            {/* Bottom Zone Title */}
                            {cellPx >= 20 && (
                              <span
                                style={{ borderColor: `${tint}66` }}
                                className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded bg-black/80 text-slate-100 border whitespace-nowrap max-w-full truncate shadow"
                              >
                                {effectHere.name}
                              </span>
                            )}
                          </div>
                        );
                      })}

                    {/* Deployed Unit Tokens Layer (Players, Enemies, NPCs on z-20 above effects) */}
                    {activeMap.tokens
                      .filter((t) => t.type !== "effect")
                      .map((tokenHere) => {
                        const cellVisibleToPlayers = isCellVisibleToPlayers(tokenHere.x, tokenHere.y);
                        const shouldShowToken = effectiveDmMode || tokenHere.type === "player" || cellVisibleToPlayers;
                        if (!shouldShowToken) return null;

                        return (
                          <div
                            key={tokenHere.id}
                            style={{
                              left: `${((tokenHere.x + 0.5) / activeMap.gridCols) * 100}%`,
                              top: `${((tokenHere.y + 0.5) / activeMap.gridRows) * 100}%`,
                              transform: "translate(-50%, -50%)"
                            }}
                            className="absolute z-20 flex flex-col items-center pointer-events-none"
                            title={`${tokenHere.name} (${tokenHere.x + 1}, ${tokenHere.y + 1})`}
                          >
                            <div
                              style={{ width: `${tokenPx}px`, height: `${tokenPx}px` }}
                              className={`rounded-full border-2 overflow-hidden flex items-center justify-center font-bold text-[10px] shadow-xl transition-transform ${
                                tokenHere.type === "player"
                                  ? "border-amber-400 bg-amber-950 text-amber-200 ring-2 ring-amber-500/40"
                                  : tokenHere.type === "npc"
                                  ? "border-cyan-400 bg-cyan-950 text-cyan-200 ring-2 ring-cyan-500/40"
                                  : "border-red-400 bg-red-950 text-red-200 ring-2 ring-red-500/40"
                              } ${selectedTokenId === tokenHere.id ? "scale-115 ring-4 ring-amber-300 animate-pulse" : ""}`}
                            >
                              {tokenHere.avatarUrl ? (
                                <img src={tokenHere.avatarUrl} alt={tokenHere.name} className="w-full h-full object-cover" />
                              ) : (
                                tokenHere.name[0]
                              )}
                            </div>

                            {tokenHere.hp && cellPx >= 28 && canViewTokenHp(tokenHere) && (
                              <div className="w-7 h-1 bg-black/60 rounded-full overflow-hidden mt-0.5 border border-white/20">
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

                            {cellPx >= 24 && (
                              <span className="text-[8px] font-mono font-bold px-1 rounded bg-black/85 text-slate-100 whitespace-nowrap mt-0.5 max-w-[54px] truncate shadow">
                                {tokenHere.name.split(" ")[0]}
                              </span>
                            )}
                          </div>
                        );
                      })}

                    {/* Ruler SVG vector line (Resolution-independent for 4x4 to 100x100) */}
                    {rulerStart && rulerEnd && (
                      <svg
                        viewBox={`0 0 ${activeMap.gridCols} ${activeMap.gridRows}`}
                        preserveAspectRatio="none"
                        className="absolute inset-0 w-full h-full pointer-events-none z-20"
                      >
                        <line
                          x1={rulerStart.x + 0.5}
                          y1={rulerStart.y + 0.5}
                          x2={rulerEnd.x + 0.5}
                          y2={rulerEnd.y + 0.5}
                          stroke="#06b6d4"
                          strokeWidth={Math.max(0.08, Math.min(0.25, maxDim * 0.004))}
                          strokeDasharray="0.25,0.18"
                        />
                      </svg>
                    )}

                    {/* Battle Map Fog of War Overlay */}
                    <FogOfWarOverlay
                      fogOfWar={activeMap.fogOfWar}
                      aspect={gridAspect}
                      isDmMode={effectiveDmMode}
                      brushMode={fogBrushMode}
                      brushRadius={fogBrushRadius}
                      onUpdateFog={handleUpdateBattleFog}
                      zIndexClass="z-[25]"
                    />

                  </div>
                </div>
              );
            })()}
          </div>

          {/* BOTTOM TRAY: PARTY CHARACTERS & COMBAT SPAWN DECK */}
          <div className="p-2 sm:p-2.5 bg-[#0d0f15] border-t border-white/10 flex flex-wrap items-center justify-between gap-2 shrink-0 max-h-[22vh] overflow-y-auto">
            
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

            {/* Environment Effects & D&D Spell AoE Tokens */}
            <div className="w-full flex items-center gap-1.5 pt-1.5 border-t border-white/5 overflow-x-auto">
              <button
                type="button"
                onClick={() => setIsEffectModalOpen(true)}
                className="px-2.5 py-1 bg-purple-600/25 hover:bg-purple-600/45 text-purple-200 border border-purple-500/40 rounded-lg text-3xs font-mono font-bold transition-all cursor-pointer flex items-center space-x-1 shrink-0"
                title="Create custom D&D environment hazard or spell Area of Effect token"
              >
                <Flame className="w-3 h-3 text-amber-400" />
                <span>+ Env Effect</span>
              </button>

              <span className="text-3xs font-mono uppercase text-purple-400 font-bold shrink-0">
                Hazards / AoE:
              </span>

              {ENVIRONMENT_EFFECT_PRESETS.slice(0, 8).map((preset) => {
                const isArmed =
                  activeTool === "place-effect" &&
                  selectedEffectToPlace?.effectType === preset.effectType &&
                  selectedEffectToPlace?.name === preset.name;
                return (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => {
                      if (isArmed) {
                        setSelectedEffectToPlace(null);
                        setActiveTool("select");
                      } else {
                        setSelectedHeroToPlace(null);
                        setSelectedTokenId(null);
                        setSelectedEffectToPlace(preset);
                        setActiveTool("place-effect");
                      }
                    }}
                    style={isArmed ? { borderColor: preset.color, backgroundColor: `${preset.color}33` } : undefined}
                    className={`px-2 py-0.5 rounded border text-3xs font-mono flex items-center space-x-1 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                      isArmed
                        ? "text-white font-bold shadow"
                        : "bg-[#141622] hover:bg-white/10 text-slate-300 border-white/10"
                    }`}
                    title={`Click then tap a grid square to place ${preset.name} (${((preset.areaRadius || 0) * 2 + 1) * 5}ft)`}
                  >
                    <span>{preset.effectIcon}</span>
                    <span>{preset.name}</span>
                  </button>
                );
              })}
            </div>

          </div>

        </div>

        {/* RIGHT / SIDE PANEL: TACTICAL TOKEN INSPECTOR & CHAMBER REPORT (COLLAPSIBLE) */}
        <div
          className={`w-full lg:w-80 max-h-[32vh] lg:max-h-full min-h-0 bg-[#0f1117] border border-white/10 rounded-2xl p-3 sm:p-4 flex-col justify-between shrink-0 space-y-3 shadow-xl overflow-y-auto ${
            isHudOpen ? "flex" : "hidden"
          }`}
        >
          
          <div className="space-y-4">
            
            {/* Header / Active Map details */}
            <div className="border-b border-white/10 pb-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-3xs uppercase font-mono text-amber-500 font-bold">
                  Tactical Chamber HUD
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-3xs font-mono text-slate-400">
                    {activeMap.tokens.length} Token{activeMap.tokens.length === 1 ? "" : "s"}
                  </span>
                  <button
                    type="button"
                    onClick={handleToggleHud}
                    className="p-1 text-slate-400 hover:text-amber-400 rounded hover:bg-white/5 transition-colors cursor-pointer"
                    title="Collapse Tactical HUD"
                  >
                    <PanelRightClose className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <h3 className="text-base font-bold text-white font-serif italic mt-1">
                {activeMap.name}
              </h3>
              <p className="text-2xs text-slate-400 font-editorial mt-1 leading-relaxed">
                "{activeMap.description || `Tactical layout of ${location.name}.`}"
              </p>
            </div>

            {/* Token / Effect Inspector */}
            {selectedToken && selectedToken.type === "effect" ? (
              <div
                style={{ borderColor: selectedToken.color || "#a855f7" }}
                className="p-3 bg-[#141622] border rounded-xl space-y-3 animate-in fade-in"
              >
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <div className="flex items-center space-x-2 min-w-0">
                    <div
                      style={{
                        borderColor: selectedToken.color || "#a855f7",
                        backgroundColor: `${selectedToken.color || "#a855f7"}26`
                      }}
                      className="w-8 h-8 rounded-lg border flex items-center justify-center text-base shrink-0"
                    >
                      {selectedToken.effectIcon || "✨"}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-white font-serif truncate">{selectedToken.name}</h4>
                      <span className="text-3xs font-mono text-purple-300 uppercase">
                        Env Effect • {((selectedToken.areaRadius || 0) * 2 + 1) * 5}ft ({(selectedToken.areaRadius || 0) * 2 + 1}×{(selectedToken.areaRadius || 0) * 2 + 1}) • ({selectedToken.x + 1}, {selectedToken.y + 1})
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteToken(selectedToken.id)}
                    className="p-1 text-slate-500 hover:text-red-400 rounded transition-colors cursor-pointer"
                    title="Remove environment effect from grid"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Area of Effect Size Controls */}
                <div className="space-y-1">
                  <span className="text-3xs font-mono uppercase text-slate-400 font-bold block">
                    Area Radius / Footprint
                  </span>
                  <div className="grid grid-cols-4 gap-1">
                    {[
                      { r: 0, label: "5ft" },
                      { r: 1, label: "15ft" },
                      { r: 2, label: "25ft" },
                      { r: 3, label: "35ft" }
                    ].map((sz) => (
                      <button
                        key={sz.r}
                        type="button"
                        onClick={() => handleUpdateEffectProps(selectedToken.id, { areaRadius: sz.r })}
                        className={`py-1 rounded border text-[10px] font-mono font-bold cursor-pointer transition-all ${
                          (selectedToken.areaRadius || 0) === sz.r
                            ? "bg-amber-500 text-black border-amber-300"
                            : "bg-black/40 text-slate-300 border-white/10 hover:border-white/30"
                        }`}
                      >
                        {sz.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Duration Counter (Rounds) & DM Visibility Toggle */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-2xs font-mono text-slate-300">
                    <span className="flex items-center gap-1">
                      <Hourglass className="w-3 h-3 text-amber-400" />
                      <span>Duration</span>
                    </span>
                    <span className="font-bold text-amber-300">
                      {selectedToken.effectDuration === undefined
                        ? "Permanent / ∞"
                        : selectedToken.effectDuration === 0
                        ? "Expired (0r)"
                        : `${selectedToken.effectDuration} round${selectedToken.effectDuration === 1 ? "" : "s"}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-mono">
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateEffectProps(selectedToken.id, {
                          effectDuration: Math.max(0, (selectedToken.effectDuration ?? 1) - 1)
                        })
                      }
                      className="px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-slate-200 cursor-pointer"
                    >
                      -1r
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateEffectProps(selectedToken.id, {
                          effectDuration: (selectedToken.effectDuration ?? 0) + 1
                        })
                      }
                      className="px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-slate-200 cursor-pointer"
                    >
                      +1r
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateEffectProps(selectedToken.id, {
                          effectDuration: selectedToken.effectDuration === undefined ? 10 : undefined
                        })
                      }
                      className="flex-1 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-slate-300 cursor-pointer"
                    >
                      {selectedToken.effectDuration === undefined ? "Set 10r" : "Make ∞"}
                    </button>
                    {effectiveDmMode && (
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateEffectProps(selectedToken.id, {
                            isEffectHidden: !selectedToken.isEffectHidden
                          })
                        }
                        className={`px-2 py-1 rounded border flex items-center gap-1 cursor-pointer ${
                          selectedToken.isEffectHidden
                            ? "bg-amber-500/20 border-amber-500/50 text-amber-300 font-bold"
                            : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
                        }`}
                        title={selectedToken.isEffectHidden ? "Hidden trap/effect — click to reveal to players" : "Visible to players — click to hide (DM Trap)"}
                      >
                        {selectedToken.isEffectHidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        <span>{selectedToken.isEffectHidden ? "Hidden" : "Shown"}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Rule / Save DC Notes */}
                <div className="space-y-1">
                  <span className="text-3xs font-mono uppercase text-slate-400 font-bold block">
                    Effect Rules / Save DC
                  </span>
                  <textarea
                    rows={2}
                    value={selectedToken.notes || ""}
                    onChange={(e) => handleUpdateEffectProps(selectedToken.id, { notes: e.target.value })}
                    placeholder="e.g. DC 14 CON save or 2d8 poison dmg..."
                    className="w-full bg-[#0d0f17] border border-white/10 rounded-lg px-2 py-1.5 text-[11px] font-mono text-slate-200 focus:outline-none focus:border-purple-400 resize-none"
                  />
                </div>

                <p className="text-3xs font-mono text-slate-400 italic">
                  💡 Click any square on the grid to center-move this effect zone.
                </p>
              </div>
            ) : selectedToken ? (
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
                        {selectedToken.type === "player" ? "Heroic Adventurer" : selectedToken.type === "npc" ? "NPC" : "Adversary"} • Pos ({selectedToken.x + 1}, {selectedToken.y + 1})
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

                {/* HP adjustments & Individual DM Hide/Show Toggle */}
                {selectedToken.hp && (() => {
                  const tokenHidden = isTokenHpHidden(selectedToken);
                  const canView = effectiveDmMode || !tokenHidden;
                  return (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-2xs font-mono text-slate-300 gap-2">
                        <span className="flex items-center gap-1.5">
                          <span>Vitality Pool</span>
                          {effectiveDmMode && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleTokenHpHidden(selectedToken.id);
                              }}
                              className={`px-1.5 py-0.5 rounded border text-[9px] uppercase inline-flex items-center gap-1 cursor-pointer transition-all ${
                                tokenHidden
                                  ? "bg-amber-500/20 border-amber-500/50 text-amber-300 font-bold"
                                  : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
                              }`}
                              title={tokenHidden ? "HP hidden from players — click to reveal" : "HP visible to players — click to hide"}
                            >
                              {tokenHidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                              <span>{tokenHidden ? "Hidden" : "Shown"}</span>
                            </button>
                          )}
                        </span>
                        {canView ? (
                          <span className="text-amber-400 font-bold">{selectedToken.hp.current} / {selectedToken.hp.max} HP</span>
                        ) : (
                          <span className="text-amber-400/90 font-bold flex items-center gap-1">
                            <EyeOff className="w-3 h-3" />
                            Hidden by DM
                          </span>
                        )}
                      </div>

                      {canView ? (
                        <>
                          <div className="flex items-center space-x-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTokenHpDelta(selectedToken.id, -5);
                              }}
                              className="px-2 py-0.5 bg-red-950/60 hover:bg-red-900 text-red-300 rounded font-mono text-3xs border border-red-500/30 cursor-pointer"
                            >
                              -5
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTokenHpDelta(selectedToken.id, -1);
                              }}
                              className="px-2 py-0.5 bg-red-950/60 hover:bg-red-900 text-red-300 rounded font-mono text-3xs border border-red-500/30 cursor-pointer"
                            >
                              -1
                            </button>
                            <div className="flex-1 h-2 bg-black/60 rounded-full overflow-hidden border border-white/10">
                              <div
                                style={{ width: `${Math.min(100, Math.floor((selectedToken.hp.current / selectedToken.hp.max) * 100))}%` }}
                                className={`h-full transition-all ${
                                  selectedToken.hp.current / selectedToken.hp.max > 0.5
                                    ? "bg-emerald-400"
                                    : selectedToken.hp.current / selectedToken.hp.max > 0.2
                                    ? "bg-amber-400"
                                    : "bg-red-500"
                                }`}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTokenHpDelta(selectedToken.id, 1);
                              }}
                              className="px-2 py-0.5 bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300 rounded font-mono text-3xs border border-emerald-500/30 cursor-pointer"
                            >
                              +1
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTokenHpDelta(selectedToken.id, 5);
                              }}
                              className="px-2 py-0.5 bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300 rounded font-mono text-3xs border border-emerald-500/30 cursor-pointer"
                            >
                              +5
                            </button>
                          </div>

                          {/* Exact Custom Damage / Heal Input */}
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1.5 pt-1 text-[10px] font-mono"
                          >
                            <input
                              type="number"
                              min={1}
                              max={999}
                              value={customHpAmount}
                              onChange={(e) => setCustomHpAmount(Math.max(1, parseInt(e.target.value) || 1))}
                              className="w-14 bg-[#0d0f17] border border-white/10 text-amber-300 font-bold text-center py-1 rounded focus:outline-none focus:border-amber-500"
                              title="Exact damage or heal amount"
                            />
                            <button
                              type="button"
                              onClick={() => handleTokenHpDelta(selectedToken.id, -Math.abs(customHpAmount))}
                              className="flex-1 py-1 bg-red-950/70 hover:bg-red-900 text-red-200 border border-red-500/40 rounded font-bold uppercase cursor-pointer"
                            >
                              ⚔️ Damage
                            </button>
                            <button
                              type="button"
                              onClick={() => handleTokenHpDelta(selectedToken.id, Math.abs(customHpAmount))}
                              className="flex-1 py-1 bg-emerald-950/70 hover:bg-emerald-900 text-emerald-200 border border-emerald-500/40 rounded font-bold uppercase cursor-pointer"
                            >
                              💚 Heal
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="h-2 bg-slate-800/80 rounded-full border border-white/5" />
                      )}
                    </div>
                  );
                })()}

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
                  Click a unit or environment effect on the grid to inspect or reposition it.
                </p>
              </div>
            )}

            {/* Combatants Roster Summary List with Individual DM HP Hide/Show Controls */}
            {(() => {
              const visibleCombatants = activeMap.tokens.filter(
                (t) => t.type !== "effect" && (effectiveDmMode || t.type === "player" || isCellVisibleToPlayers(t.x, t.y))
              );
              const visibleEffects = activeMap.tokens.filter(
                (t) => t.type === "effect" && (effectiveDmMode || (!t.isEffectHidden && isCellVisibleToPlayers(t.x, t.y)))
              );
              const hasTimedEffects = visibleEffects.some((e) => e.effectDuration !== undefined && e.effectDuration > 0);

              return (
                <>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-3xs font-mono uppercase text-slate-500 font-bold">
                        Combatants ({visibleCombatants.length}):
                      </span>
                      {effectiveDmMode && visibleCombatants.length > 0 && (
                        <div className="flex items-center gap-1 text-[9px] font-mono">
                          <button
                            type="button"
                            onClick={() => handleBulkSetTokenHpVisibility("hide-non-players")}
                            className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-amber-500/20 text-slate-400 hover:text-amber-300 border border-white/10 cursor-pointer"
                            title="Hide HP on all Enemy & NPC tokens"
                          >
                            Hide Foes HP
                          </button>
                          <button
                            type="button"
                            onClick={() => handleBulkSetTokenHpVisibility("show-all")}
                            className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-300 border border-white/10 cursor-pointer"
                            title="Reveal HP for all tokens on this grid"
                          >
                            Show All
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                      {visibleCombatants.length === 0 ? (
                        <p className="text-3xs text-slate-600 font-mono italic">
                          Grid clear. Deploy characters or spawn adversaries below.
                        </p>
                      ) : (
                        visibleCombatants.map((token) => {
                          const tokenHidden = isTokenHpHidden(token);
                          const canView = effectiveDmMode || !tokenHidden;
                          return (
                            <div
                              key={token.id}
                              onClick={() => setSelectedTokenId(token.id)}
                              className={`p-2 rounded-lg border text-2xs font-mono flex items-center justify-between gap-2 cursor-pointer transition-all ${
                                selectedTokenId === token.id
                                  ? "bg-amber-500/15 border-amber-500 text-amber-300 font-bold"
                                  : "bg-[#13151f] border-white/5 text-slate-300 hover:border-white/20"
                              }`}
                            >
                              <div className="flex items-center space-x-2 min-w-0 flex-1">
                                <span
                                  className={`w-2 h-2 rounded-full shrink-0 ${
                                    token.type === "player" ? "bg-amber-400" : token.type === "npc" ? "bg-cyan-400" : "bg-red-400"
                                  }`}
                                />
                                <span className="truncate">{token.name}</span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {token.hp &&
                                  (canView ? (
                                    <span className="text-[10px] text-emerald-300 font-bold">
                                      {token.hp.current}/{token.hp.max}
                                    </span>
                                  ) : (
                                    <span className="text-[9px] text-amber-400/90 flex items-center gap-0.5">
                                      <EyeOff className="w-2.5 h-2.5" />
                                      Hidden
                                    </span>
                                  ))}
                                {effectiveDmMode && token.hp && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleToggleTokenHpHidden(token.id);
                                    }}
                                    className={`p-1 rounded border cursor-pointer transition-all ${
                                      tokenHidden
                                        ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
                                        : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
                                    }`}
                                    title={tokenHidden ? "HP hidden from players — click to show" : "HP visible to players — click to hide"}
                                  >
                                    {tokenHidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Active Environment Effects & Hazards List */}
                  <div className="space-y-1.5 pt-2 border-t border-white/10">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-3xs font-mono uppercase text-purple-300 font-bold flex items-center gap-1">
                        <Flame className="w-3 h-3 text-amber-400" />
                        <span>Env Effects ({visibleEffects.length})</span>
                      </span>
                      {effectiveDmMode && hasTimedEffects && (
                        <button
                          type="button"
                          onClick={handleTickAllEffectDurations}
                          className="px-1.5 py-0.5 rounded bg-purple-950/60 hover:bg-purple-900/70 text-purple-200 border border-purple-500/30 text-[9px] font-mono cursor-pointer"
                          title="Decrement duration of all active environment effects by 1 round"
                        >
                          ⏳ Tick -1r All
                        </button>
                      )}
                    </div>

                    {visibleEffects.length === 0 ? (
                      <p className="text-[10px] font-mono text-slate-600 italic">
                        No active hazards. Pick a D&D effect pill below to cast on the grid.
                      </p>
                    ) : (
                      <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                        {visibleEffects.map((eff) => (
                          <div
                            key={eff.id}
                            onClick={() => setSelectedTokenId(eff.id)}
                            className={`p-1.5 rounded-lg border text-2xs font-mono flex items-center justify-between gap-1.5 cursor-pointer transition-all ${
                              selectedTokenId === eff.id
                                ? "bg-purple-500/20 border-purple-400 text-white font-bold"
                                : "bg-[#13151f] border-white/5 text-slate-300 hover:border-white/20"
                            }`}
                          >
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              <span className="text-xs shrink-0">{eff.effectIcon || "✨"}</span>
                              <span className="truncate">{eff.name}</span>
                              <span className="text-[9px] text-slate-400 shrink-0">
                                {((eff.areaRadius || 0) * 2 + 1) * 5}ft
                              </span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {eff.effectDuration !== undefined && (
                                <span
                                  className={`text-[9px] px-1 rounded ${
                                    eff.effectDuration === 0
                                      ? "bg-red-950 text-red-300"
                                      : "bg-black/50 text-amber-300"
                                  }`}
                                >
                                  {eff.effectDuration}r
                                </span>
                              )}
                              {effectiveDmMode && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUpdateEffectProps(eff.id, { isEffectHidden: !eff.isEffectHidden });
                                  }}
                                  className={`p-0.5 rounded border cursor-pointer ${
                                    eff.isEffectHidden
                                      ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
                                      : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
                                  }`}
                                  title={eff.isEffectHidden ? "Hidden from players — click to reveal" : "Visible to players — click to hide"}
                                >
                                  {eff.isEffectHidden ? <EyeOff className="w-2.5 h-2.5" /> : <Eye className="w-2.5 h-2.5" />}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteToken(eff.id);
                                }}
                                className="p-0.5 text-slate-500 hover:text-red-400 cursor-pointer"
                                title="Remove effect"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              );
            })()}

            {/* Compact Combat Damage & Heal Log */}
            <div className="space-y-1.5 pt-2 border-t border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-3xs font-mono uppercase text-slate-400 font-bold flex items-center gap-1">
                  <Heart className="w-3 h-3 text-red-400" />
                  Damage & Heal Log ({hpLogs.length})
                </span>
                {effectiveDmMode && onClearHpLogs && hpLogs.length > 0 && (
                  <button
                    type="button"
                    onClick={onClearHpLogs}
                    className="text-[9px] font-mono text-slate-500 hover:text-red-400 cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
              {hpLogs.length === 0 ? (
                <p className="text-[10px] font-mono text-slate-600 italic">
                  Damage & heals will be recorded here automatically.
                </p>
              ) : (
                <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                  {hpLogs.slice(0, 12).map((entry) => {
                    const isHeal = entry.delta > 0;
                    const linkedChar = entry.characterId ? characters.find((c) => c.id === entry.characterId) : undefined;
                    const tokMatch = activeMap.tokens.find((t) => t.id === entry.targetId || (entry.characterId && t.characterId === entry.characterId));
                    const isTargetHidden = !effectiveDmMode && (
                      tokMatch ? isTokenHpHidden(tokMatch) : linkedChar ? !!linkedChar.isHpHidden : entry.targetType !== "player"
                    );
                    return (
                      <div
                        key={entry.id}
                        className={`px-2 py-1 rounded border text-[10px] font-mono flex items-center justify-between gap-1 ${
                          isHeal
                            ? "bg-emerald-950/20 border-emerald-500/20 text-emerald-200"
                            : "bg-red-950/20 border-red-500/20 text-red-200"
                        }`}
                      >
                        <span className="truncate font-semibold">{entry.targetName}</span>
                        {isTargetHidden ? (
                          <span className="text-[9px] text-amber-300/90 shrink-0">
                            {isHeal ? "💚 Healed" : "⚔️ Hit"} (Hidden)
                          </span>
                        ) : (
                          <span className="shrink-0 font-bold">
                            {isHeal ? `+${entry.delta}` : entry.delta} ({entry.newHp}/{entry.maxHp})
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
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

              {/* Option C: Saved Campaign Pictures (No Re-Upload Needed) */}
              {savedImages.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-white/10">
                  <label className="block text-2xs uppercase font-mono text-emerald-400 font-bold">
                    Option 3: Saved Campaign Pictures ({savedImages.length} from Save)
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-32 overflow-y-auto pr-1">
                    {savedImages.map((img, idx) => (
                      <div
                        key={`saved-bm-${idx}`}
                        onClick={() => handleApplyImage(img.url)}
                        className="group/p relative rounded-lg overflow-hidden border border-emerald-500/30 hover:border-amber-500 cursor-pointer h-16 transition-all shadow"
                      >
                        <img src={img.url} alt={img.label} className="w-full h-full object-cover group-hover/p:scale-105 transition-transform" />
                        <div className="absolute inset-0 bg-black/50 group-hover/p:bg-black/25 transition-colors flex items-end p-1">
                          <span className="text-[8px] font-mono font-bold text-white leading-tight truncate">
                            {img.label}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Option D: Preset Fantasy Battle Maps Gallery */}
              <div className="space-y-2 pt-2 border-t border-white/10">
                <label className="block text-2xs uppercase font-mono text-slate-400 font-bold">
                  Curated Fantasy Preset Textures
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto pr-1">
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

      {/* MODAL 2: MAP SETTINGS & GRID DIMENSIONS (Up to 100x100) */}
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
                    <label className="block text-3xs uppercase text-slate-400 mb-1">Grid Columns (4 – 100)</label>
                    <input
                      type="number"
                      min={4}
                      max={100}
                      value={editCols}
                      onChange={(e) => setEditCols(Math.max(4, Math.min(100, parseInt(e.target.value) || 12)))}
                      className="w-full bg-[#161822] border border-white/10 text-amber-400 font-bold px-3 py-1.5 rounded-lg text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-3xs uppercase text-slate-400 mb-1">Grid Rows (4 – 100)</label>
                    <input
                      type="number"
                      min={4}
                      max={100}
                      value={editRows}
                      onChange={(e) => setEditRows(Math.max(4, Math.min(100, parseInt(e.target.value) || 10)))}
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
                    <label className="block text-3xs uppercase text-slate-400 mb-1">Grid Columns (4 – 100)</label>
                    <input
                      type="number"
                      min={4}
                      max={100}
                      value={newMapCols}
                      onChange={(e) => setNewMapCols(Math.max(4, Math.min(100, parseInt(e.target.value) || 14)))}
                      className="w-full bg-[#161822] border border-white/10 text-amber-400 font-bold px-3 py-1.5 rounded-lg text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-3xs uppercase text-slate-400 mb-1">Grid Rows (4 – 100)</label>
                    <input
                      type="number"
                      min={4}
                      max={100}
                      value={newMapRows}
                      onChange={(e) => setNewMapRows(Math.max(4, Math.min(100, parseInt(e.target.value) || 10)))}
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

                {effectiveDmMode && (
                  <label className="flex items-center gap-2 text-2xs font-mono text-amber-300 cursor-pointer select-none bg-[#141622] p-2.5 rounded-xl border border-amber-500/20">
                    <input
                      type="checkbox"
                      checked={customMonsterIsHpHidden}
                      onChange={(e) => setCustomMonsterIsHpHidden(e.target.checked)}
                      className="rounded bg-[#161822] border-white/20 text-amber-500 focus:ring-0"
                    />
                    <EyeOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>Hide Health Points (HP) from Players (DM Only)</span>
                  </label>
                )}

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

      {/* MODAL 5: DELETE / RESET CHAMBER CONFIRMATION (NO window.confirm) */}
      <AnimatePresence>
        {isDeleteConfirmOpen && (
          <div className="fixed inset-0 z-70 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-[#0f1117] border border-red-500/40 rounded-2xl p-5 shadow-2xl space-y-4 font-sans text-slate-200"
            >
              <div className="flex items-center space-x-2 text-red-400 border-b border-white/10 pb-2.5">
                <Trash2 className="w-5 h-5" />
                <h3 className="text-sm font-bold font-mono uppercase">
                  {interiorMaps.length <= 1 ? "Reset Chamber Map?" : "Delete Chamber Map?"}
                </h3>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {interiorMaps.length <= 1
                  ? `Reset "${activeMap.name}" back to the default template?`
                  : `Are you sure you want to permanently delete "${activeMap.name}"?`}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsDeleteConfirmOpen(false)}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-mono cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteCurrentMap}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white font-mono font-bold text-xs uppercase rounded-lg cursor-pointer"
                >
                  {interiorMaps.length <= 1 ? "Reset" : "Delete"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 6: D&D ENVIRONMENT EFFECT / SPELL AOE CREATOR */}
      <AnimatePresence>
        {isEffectModalOpen && (
          <div className="fixed inset-0 z-70 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-xl bg-[#0f1117] border border-purple-500/40 rounded-2xl p-5 shadow-2xl space-y-4 font-sans text-slate-200 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center space-x-2">
                  <Flame className="w-5 h-5 text-amber-400" />
                  <h3 className="text-sm font-bold font-serif italic text-white">
                    Create D&amp;D Environment Effect / Spell AoE
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEffectModalOpen(false)}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Curated D&D Hazard / Spell Presets */}
              <div>
                <label className="block text-3xs font-mono uppercase text-slate-400 mb-1.5">
                  Choose a D&amp;D Hazard or Spell Preset:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {ENVIRONMENT_EFFECT_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => {
                        setCustomEffectName(preset.name);
                        setCustomEffectType(preset.effectType);
                        setCustomEffectIcon(preset.effectIcon);
                        setCustomEffectColor(preset.color);
                        setCustomEffectRadius(preset.areaRadius);
                        setCustomEffectDuration(preset.effectDuration !== undefined ? String(preset.effectDuration) : "");
                        setCustomEffectNotes(preset.notes || "");
                      }}
                      className={`p-2 rounded-lg border text-left transition-all cursor-pointer flex items-center space-x-2 ${
                        customEffectName === preset.name && customEffectType === preset.effectType
                          ? "bg-purple-500/20 border-purple-400 text-white"
                          : "bg-[#141622] hover:bg-white/5 border-white/10 text-slate-300"
                      }`}
                    >
                      <span className="text-base shrink-0">{preset.effectIcon}</span>
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold truncate">{preset.name}</p>
                        <p className="text-[9px] font-mono text-slate-400">
                          {((preset.areaRadius || 0) * 2 + 1) * 5}ft{preset.effectDuration ? ` • ${preset.effectDuration}r` : " • ∞"}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Effect Details Form */}
              <div className="space-y-3 text-xs font-mono">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-3xs uppercase text-slate-400 mb-1">Effect Name</label>
                    <input
                      type="text"
                      value={customEffectName}
                      onChange={(e) => setCustomEffectName(e.target.value)}
                      placeholder="e.g. Cloudkill, Wall of Fire..."
                      className="w-full bg-[#141622] border border-white/10 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-purple-400"
                    />
                  </div>
                  <div>
                    <label className="block text-3xs uppercase text-slate-400 mb-1">Duration (Rounds)</label>
                    <input
                      type="number"
                      min={0}
                      max={999}
                      value={customEffectDuration}
                      onChange={(e) => setCustomEffectDuration(e.target.value)}
                      placeholder="∞ if empty"
                      className="w-full bg-[#141622] border border-white/10 rounded-lg px-3 py-2 text-amber-300 focus:outline-none focus:border-purple-400"
                    />
                  </div>
                </div>

                {/* Icon Picker & Area Size */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-3xs uppercase text-slate-400 mb-1">Emblem Icon</label>
                    <div className="flex flex-wrap gap-1">
                      {["☠️", "🔥", "💤", "🕸️", "🌑", "🌫️", "❄️", "🧪", "⚡", "✨", "🔇", "🩸"].map((icon) => (
                        <button
                          key={icon}
                          type="button"
                          onClick={() => setCustomEffectIcon(icon)}
                          className={`w-7 h-7 rounded-lg border flex items-center justify-center text-sm cursor-pointer transition-all ${
                            customEffectIcon === icon
                              ? "bg-amber-500/25 border-amber-400 scale-105"
                              : "bg-[#141622] border-white/10 hover:border-white/30"
                          }`}
                        >
                          {icon}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-3xs uppercase text-slate-400 mb-1">Area Footprint</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { r: 0, label: "5ft (1×1)" },
                        { r: 1, label: "15ft (3×3)" },
                        { r: 2, label: "25ft (5×5)" },
                        { r: 3, label: "35ft (7×7)" }
                      ].map((sz) => (
                        <button
                          key={sz.r}
                          type="button"
                          onClick={() => setCustomEffectRadius(sz.r)}
                          className={`py-1.5 rounded-lg border text-[11px] font-bold cursor-pointer transition-all ${
                            customEffectRadius === sz.r
                              ? "bg-amber-500 text-black border-amber-300"
                              : "bg-[#141622] text-slate-300 border-white/10 hover:border-white/30"
                          }`}
                        >
                          {sz.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Aura Tint */}
                <div>
                  <label className="block text-3xs uppercase text-slate-400 mb-1">Zone Tint Color</label>
                  <div className="flex items-center space-x-2">
                    {[
                      "#22c55e",
                      "#f97316",
                      "#a855f7",
                      "#cbd5e1",
                      "#6366f1",
                      "#38bdf8",
                      "#84cc16",
                      "#eab308",
                      "#10b981",
                      "#ec4899"
                    ].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCustomEffectColor(c)}
                        style={{ backgroundColor: c }}
                        className={`w-6 h-6 rounded-full cursor-pointer transition-transform ${
                          customEffectColor === c ? "ring-2 ring-white scale-110" : "opacity-75 hover:opacity-100"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Rule / Save Note */}
                <div>
                  <label className="block text-3xs uppercase text-slate-400 mb-1">Rule / Save DC Notes</label>
                  <textarea
                    rows={2}
                    value={customEffectNotes}
                    onChange={(e) => setCustomEffectNotes(e.target.value)}
                    placeholder="e.g. DC 15 CON save or take 3d8 poison damage..."
                    className="w-full bg-[#141622] border border-white/10 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-purple-400 resize-none"
                  />
                </div>

                {effectiveDmMode && (
                  <label className="flex items-center gap-2 text-2xs font-mono text-amber-300 cursor-pointer select-none bg-[#141622] p-2.5 rounded-xl border border-amber-500/20">
                    <input
                      type="checkbox"
                      checked={customEffectIsHidden}
                      onChange={(e) => setCustomEffectIsHidden(e.target.checked)}
                      className="rounded bg-[#161822] border-white/20 text-amber-500 focus:ring-0"
                    />
                    <EyeOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>Hide Hazard from Players until triggered (DM Trap Only)</span>
                  </label>
                )}

                <div className="flex flex-wrap gap-2 pt-2 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => {
                      if (!customEffectName.trim()) return;
                      const parsedDur = customEffectDuration.trim() ? Math.max(0, parseInt(customEffectDuration, 10) || 0) : undefined;
                      setSelectedHeroToPlace(null);
                      setSelectedTokenId(null);
                      setSelectedEffectToPlace({
                        name: customEffectName.trim(),
                        effectType: customEffectType,
                        effectIcon: customEffectIcon,
                        color: customEffectColor,
                        areaRadius: customEffectRadius,
                        effectDuration: parsedDur,
                        notes: customEffectNotes.trim() || undefined,
                        isEffectHidden: effectiveDmMode ? customEffectIsHidden : false
                      });
                      setActiveTool("place-effect");
                      setIsEffectModalOpen(false);
                    }}
                    className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold uppercase rounded-lg transition-colors cursor-pointer flex items-center justify-center space-x-1.5 shadow-lg"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Click Grid to Place</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!customEffectName.trim()) return;
                      const parsedDur = customEffectDuration.trim() ? Math.max(0, parseInt(customEffectDuration, 10) || 0) : undefined;
                      const draft: EnvironmentEffectDraft = {
                        name: customEffectName.trim(),
                        effectType: customEffectType,
                        effectIcon: customEffectIcon,
                        color: customEffectColor,
                        areaRadius: customEffectRadius,
                        effectDuration: parsedDur,
                        notes: customEffectNotes.trim() || undefined,
                        isEffectHidden: effectiveDmMode ? customEffectIsHidden : false
                      };
                      setIsEffectModalOpen(false);
                      handleSpawnEffectAtCenter(draft);
                    }}
                    className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/35 text-amber-300 border border-amber-500/40 font-bold uppercase rounded-lg transition-colors cursor-pointer"
                  >
                    Spawn Center
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEffectModalOpen(false)}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-400 rounded-lg transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
