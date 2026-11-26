import React, { useState, useEffect, useRef } from "react";
import { 
  CampaignState, 
  Character, 
  JournalNote, 
  DiceRollResult, 
  LocationType, 
  InitiativeCombatant, 
  SiteBattleMap, 
  CampaignLocation,
  FogOfWarState,
  LiveViewState,
  CombatHpLogEntry
} from "./types";
import { 
  BookOpen, 
  Compass, 
  Dices, 
  Plus, 
  Minus,
  Trash2, 
  RefreshCw, 
  Scroll, 
  Heart, 
  UserPlus, 
  Edit2,
  Swords, 
  LayoutGrid, 
  Laptop,
  Save,
  FileJson,
  Check,
  X,
  Upload,
  Image as ImageIcon,
  Shield,
  Clock,
  Sun,
  Eye,
  EyeOff,
  PanelLeftClose,
  PanelLeftOpen,
  PanelTopClose,
  PanelTopOpen
} from "lucide-react";
import MapInterface from "./components/MapInterface";
import DiceRoller from "./components/DiceRoller";
import InitiativeOrder from "./components/InitiativeOrder";
import StandaloneModal from "./components/StandaloneModal";
import { extractCampaignImages, processUploadedImage } from "./utils/imageUtils";
import { motion, AnimatePresence } from "motion/react";

const STATUS_EFFECT_PRESETS: { name: string; colorClass: string; dotClass: string }[] = [
  { name: "Poisoned", colorClass: "bg-emerald-950/90 text-emerald-300 border-emerald-500/50", dotClass: "bg-emerald-400" },
  { name: "Prone", colorClass: "bg-amber-950/90 text-amber-300 border-amber-500/50", dotClass: "bg-amber-400" },
  { name: "Stunned", colorClass: "bg-yellow-950/90 text-yellow-300 border-yellow-500/50", dotClass: "bg-yellow-400" },
  { name: "Blinded", colorClass: "bg-slate-800/95 text-slate-200 border-slate-400/50", dotClass: "bg-slate-300" },
  { name: "Charmed", colorClass: "bg-pink-950/90 text-pink-300 border-pink-500/50", dotClass: "bg-pink-400" },
  { name: "Frightened", colorClass: "bg-purple-950/90 text-purple-300 border-purple-500/50", dotClass: "bg-purple-400" },
  { name: "Grappled", colorClass: "bg-orange-950/90 text-orange-300 border-orange-500/50", dotClass: "bg-orange-400" },
  { name: "Paralyzed", colorClass: "bg-red-950/90 text-red-300 border-red-500/50", dotClass: "bg-red-400" },
  { name: "Restrained", colorClass: "bg-orange-950/80 text-amber-200 border-amber-400/50", dotClass: "bg-amber-300" },
  { name: "Incapacitated", colorClass: "bg-rose-950/90 text-rose-300 border-rose-500/50", dotClass: "bg-rose-400" },
  { name: "Invisible", colorClass: "bg-cyan-950/90 text-cyan-300 border-cyan-500/50", dotClass: "bg-cyan-400" },
  { name: "Concentrating", colorClass: "bg-blue-950/90 text-blue-300 border-blue-500/50", dotClass: "bg-blue-400" }
];

function getStatusBadgeStyle(statusName: string) {
  const found = STATUS_EFFECT_PRESETS.find(
    (s) => s.name.toLowerCase() === statusName.trim().toLowerCase()
  );
  if (found) return found;
  return {
    name: statusName,
    colorClass: "bg-indigo-950/90 text-indigo-300 border-indigo-500/50",
    dotClass: "bg-indigo-400"
  };
}

export default function App() {
  const [state, setState] = useState<CampaignState | null>(null);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>("valerius");
  const [activeTab, setActiveTab] = useState<"map" | "dice" | "journal">("map");
  const [diceSubView, setDiceSubView] = useState<"tactical" | "initiative" | "roller">("tactical");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isStandaloneModalOpen, setIsStandaloneModalOpen] = useState(false);
  const [persistenceMode, setPersistenceMode] = useState<"file" | "kv" | "tmp">("file");

  // Per-browser / per-tab DM vs Player role & Follow-DM state (isolated via sessionStorage)
  const [isDmMode, setIsDmMode] = useState<boolean>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const roleParam = params.get("role");
      if (roleParam === "player") {
        sessionStorage.setItem("dnd_browser_role", "player");
        return false;
      }
      if (roleParam === "dm") {
        sessionStorage.setItem("dnd_browser_role", "dm");
        return true;
      }
      const saved = sessionStorage.getItem("dnd_browser_role");
      if (saved === "player") return false;
      if (saved === "dm") return true;
    } catch {
      // Ignore storage access failures
    }
    return true;
  });

  const [followDm, setFollowDm] = useState<boolean>(() => {
    try {
      const saved = sessionStorage.getItem("dnd_follow_dm");
      if (saved === "false") return false;
    } catch {
      // Ignore
    }
    return true;
  });

  const handleSetIsDmMode = (nextDm: boolean) => {
    setIsDmMode(nextDm);
    try {
      sessionStorage.setItem("dnd_browser_role", nextDm ? "dm" : "player");
    } catch {
      // Ignore
    }
  };

  const handleToggleFollowDm = () => {
    setFollowDm((prev) => {
      const next = !prev;
      try {
        sessionStorage.setItem("dnd_follow_dm", next ? "true" : "false");
      } catch {
        // Ignore
      }
      return next;
    });
  };

  // Collapsible Left Party Sidebar state (per-browser via sessionStorage)
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem("dnd_left_sidebar") !== "false";
    } catch {
      return true;
    }
  });

  const handleToggleLeftSidebar = () => {
    setIsLeftSidebarOpen((prev) => {
      const next = !prev;
      try {
        sessionStorage.setItem("dnd_left_sidebar", next ? "true" : "false");
      } catch {
        // Ignore
      }
      return next;
    });
  };

  // Collapsible Top Information / Header Bars state (per-browser via sessionStorage)
  const [isTopBarOpen, setIsTopBarOpen] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem("dnd_top_bar") !== "false";
    } catch {
      return true;
    }
  });

  const handleToggleTopBar = () => {
    setIsTopBarOpen((prev) => {
      const next = !prev;
      try {
        sessionStorage.setItem("dnd_top_bar", next ? "true" : "false");
      } catch {
        // Ignore
      }
      return next;
    });
  };

  const lastVersionRef = useRef<number>(0);
  const stateRef = useRef<CampaignState | null>(null);
  stateRef.current = state;
  const pendingCharUpdatesRef = useRef<number>(0);
  const charUpdateQueueRef = useRef<Promise<void>>(Promise.resolve());

  const applyIncomingCampaign = (nextCampaign: CampaignState | null | undefined, force = false) => {
    if (!nextCampaign) return;
    if (!force && pendingCharUpdatesRef.current > 0) {
      return;
    }
    const incomingVer = typeof nextCampaign.stateVersion === "number" ? nextCampaign.stateVersion : 0;
    if (!force && incomingVer > 0 && incomingVer <= lastVersionRef.current) {
      return;
    }
    if (incomingVer > lastVersionRef.current || force) {
      lastVersionRef.current = incomingVer;
    }
    stateRef.current = nextCampaign;
    setState(nextCampaign);
    if (nextCampaign.campaignName) {
      setCampaignNameInput((prev) => prev || nextCampaign.campaignName || "");
    }
    if (nextCampaign.partyName) {
      setPartyNameInput((prev) => prev || nextCampaign.partyName || "");
    }
  };

  // Campaign & Party Metadata editing
  const [isEditingCampaignMeta, setIsEditingCampaignMeta] = useState(false);
  const [campaignNameInput, setCampaignNameInput] = useState("");
  const [partyNameInput, setPartyNameInput] = useState("");

  // Character Editor State (Easy editing of name, picture, class, race, hp, stats)
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);
  const [editCharName, setEditCharName] = useState("");
  const [editCharClass, setEditCharClass] = useState("");
  const [editCharRace, setEditCharRace] = useState("");
  const [editCharLevel, setEditCharLevel] = useState<number>(1);
  const [editCharCurrentHp, setEditCharCurrentHp] = useState<number>(10);
  const [editCharMaxHp, setEditCharMaxHp] = useState<number>(10);
  const [editCharIsHpHidden, setEditCharIsHpHidden] = useState<boolean>(false);
  const [editCharAvatarUrl, setEditCharAvatarUrl] = useState("");
  const [editCharStats, setEditCharStats] = useState({
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10
  });
  const charFileInputRef = useRef<HTMLInputElement>(null);
  const [characterToDelete, setCharacterToDelete] = useState<Character | null>(null);
  const [statusPickerCharId, setStatusPickerCharId] = useState<string | null>(null);
  const [customStatusInput, setCustomStatusInput] = useState("");

  // New Hero addition state
  const [isAddingHero, setIsAddingHero] = useState(false);
  const [heroName, setHeroName] = useState("");
  const [heroClass, setHeroClass] = useState("");
  const [heroRace, setHeroRace] = useState("");
  const [heroAvatarUrl, setHeroAvatarUrl] = useState("");
  const heroFileInputRef = useRef<HTMLInputElement>(null);

  // Journal adding state
  const [newNoteTitle, setNewNoteTitle] = useState("");
  const [newNoteContent, setNewNoteContent] = useState("");
  const [newNoteCategory, setNewNoteCategory] = useState<"quest" | "lore" | "session" | "loot">("session");
  const [noteFilter, setNoteFilter] = useState<string>("all");

  // Fetch complete campaign state
  const fetchCampaign = async (showLoader = false) => {
    if (showLoader) setIsLoading(true);
    try {
      const res = await fetch("/api/campaign");
      if (!res.ok) throw new Error("Failed to fetch campaign data");
      const data = await res.json();
      applyIncomingCampaign(data, showLoader);
      setErrorMessage(null);
    } catch (err: any) {
      console.error(err);
      setErrorMessage("Error sync. Ensure backend is running.");
    } finally {
      setIsLoading(false);
    }
  };

  // Real-time WebSocket sync on Node/local hosts, with automatic smart polling on Vercel/serverless hosts
  useEffect(() => {
    let isUnmounted = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let consecutiveWsFailures = 0;
    let hasConnectedWs = false;

    const startPolling = (ms: number) => {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = setInterval(() => {
        if (!isUnmounted && !document.hidden) {
          fetchCampaign(false);
        }
      }, ms);
    };

    const connectWs = () => {
      if (isUnmounted) return;
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws/campaign`;
      try {
        ws = new WebSocket(wsUrl);
      } catch {
        startPolling(2500);
        return;
      }

      ws.onopen = () => {
        hasConnectedWs = true;
        consecutiveWsFailures = 0;
      };

      ws.onmessage = (event) => {
        if (isUnmounted) return;
        try {
          const msg = JSON.parse(event.data);
          if ((msg?.type === "campaign:init" || msg?.type === "campaign:updated") && msg.campaign) {
            applyIncomingCampaign(msg.campaign, msg.type === "campaign:init");
            setIsLoading(false);
          }
        } catch {
          // Ignore malformed WS messages
        }
      };

      ws.onclose = () => {
        if (isUnmounted) return;
        if (!hasConnectedWs) {
          consecutiveWsFailures += 1;
          if (consecutiveWsFailures >= 2) {
            // Host does not support WebSockets (e.g., serverless); switch cleanly to fast HTTP polling
            startPolling(2500);
            return;
          }
        }
        reconnectTimer = setTimeout(connectWs, 2000);
      };

      ws.onerror = () => {
        try {
          ws?.close();
        } catch {
          // Ignore
        }
      };
    };

    fetchCampaign(true);

    (async () => {
      try {
        const res = await fetch("/api/health");
        if (res.ok) {
          const health = await res.json();
          if (isUnmounted) return;
          if (health?.persistence === "kv" || health?.persistence === "tmp" || health?.persistence === "file") {
            setPersistenceMode(health.persistence);
          }
          if (health?.websocket === false) {
            startPolling(2500);
            return;
          }
        }
      } catch {
        // Proceed with WebSocket probe fallback
      }
      if (!isUnmounted) {
        connectWs();
        startPolling(15000);
      }
    })();

    return () => {
      isUnmounted = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (pollTimer) clearInterval(pollTimer);
      try {
        ws?.close();
      } catch {
        // Ignore
      }
    };
  }, []);

  // Update Campaign & Party Names
  const handleSaveCampaignMeta = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/campaign/meta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignName: campaignNameInput.trim() || "Aethelgard",
          partyName: partyNameInput.trim() || "Campaign Party Alliance"
        })
      });
      const data = await res.json();
      if (data.success && data.campaign) {
        applyIncomingCampaign(data.campaign);
        setIsEditingCampaignMeta(false);
      }
    } catch (err) {
      console.error("Save campaign meta error:", err);
    }
  };

  // Sync Party Traveling
  const handleMoveParty = async (locationId: string) => {
    try {
      const res = await fetch("/api/campaign/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetLocationId: locationId })
      });
      const data = await res.json();
      if (data.success && data.campaign) {
        applyIncomingCampaign(data.campaign);
      }
    } catch (err) {
      console.error("Move party failure:", err);
    }
  };

  // Toggle Discovered / Dynamic Hidden logic
  const handleToggleDiscovered = async (locationId: string) => {
    try {
      const res = await fetch("/api/campaign/location/toggle-discovered", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId })
      });
      const data = await res.json();
      if (data.success && data.campaign) {
        applyIncomingCampaign(data.campaign);
      }
    } catch (err) {
      console.error("Toggle location state error:", err);
    }
  };

  // DM Tool: Create Custom Landmark/Hidden Point on Canvas
  const handleCreateLocation = async (locData: { name: string; description: string; type: LocationType; x: number; y: number; isHidden: boolean }) => {
    try {
      const res = await fetch("/api/campaign/location/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(locData)
      });
      const data = await res.json();
      if (data.success && data.campaign) {
        applyIncomingCampaign(data.campaign);
      }
    } catch (err) {
      console.error("Creation err:", err);
    }
  };

  // Save / Update Battle Maps for a Location or Building
  const handleSaveBattleMaps = async (
    locationId: string,
    interiorMaps: SiteBattleMap[],
    activeInteriorMapId: string,
    buildingId?: string
  ) => {
    try {
      const res = await fetch("/api/campaign/location/battlemap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId, buildingId, interiorMaps, activeInteriorMapId })
      });
      const data = await res.json();
      if (data.success && data.campaign) {
        applyIncomingCampaign(data.campaign);
      }
    } catch (err) {
      console.error("Save battle maps error:", err);
    }
  };

  // Atomic Tactical Battle Token HP & Visibility Update (persists & records Damage/Heal logs)
  const handleAdjustTokenHp = async (payload: {
    locationId: string;
    buildingId?: string;
    mapId: string;
    tokenId: string;
    delta?: number;
    setHp?: number;
    isHpHidden?: boolean;
  }): Promise<boolean> => {
    try {
      const res = await fetch("/api/campaign/location/battlemap/token-hp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success && data.campaign) {
        applyIncomingCampaign(data.campaign);
        return true;
      }
    } catch (err) {
      console.error("Token HP update error:", err);
    }
    return false;
  };

  // Clear recorded Damage / Heal logs
  const handleClearHpLogs = async () => {
    try {
      const res = await fetch("/api/campaign/hp-logs/clear", { method: "POST" });
      const data = await res.json();
      if (data.success && data.campaign) {
        applyIncomingCampaign(data.campaign);
      }
    } catch (err) {
      console.error("Clear HP logs error:", err);
    }
  };

  // Save / Update Fog of War on any Map Level
  const handleUpdateFog = async (payload: {
    targetType: "region" | "city" | "building" | "battlemap";
    regionId?: string;
    locationId?: string;
    buildingId?: string;
    mapId?: string;
    fogOfWar: FogOfWarState;
  }) => {
    try {
      const res = await fetch("/api/campaign/fog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success && data.campaign) {
        applyIncomingCampaign(data.campaign);
      }
    } catch (err) {
      console.error("Update fog of war error:", err);
    }
  };

  // Broadcast DM active map/room/battle view across browsers
  const handleUpdateLiveView = async (liveView: LiveViewState) => {
    try {
      const res = await fetch("/api/campaign/live-view", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(liveView)
      });
      const data = await res.json();
      if (data.success && data.campaign) {
        applyIncomingCampaign(data.campaign);
      }
    } catch (err) {
      console.error("Update live view error:", err);
    }
  };

  // Update Region / Big Map Background Image
  const handleUpdateRegionImage = async (regionId: string, imageUrl: string) => {
    try {
      const res = await fetch("/api/campaign/region/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regionId, imageUrl })
      });
      const data = await res.json();
      if (data.success && data.campaign) {
        applyIncomingCampaign(data.campaign);
      }
    } catch (err) {
      console.error("Update region image failure:", err);
    }
  };

  // Update Location (Name, Description, Type, X, Y, Danger, Image, Condition, Boss Slain, Hidden)
  const handleUpdateLocation = async (location: Partial<CampaignLocation> & { id: string }) => {
    try {
      const res = await fetch("/api/campaign/location/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location })
      });
      const data = await res.json();
      if (data.success && data.campaign) {
        applyIncomingCampaign(data.campaign);
      }
    } catch (err) {
      console.error("Update location error:", err);
    }
  };

  // Delete Location from Campaign Map
  const handleDeleteLocation = async (locationId: string) => {
    try {
      const res = await fetch("/api/campaign/location/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId })
      });
      const data = await res.json();
      if (data.success && data.campaign) {
        applyIncomingCampaign(data.campaign);
      }
    } catch (err) {
      console.error("Delete location error:", err);
    }
  };

  // Toggle Boss Slain on Location (Crimson X on Map)
  const handleToggleBossSlain = async (locationId: string) => {
    try {
      const res = await fetch("/api/campaign/location/toggle-boss-slain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId })
      });
      const data = await res.json();
      if (data.success && data.campaign) {
        applyIncomingCampaign(data.campaign);
      }
    } catch (err) {
      console.error("Toggle boss slain error:", err);
    }
  };

  // Toggle Hidden from Players (DM Eyes Only)
  const handleToggleHidden = async (locationId: string) => {
    try {
      const res = await fetch("/api/campaign/location/toggle-hidden", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId })
      });
      const data = await res.json();
      if (data.success && data.campaign) {
        applyIncomingCampaign(data.campaign);
      }
    } catch (err) {
      console.error("Toggle hidden error:", err);
    }
  };

  // Open Edit Character Modal
  const openEditCharacter = (char: Character) => {
    setEditingCharacter(char);
    setEditCharName(char.name);
    setEditCharClass(char.className);
    setEditCharRace(char.race);
    setEditCharLevel(char.level);
    setEditCharCurrentHp(char.hp.current);
    setEditCharMaxHp(char.hp.max);
    setEditCharIsHpHidden(!!char.isHpHidden);
    setEditCharAvatarUrl(char.avatarUrl || "");
    setEditCharStats(char.stats || {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10
    });
  };

  // Save Character Changes
  const handleSaveCharacterEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCharacter) return;

    const nextMaxHp = Math.max(1, Number(editCharMaxHp) || 10);
    const nextCurrentHp = Math.max(0, Math.min(nextMaxHp, Number(editCharCurrentHp) || 0));

    const updatedChar: Character = {
      ...editingCharacter,
      name: editCharName.trim() || editingCharacter.name,
      className: editCharClass.trim() || editingCharacter.className,
      race: editCharRace.trim() || editingCharacter.race,
      level: Math.max(1, Number(editCharLevel) || 1),
      hp: isDmMode || !editingCharacter.isHpHidden
        ? {
            current: nextCurrentHp,
            max: nextMaxHp
          }
        : editingCharacter.hp,
      isHpHidden: isDmMode ? editCharIsHpHidden : editingCharacter.isHpHidden,
      avatarUrl: editCharAvatarUrl,
      stats: editCharStats
    };

    try {
      const res = await fetch("/api/campaign/character", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedChar)
      });
      const data = await res.json();
      if (data.success && data.campaign) {
        applyIncomingCampaign(data.campaign);
        setEditingCharacter(null);
      }
    } catch (err) {
      console.error("Save character error:", err);
    }
  };

  // Delete Character
  const handleDeleteCharacter = async (charId: string) => {
    try {
      const res = await fetch("/api/campaign/character/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId: charId })
      });
      const data = await res.json();
      if (data.success && data.campaign) {
        applyIncomingCampaign(data.campaign);
        if (selectedCharacterId === charId && data.campaign.characters.length > 0) {
          setSelectedCharacterId(data.campaign.characters[0].id);
        }
        setEditingCharacter(null);
        setCharacterToDelete(null);
      }
    } catch (err) {
      console.error("Delete character error:", err);
    }
  };

  // Persist quick HP / visibility / status effect / exhaustion changes via serialized queue
  const persistQuickCharacterUpdate = (charId: string, updater: (latest: Character) => Character | null) => {
    const latestState = stateRef.current;
    const target = latestState?.characters.find((c) => c.id === charId);
    if (!target) return Promise.resolve();
    const updatedChar = updater(target);
    if (!updatedChar) return Promise.resolve();

    if (stateRef.current) {
      const nextLocalState: CampaignState = {
        ...stateRef.current,
        characters: stateRef.current.characters.map((c) => (c.id === charId ? updatedChar : c))
      };
      stateRef.current = nextLocalState;
      setState(nextLocalState);
    }

    pendingCharUpdatesRef.current += 1;
    const task = charUpdateQueueRef.current.then(async () => {
      try {
        const res = await fetch("/api/campaign/character", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedChar)
        });
        const data = await res.json();
        pendingCharUpdatesRef.current = Math.max(0, pendingCharUpdatesRef.current - 1);
        if (data.success && data.campaign && pendingCharUpdatesRef.current === 0) {
          applyIncomingCampaign(data.campaign);
        }
      } catch (err) {
        pendingCharUpdatesRef.current = Math.max(0, pendingCharUpdatesRef.current - 1);
        console.error("Quick character update error:", err);
      }
    });
    charUpdateQueueRef.current = task.catch(() => {});
    return task;
  };

  const handleToggleStatusEffect = async (char: Character, rawEffect: string) => {
    const clean = rawEffect.trim();
    if (!clean) return;
    await persistQuickCharacterUpdate(char.id, (latest) => {
      const current = latest.statusEffects || [];
      const exists = current.some((s) => s.toLowerCase() === clean.toLowerCase());
      const nextEffects = exists
        ? current.filter((s) => s.toLowerCase() !== clean.toLowerCase())
        : [...current, clean];
      return { ...latest, statusEffects: nextEffects };
    });
  };

  const handleAdjustExhaustion = async (char: Character, nextLevel: number) => {
    const clamped = Math.max(0, Math.min(6, nextLevel));
    await persistQuickCharacterUpdate(char.id, (latest) => {
      if (clamped === (latest.exhaustionLevel || 0)) return null;
      return { ...latest, exhaustionLevel: clamped };
    });
  };

  const handleAdjustCharacterHp = async (char: Character, delta: number) => {
    await persistQuickCharacterUpdate(char.id, (latest) => {
      if (!isDmMode && latest.isHpHidden) return null;
      const nextHp = Math.max(0, Math.min(latest.hp.max, latest.hp.current + delta));
      if (nextHp === latest.hp.current) return null;
      return { ...latest, hp: { ...latest.hp, current: nextHp } };
    });
  };

  const handleToggleCharacterHpHidden = async (char: Character) => {
    if (!isDmMode) return;
    await persistQuickCharacterUpdate(char.id, (latest) => ({
      ...latest,
      isHpHidden: !latest.isHpHidden
    }));
  };

  // Character Avatar file upload (auto-optimized for portable JSON export)
  const handleCharAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>, isNewHero = false) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await processUploadedImage(file);
      if (dataUrl) {
        if (isNewHero) {
          setHeroAvatarUrl(dataUrl);
        } else {
          setEditCharAvatarUrl(dataUrl);
        }
      }
    } catch (err) {
      console.error("Avatar upload error:", err);
    }
  };

  // Add a Custom Hero to the Table
  const handleAddHero = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!heroName || !heroClass) return;

    const randomStat = () => Math.floor(Math.random() * 8) + 10;

    const customChar: Character = {
      id: "hero_" + Date.now(),
      name: heroName.trim(),
      race: heroRace.trim() || "Human",
      className: heroClass.trim(),
      level: 1,
      hp: { current: 18, max: 18 },
      stats: {
        strength: randomStat(),
        dexterity: randomStat(),
        constitution: randomStat(),
        intelligence: randomStat(),
        wisdom: randomStat(),
        charisma: randomStat()
      },
      voice: "Zephyr",
      avatarUrl: heroAvatarUrl || "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&q=80&w=200"
    };

    try {
      const res = await fetch("/api/campaign/character", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(customChar)
      });
      const data = await res.json();
      if (data.success && data.campaign) {
        applyIncomingCampaign(data.campaign);
        setSelectedCharacterId(customChar.id);
        setHeroName("");
        setHeroClass("");
        setHeroRace("");
        setHeroAvatarUrl("");
        setIsAddingHero(false);
      }
    } catch (err) {
      console.error("Hero add error:", err);
    }
  };

  // Cloud Journal: Synchronize Note Submissions
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteTitle || !newNoteContent) return;

    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newNoteTitle,
          content: newNoteContent,
          authorCharacterId: selectedCharacterId,
          category: newNoteCategory
        })
      });
      const data = await res.json();
      if (data.success && data.campaign) {
        applyIncomingCampaign(data.campaign);
        setNewNoteTitle("");
        setNewNoteContent("");
      }
    } catch (err) {
      console.error("Note submit error:", err);
    }
  };

  const handleDeleteNote = async (id: string) => {
    try {
      const res = await fetch(`/api/notes/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success && data.campaign) {
        applyIncomingCampaign(data.campaign);
      }
    } catch (err) {
      console.error("Delete note error:", err);
    }
  };

  // Dice rolls tracker sync logic
  const handleAddRollResult = async (roll: DiceRollResult) => {
    try {
      const res = await fetch("/api/dice/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(roll)
      });
      const data = await res.json();
      if (data.success) {
        setState(prev => prev ? { ...prev, recentRolls: data.recentRolls } : null);
      }
    } catch (err) {
      console.error("Roll sync error:", err);
    }
  };

  // Sync Initiative Order combat state across devices
  const handleSaveInitiative = async (order: InitiativeCombatant[], round: number, turnIndex: number) => {
    try {
      const res = await fetch("/api/campaign/initiative", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initiativeOrder: order,
          initiativeRound: round,
          currentTurnIndex: turnIndex
        })
      });
      const data = await res.json();
      if (data.success && data.campaign) {
        applyIncomingCampaign(data.campaign);
      }
    } catch (err) {
      console.warn("Initiative save failure:", err);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0c0e12] flex flex-col items-center justify-center p-6 text-center">
        <div className="space-y-4">
          <RefreshCw className="w-12 h-12 text-amber-500 animate-spin mx-auto" />
          <h2 className="text-2xl font-serif italic text-white tracking-widest uppercase">Consulting Lore Grimoire</h2>
          <p className="text-xs font-mono text-slate-500 max-w-xs leading-relaxed">
            Constructing nested multi-level maps, party rosters, and tabletop chambers...
          </p>
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="min-h-screen bg-[#0c0e12] flex flex-col items-center justify-center p-6 text-center">
        <p className="text-red-400 font-mono mb-2">CRITICAL DEVICE OFFLINE ERROR</p>
        <p className="text-xs text-slate-400">Unable to establish connection to Campaign Server API.</p>
        <button 
          onClick={() => fetchCampaign(true)}
          className="mt-4 px-4 py-2 bg-amber-600 text-white rounded text-xs uppercase cursor-pointer"
        >
          Retry Connection Setup
        </button>
      </div>
    );
  }

  const activeRegion = state.regions.find(r => r.id === state.currentRegionId) || state.regions[0];
  const activeChar = state.characters.find(c => c.id === selectedCharacterId) || state.characters[0];
  const campaignTitle = state.campaignName || "Aethelgard";
  const partyAllianceName = state.partyName || "Campaign Party Alliance";

  const filteredNotes = noteFilter === "all" 
    ? state.notes 
    : state.notes.filter(n => n.category === noteFilter);

  const isLogTargetHpHidden = (entry: CombatHpLogEntry): boolean => {
    if (isDmMode) return false;
    if (entry.characterId) {
      const char = state.characters.find((c) => c.id === entry.characterId);
      if (char) return !!char.isHpHidden;
    }
    const initMatch = state.initiativeOrder?.find((c) => c.id === entry.targetId);
    if (initMatch && initMatch.isHpHidden !== undefined) {
      return !!initMatch.isHpHidden;
    }
    for (const loc of state.locations) {
      for (const m of loc.interiorMaps || []) {
        const tok = m.tokens?.find((t) => t.id === entry.targetId);
        if (tok && tok.isHpHidden !== undefined) return !!tok.isHpHidden;
      }
      for (const bld of loc.cityBuildings || []) {
        for (const m of bld.interiorMaps || []) {
          const tok = m.tokens?.find((t) => t.id === entry.targetId);
          if (tok && tok.isHpHidden !== undefined) return !!tok.isHpHidden;
        }
      }
    }
    return entry.targetType !== "player";
  };

  const renderHpLogsCard = () => {
    const logs = state.hpLogs || [];
    return (
      <div className="bg-[#0f1117] border border-white/10 rounded-xl p-4 space-y-3 shadow-lg">
        <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
          <div className="flex items-center gap-2">
            <Heart className="w-4 h-4 text-red-400" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-200 font-mono">
              Damage & Heal Log
            </h3>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-slate-400 border border-white/5">
              {logs.length}
            </span>
          </div>
          {isDmMode && logs.length > 0 && (
            <button
              type="button"
              onClick={handleClearHpLogs}
              className="text-[10px] font-mono text-slate-400 hover:text-red-400 cursor-pointer"
              title="Clear recorded combat HP history"
            >
              Clear Log
            </button>
          )}
        </div>

        {logs.length === 0 ? (
          <p className="text-[11px] font-mono text-slate-500 italic py-4 text-center">
            No damage or healing recorded yet. Every HP change across Battle Maps, Initiative, and Party Roster is logged here automatically.
          </p>
        ) : (
          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
            {logs.slice(0, 30).map((entry) => {
              const isHeal = entry.delta > 0;
              const hideNums = isLogTargetHpHidden(entry);
              return (
                <div
                  key={entry.id}
                  className={`px-2.5 py-2 rounded-lg border text-[11px] font-mono flex items-center justify-between gap-2 ${
                    isHeal
                      ? "bg-emerald-950/20 border-emerald-500/20"
                      : "bg-red-950/20 border-red-500/20"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-slate-100 truncate">{entry.targetName}</span>
                      <span className="text-[9px] px-1 py-0.2 rounded bg-black/40 text-slate-400 border border-white/5 uppercase">
                        {entry.targetType === "player" ? "Hero" : entry.targetType === "npc" ? "NPC" : "Enemy"}
                      </span>
                      {entry.context && (
                        <span className="text-[9px] text-slate-500 truncate">• {entry.context}</span>
                      )}
                    </div>
                    <div className="text-[10px] mt-0.5">
                      {hideNums ? (
                        <span className={isHeal ? "text-emerald-300/80" : "text-red-300/80"}>
                          {isHeal ? "💚 Healed" : "⚔️ Damaged"} — 🔒 HP Hidden by DM
                        </span>
                      ) : (
                        <span className={isHeal ? "text-emerald-300 font-bold" : "text-red-300 font-bold"}>
                          {isHeal ? `💚 +${entry.delta} Heal` : `⚔️ ${entry.delta} Damage`}{" "}
                          <span className="text-slate-400 font-normal">
                            ({entry.previousHp} → {entry.newHp} / {entry.maxHp} HP)
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-[9px] text-slate-500 shrink-0">
                    {new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-[100dvh] max-h-[100dvh] bg-[#0c0e12] text-[#d1d5db] font-sans flex flex-col overflow-hidden selection:bg-amber-500 selection:text-black">
      
      {/* HEADER BANNER - EDITABLE CAMPAIGN NAME & NAVIGATION (COLLAPSIBLE) */}
      {isTopBarOpen ? (
      <header className="h-16 sm:h-18 shrink-0 border-b border-white/10 bg-[#0f1117] flex items-center justify-between px-4 sm:px-6 lg:px-8 shadow-md">
        <div className="flex items-center gap-3 sm:gap-6 min-w-0">
          {/* Editable Campaign Title */}
          <div className="flex flex-col min-w-0">
            <div className="flex items-center space-x-1.5 group cursor-pointer" onClick={() => setIsEditingCampaignMeta(true)}>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-serif italic text-amber-500 tracking-tighter leading-none truncate hover:text-amber-400 transition-colors">
                {campaignTitle}
              </h1>
              <Edit2 className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-400 transition-colors shrink-0" title="Click to rename campaign and party" />
            </div>
            <span className="text-[9px] uppercase tracking-widest text-slate-400 font-mono mt-0.5 truncate">
              {partyAllianceName}
            </span>
          </div>

          <div className="h-8 w-px bg-white/10 hidden md:block"></div>
          
          <div className="hidden md:flex flex-col">
            <span className="text-[9px] uppercase tracking-widest text-amber-500/60 font-mono font-bold">Active Territory</span>
            <span className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              {activeRegion.name}
            </span>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center space-x-2">
          <div className="bg-[#151722] p-1 rounded-lg border border-white/5 flex space-x-1">
            <button
              onClick={() => setActiveTab("map")}
              className={`px-3 py-1.5 rounded text-xs uppercase tracking-wider font-mono transition-all cursor-pointer ${
                activeTab === "map" ? "bg-amber-500 text-black font-semibold" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Interactive Map
            </button>
            <button
              onClick={() => setActiveTab("dice")}
              className={`px-3 py-1.5 rounded text-xs uppercase tracking-wider font-mono transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "dice" ? "bg-amber-500 text-black font-semibold" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Dices className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Dice & Initiative</span>
            </button>
            <button
              onClick={() => setActiveTab("journal")}
              className={`px-3 py-1.5 rounded text-xs uppercase tracking-wider font-mono transition-all cursor-pointer ${
                activeTab === "journal" ? "bg-amber-500 text-black font-semibold" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Live Journal
            </button>
          </div>

          <div className="flex items-center gap-1.5 ml-2 sm:ml-4">
            {/* Top Information Collapse Toggle */}
            <button
              type="button"
              onClick={handleToggleTopBar}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/10 bg-[#151722] text-slate-300 hover:text-white hover:border-amber-500/40 text-xs font-mono transition-all cursor-pointer"
              title="Collapse Top Information & Toolbars to maximize map height"
            >
              <PanelTopClose className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden xl:inline">Hide Top</span>
            </button>

            {/* Left Party Sidebar Toggle */}
            <button
              type="button"
              onClick={handleToggleLeftSidebar}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-mono transition-all cursor-pointer ${
                isLeftSidebarOpen
                  ? "bg-[#151722] border-white/10 text-slate-300 hover:text-white hover:border-amber-500/40"
                  : "bg-amber-500/15 border-amber-500/50 text-amber-300 font-bold"
              }`}
              title={isLeftSidebarOpen ? "Collapse Left Party Panel to widen map" : "Open Left Party Panel"}
            >
              {isLeftSidebarOpen ? (
                <PanelLeftClose className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <PanelLeftOpen className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span className="hidden xl:inline">{isLeftSidebarOpen ? "Hide Party" : "Show Party"}</span>
            </button>

            {/* Per-Browser DM / Player Role Switcher */}
            <div className="hidden sm:flex items-center bg-[#151722] p-0.5 rounded-lg border border-white/10 text-[10px] font-mono">
              <button
                type="button"
                onClick={() => handleSetIsDmMode(true)}
                className={`px-2 py-1 rounded transition-all cursor-pointer ${
                  isDmMode
                    ? "bg-amber-500 text-black font-bold"
                    : "text-slate-400 hover:text-white"
                }`}
                title="Use this browser as Dungeon Master (controls Fog of War and broadcasts active map)"
              >
                🎭 DM
              </button>
              <button
                type="button"
                onClick={() => handleSetIsDmMode(false)}
                className={`px-2 py-1 rounded transition-all cursor-pointer ${
                  !isDmMode
                    ? "bg-blue-600 text-white font-bold"
                    : "text-slate-400 hover:text-white"
                }`}
                title="Use this browser as Player View (receives live Fog, Map, Room & Token updates)"
              >
                🛡️ Player
              </button>
            </div>

            <button
              onClick={() => setIsStandaloneModalOpen(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500/15 to-amber-600/10 hover:from-amber-500/25 hover:to-amber-600/20 border border-amber-500/40 hover:border-amber-400 text-amber-300 rounded-lg text-xs font-mono transition-all cursor-pointer shadow-sm"
              title="Export or Import Campaign Save Files (.json)"
            >
              <Save className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline font-bold">Save / Load (.json)</span>
              <span className="sm:hidden font-bold">Save</span>
            </button>
          </div>
        </div>
      </header>
      ) : activeTab !== "map" ? (
        <div className="shrink-0 bg-[#0f1117] border-b border-white/10 px-4 py-1.5 flex items-center justify-between text-xs font-mono">
          <span className="text-amber-400 font-serif italic font-bold">{campaignTitle}</span>
          <button
            type="button"
            onClick={handleToggleTopBar}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-amber-500/40 bg-amber-500/15 text-amber-300 font-bold cursor-pointer"
          >
            <PanelTopOpen className="w-3.5 h-3.5" />
            <span>Show Top Bar</span>
          </button>
        </div>
      ) : null}

      {/* CORE WORKSPACE PANELS */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
        
        {/* LEFT WORKSPACE SIDEBAR - THE D&D PARTY ROSTER (COLLAPSIBLE) */}
        <aside
          className={`w-full md:w-72 lg:w-80 shrink-0 max-h-[30vh] md:max-h-full border-b md:border-b-0 md:border-r border-white/5 bg-[#0f1117] flex-col min-h-0 overflow-hidden ${
            isLeftSidebarOpen ? "flex" : "hidden"
          }`}
        >
          
          {/* Party list heading with Party Name editing */}
          <div className="p-3 sm:p-4 border-b border-white/5 bg-black/10 flex items-center justify-between shrink-0 gap-2">
            <div className="flex items-center space-x-1.5 group cursor-pointer min-w-0" onClick={() => setIsEditingCampaignMeta(true)}>
              <h2 className="text-[11px] uppercase tracking-widest text-amber-500 font-bold font-mono truncate max-w-[155px]">
                {partyAllianceName}
              </h2>
              <Edit2 className="w-3 h-3 text-slate-500 group-hover:text-amber-400 transition-colors shrink-0" />
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setIsAddingHero(!isAddingHero)}
                className="text-[10px] uppercase font-mono text-slate-400 hover:text-amber-500 flex items-center gap-1 border border-white/10 px-2.5 py-1 rounded-lg transition-all cursor-pointer bg-white/5"
              >
                <UserPlus className="w-3 h-3 text-amber-400" />
                <span>Add Hero</span>
              </button>
              <button
                type="button"
                onClick={handleToggleLeftSidebar}
                className="p-1.5 text-slate-400 hover:text-amber-400 border border-white/10 rounded-lg bg-white/5 hover:bg-white/10 transition-all cursor-pointer"
                title="Collapse Left Party Panel"
              >
                <PanelLeftClose className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Hero addition tray */}
          <AnimatePresence>
            {isAddingHero && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden bg-[#13151f] border-b border-white/5 p-4 space-y-3 font-mono text-xs"
              >
                <div className="text-[10px] text-amber-500 font-bold uppercase tracking-wider flex items-center justify-between">
                  <span>Recruit Quest Adventurer</span>
                  <button onClick={() => setIsAddingHero(false)} className="text-slate-400 hover:text-white">✕</button>
                </div>

                <form onSubmit={handleAddHero} className="space-y-2.5">
                  <input
                    type="text"
                    required
                    placeholder="Hero Name (e.g., Kaelen Shadowthorn)"
                    value={heroName}
                    onChange={(e) => setHeroName(e.target.value)}
                    className="w-full bg-[#1c1e29] border border-white/10 text-slate-200 p-2 rounded text-xs focus:outline-none focus:border-amber-500"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      required
                      placeholder="Class (e.g. Rogue)"
                      value={heroClass}
                      onChange={(e) => setHeroClass(e.target.value)}
                      className="bg-[#1c1e29] border border-white/10 text-slate-200 p-2 rounded text-xs focus:outline-none focus:border-amber-500"
                    />
                    <input
                      type="text"
                      placeholder="Race (e.g. Elf)"
                      value={heroRace}
                      onChange={(e) => setHeroRace(e.target.value)}
                      className="bg-[#1c1e29] border border-white/10 text-slate-200 p-2 rounded text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  {/* Hero Portrait Picture Upload */}
                  <div>
                    <label className="block text-[9px] uppercase font-mono text-slate-400 mb-1">
                      Hero Portrait Picture
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        placeholder="Image URL https://..."
                        value={heroAvatarUrl}
                        onChange={(e) => setHeroAvatarUrl(e.target.value)}
                        className="flex-1 bg-[#1c1e29] border border-white/10 text-slate-200 px-2 py-1.5 rounded text-xs font-mono"
                      />
                      <input
                        type="file"
                        ref={heroFileInputRef}
                        accept="image/*"
                        onChange={(e) => handleCharAvatarUpload(e, true)}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => heroFileInputRef.current?.click()}
                        className="px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-3xs font-mono text-slate-300 cursor-pointer flex items-center gap-1"
                      >
                        <Upload className="w-3 h-3 text-amber-400" />
                        <span>Upload</span>
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold uppercase text-[10px] tracking-wider transition-all rounded cursor-pointer"
                  >
                    Deploy Hero to Party
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Character Profiles list with easy Modification buttons */}
          <div className="p-3 sm:p-4 space-y-3 flex-1 min-h-0 overflow-y-auto">
            {state.characters.map((char) => {
              const isSelected = char.id === selectedCharacterId;
              const hpPercent = Math.min(100, Math.floor((char.hp.current / char.hp.max) * 100));

              return (
                <div
                  key={char.id}
                  onClick={() => setSelectedCharacterId(char.id)}
                  className={`relative p-3.5 rounded-xl border transition-all cursor-pointer group ${
                    isSelected
                      ? "bg-[#14161f] border-amber-500/40 shadow-lg"
                      : "bg-[#10121a]/85 border-white/5 hover:border-white/15"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-1.5">
                        <span className="font-serif text-lg italic text-white tracking-tight truncate">{char.name}</span>
                        {char.id === "dm" && (
                          <span className="bg-red-950/80 text-red-400 border border-red-500/30 text-[8px] uppercase font-mono px-1 rounded">DM</span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 font-mono italic truncate">
                        Lvl {char.level} — {char.race} {char.className}
                      </p>
                    </div>

                    {/* Avatar Portrait with Quick Edit Pencil */}
                    <div className="relative shrink-0">
                      <div className="w-10 h-10 rounded-full overflow-hidden border border-white/20 bg-[#1e2029] flex items-center justify-center font-serif text-sm text-amber-500 font-bold shadow">
                        {char.avatarUrl ? (
                          <img src={char.avatarUrl} alt={char.name} className="object-cover w-full h-full" />
                        ) : (
                          char.name[0]
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Character health bars, DM HP privacy toggle, quick damage/heal, status effects & exhaustion */}
                  {char.id !== "dm" && (() => {
                    const canViewHp = isDmMode || !char.isHpHidden;
                    return (
                      <div className="mt-2.5 space-y-2">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[9px] font-mono text-slate-400 gap-1">
                            <span className="flex items-center gap-1">
                              <Heart className="w-3 h-3 text-red-400" />
                              Vitality
                              {isDmMode && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleCharacterHpHidden(char);
                                  }}
                                  className={`ml-1 px-1.5 py-0.5 rounded border text-[8px] uppercase inline-flex items-center gap-0.5 transition-all cursor-pointer ${
                                    char.isHpHidden
                                      ? "bg-amber-500/20 border-amber-500/50 text-amber-300 font-bold"
                                      : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
                                  }`}
                                  title={char.isHpHidden ? "HP hidden from players — click to reveal" : "HP visible to players — click to hide"}
                                >
                                  {char.isHpHidden ? <EyeOff className="w-2.5 h-2.5" /> : <Eye className="w-2.5 h-2.5" />}
                                  <span>{char.isHpHidden ? "Hidden" : "Shown"}</span>
                                </button>
                              )}
                            </span>
                            {canViewHp ? (
                              <span className="font-bold text-slate-200">{char.hp.current} / {char.hp.max} HP</span>
                            ) : (
                              <span className="font-bold text-amber-400/80 flex items-center gap-1">
                                <EyeOff className="w-2.5 h-2.5" />
                                Hidden by DM
                              </span>
                            )}
                          </div>

                          {canViewHp ? (
                            <>
                              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full transition-all ${hpPercent > 50 ? "bg-amber-500" : hpPercent > 20 ? "bg-orange-500" : "bg-red-500"}`}
                                  style={{ width: `${hpPercent}%` }}
                                />
                              </div>
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center justify-end gap-1 pt-0.5 text-[9px] font-mono"
                              >
                                <button
                                  type="button"
                                  onClick={() => handleAdjustCharacterHp(char, -5)}
                                  className="px-1.5 py-0.5 bg-red-950/70 hover:bg-red-900 border border-red-500/30 text-red-300 rounded cursor-pointer"
                                  title="Apply 5 damage"
                                >
                                  -5
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleAdjustCharacterHp(char, -1)}
                                  className="px-1.5 py-0.5 bg-red-950/70 hover:bg-red-900 border border-red-500/30 text-red-300 rounded cursor-pointer"
                                  title="Apply 1 damage"
                                >
                                  -1
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleAdjustCharacterHp(char, 1)}
                                  className="px-1.5 py-0.5 bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-500/30 text-emerald-300 rounded cursor-pointer"
                                  title="Heal 1 HP"
                                >
                                  +1
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleAdjustCharacterHp(char, 5)}
                                  className="px-1.5 py-0.5 bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-500/30 text-emerald-300 rounded cursor-pointer"
                                  title="Heal 5 HP"
                                >
                                  +5
                                </button>
                              </div>
                            </>
                          ) : (
                            <div className="h-1.5 w-full bg-slate-800/80 rounded-full overflow-hidden border border-white/5" />
                          )}
                        </div>

                      {/* Status Effects Badges & Quick-Add Trigger */}
                      <div className="flex flex-wrap items-center gap-1 pt-0.5">
                        {(char.statusEffects || []).map((effect) => {
                          const style = getStatusBadgeStyle(effect);
                          return (
                            <button
                              key={effect}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleStatusEffect(char, effect);
                              }}
                              title={`Remove ${effect}`}
                              className={`px-1.5 py-0.5 rounded border text-[9px] font-mono font-semibold inline-flex items-center gap-1 transition-all hover:brightness-110 cursor-pointer ${style.colorClass}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dotClass}`} />
                              <span>{effect}</span>
                              <X className="w-2.5 h-2.5 opacity-70" />
                            </button>
                          );
                        })}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setStatusPickerCharId(statusPickerCharId === char.id ? null : char.id);
                            setCustomStatusInput("");
                          }}
                          className={`px-1.5 py-0.5 rounded border text-[9px] font-mono inline-flex items-center gap-0.5 transition-all cursor-pointer ${
                            statusPickerCharId === char.id
                              ? "bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold"
                              : "bg-white/5 hover:bg-white/10 text-slate-400 hover:text-amber-300 border-white/10"
                          }`}
                          title="Quick-add or toggle status effects"
                        >
                          <Plus className="w-2.5 h-2.5" />
                          <span>Status</span>
                        </button>
                      </div>

                      {/* Quick-Add Status Effects Tray */}
                      {statusPickerCharId === char.id && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="p-2 rounded-lg bg-[#0b0d13] border border-amber-500/35 space-y-2 shadow-inner"
                        >
                          <div className="flex items-center justify-between text-[9px] font-mono uppercase tracking-wider text-slate-400">
                            <span className="text-amber-400 font-bold">Quick Status Effects</span>
                            <button
                              type="button"
                              onClick={() => setStatusPickerCharId(null)}
                              className="text-slate-400 hover:text-white cursor-pointer"
                            >
                              Done
                            </button>
                          </div>

                          <div className="flex flex-wrap gap-1">
                            {STATUS_EFFECT_PRESETS.map((preset) => {
                              const isActive = (char.statusEffects || []).some(
                                (s) => s.toLowerCase() === preset.name.toLowerCase()
                              );
                              return (
                                <button
                                  key={preset.name}
                                  type="button"
                                  onClick={() => handleToggleStatusEffect(char, preset.name)}
                                  className={`px-1.5 py-0.5 rounded border text-[9px] font-mono inline-flex items-center gap-1 transition-all cursor-pointer ${
                                    isActive
                                      ? `${preset.colorClass} ring-1 ring-white/40 font-bold`
                                      : "bg-[#151824] hover:bg-[#1e2233] text-slate-300 border-white/10"
                                  }`}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${preset.dotClass}`} />
                                  <span>{preset.name}</span>
                                  {isActive && <Check className="w-2.5 h-2.5" />}
                                </button>
                              );
                            })}
                          </div>

                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              if (!customStatusInput.trim()) return;
                              handleToggleStatusEffect(char, customStatusInput.trim());
                              setCustomStatusInput("");
                            }}
                            className="flex gap-1 pt-0.5"
                          >
                            <input
                              type="text"
                              placeholder="Custom effect..."
                              value={customStatusInput}
                              onChange={(e) => setCustomStatusInput(e.target.value)}
                              className="flex-1 min-w-0 bg-[#151824] border border-white/10 text-slate-200 px-2 py-1 rounded text-[10px] font-mono focus:outline-none focus:border-amber-500"
                            />
                            <button
                              type="submit"
                              disabled={!customStatusInput.trim()}
                              className="px-2 py-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-mono font-bold text-[9px] uppercase rounded cursor-pointer"
                            >
                              Add
                            </button>
                          </form>
                        </div>
                      )}

                      {/* Adjustable Exhausted Points (0-6) */}
                      {(() => {
                        const exhaustion = Math.max(0, Math.min(6, char.exhaustionLevel || 0));
                        return (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center justify-between gap-2 bg-black/25 border border-white/5 rounded-lg px-2 py-1 text-[9px] font-mono"
                          >
                            <span
                              className={`font-semibold tracking-wide ${
                                exhaustion >= 4
                                  ? "text-red-400"
                                  : exhaustion >= 1
                                  ? "text-amber-300"
                                  : "text-slate-400"
                              }`}
                            >
                              Exhausted
                            </span>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                disabled={exhaustion <= 0}
                                onClick={() => handleAdjustExhaustion(char, exhaustion - 1)}
                                className="w-4 h-4 rounded bg-white/5 hover:bg-white/15 disabled:opacity-30 border border-white/10 flex items-center justify-center text-slate-300 cursor-pointer"
                                title="Decrease Exhausted level"
                              >
                                <Minus className="w-2.5 h-2.5" />
                              </button>

                              <div className="flex items-center gap-0.5 px-0.5" title={`Exhaustion ${exhaustion} / 6`}>
                                {[1, 2, 3, 4, 5, 6].map((lvl) => {
                                  const filled = lvl <= exhaustion;
                                  return (
                                    <button
                                      key={lvl}
                                      type="button"
                                      onClick={() => handleAdjustExhaustion(char, lvl === exhaustion ? lvl - 1 : lvl)}
                                      className={`w-2 h-2.5 rounded-[2px] border transition-colors cursor-pointer ${
                                        filled
                                          ? exhaustion >= 4
                                            ? "bg-red-500 border-red-300"
                                            : "bg-amber-500 border-amber-300"
                                          : "bg-white/5 border-white/15 hover:border-amber-400/60"
                                      }`}
                                      title={`Set Exhausted to ${lvl === exhaustion ? lvl - 1 : lvl}`}
                                    />
                                  );
                                })}
                              </div>

                              <button
                                type="button"
                                disabled={exhaustion >= 6}
                                onClick={() => handleAdjustExhaustion(char, exhaustion + 1)}
                                className="w-4 h-4 rounded bg-white/5 hover:bg-white/15 disabled:opacity-30 border border-white/10 flex items-center justify-center text-slate-300 cursor-pointer"
                                title="Increase Exhausted level"
                              >
                                <Plus className="w-2.5 h-2.5" />
                              </button>

                              <span
                                className={`ml-0.5 w-6 text-right font-bold ${
                                  exhaustion >= 4
                                    ? "text-red-400"
                                    : exhaustion >= 1
                                    ? "text-amber-300"
                                    : "text-slate-500"
                                }`}
                              >
                                {exhaustion}/6
                              </span>
                            </div>
                          </div>
                        );
                      })()}
                      </div>
                    );
                  })()}

                  {/* Easy Action Bar: Edit Character Button */}
                  <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between text-[10px]">
                    <div className="flex items-center space-x-2 text-3xs font-mono text-slate-400">
                      <span>STR {char.stats?.strength || 10}</span>
                      <span>DEX {char.stats?.dexterity || 10}</span>
                      <span>CON {char.stats?.constitution || 10}</span>
                    </div>

                    <div className="flex items-center space-x-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditCharacter(char);
                        }}
                        className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 hover:text-white border border-amber-500/30 rounded text-[9px] font-mono uppercase flex items-center gap-1 transition-all cursor-pointer"
                        title="Edit hero name, picture, class, HP and stats"
                      >
                        <Edit2 className="w-2.5 h-2.5 text-amber-400" />
                        <span>Edit</span>
                      </button>

                      {char.id !== "dm" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setCharacterToDelete(char);
                          }}
                          className="p-1 hover:bg-red-950/50 text-slate-500 hover:text-red-400 border border-white/5 hover:border-red-500/30 rounded text-[9px] transition-all cursor-pointer"
                          title={`Remove ${char.name} from party`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Party Summary */}
          <div className="px-4 py-2.5 border-t border-white/5 bg-[#12141d] text-2xs font-mono text-slate-400 flex items-center justify-between shrink-0">
            <span>Alliance: {state.characters.length} Adventurers</span>
            <button
              onClick={() => setIsEditingCampaignMeta(true)}
              className="text-amber-400 hover:underline flex items-center gap-1"
            >
              <Edit2 className="w-2.5 h-2.5" />
              Rename Party
            </button>
          </div>
        </aside>

        {/* CENTER COMPONENT - SWITCHABLE TAB TILES */}
        <main className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
          <div className={activeTab === "map" ? "flex-1 p-1.5 sm:p-2 lg:p-3 min-h-0 flex flex-col overflow-hidden" : "hidden"}>
            <MapInterface
              campaignState={state}
              isDmMode={isDmMode}
              onSetIsDmMode={handleSetIsDmMode}
              followDm={followDm}
              onToggleFollowDm={handleToggleFollowDm}
              isLeftSidebarOpen={isLeftSidebarOpen}
              onToggleLeftSidebar={handleToggleLeftSidebar}
              isTopBarOpen={isTopBarOpen}
              onToggleTopBar={handleToggleTopBar}
              onUpdateLiveView={handleUpdateLiveView}
              onMoveParty={handleMoveParty}
              onToggleDiscovered={handleToggleDiscovered}
              onCreateLocation={handleCreateLocation}
              onSaveBattleMaps={handleSaveBattleMaps}
              onAdjustTokenHp={handleAdjustTokenHp}
              hpLogs={state.hpLogs}
              onClearHpLogs={handleClearHpLogs}
              onUpdateRegionImage={handleUpdateRegionImage}
              onUpdateLocation={handleUpdateLocation}
              onDeleteLocation={handleDeleteLocation}
              onToggleBossSlain={handleToggleBossSlain}
              onToggleHidden={handleToggleHidden}
              onUpdateFog={handleUpdateFog}
            />
          </div>

          {activeTab === "dice" && (
            <div className="flex-1 p-3 sm:p-4 lg:p-6 flex flex-col space-y-4 min-h-0 overflow-y-auto">
              
              {/* Tactical View Mode Switcher */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0f1117] border border-white/10 p-3 rounded-xl shadow-lg shrink-0">
                <div className="flex items-center space-x-2">
                  <div className="bg-[#151722] p-1 rounded-lg border border-white/5 flex space-x-1 text-xs font-mono">
                    <button
                      onClick={() => setDiceSubView("tactical")}
                      className={`px-3 py-1.5 rounded transition-all cursor-pointer flex items-center space-x-1.5 ${
                        diceSubView === "tactical"
                          ? "bg-amber-500 text-black font-bold"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <LayoutGrid className="w-3.5 h-3.5" />
                      <span>Tactical Split View</span>
                    </button>
                    <button
                      onClick={() => setDiceSubView("initiative")}
                      className={`px-3 py-1.5 rounded transition-all cursor-pointer flex items-center space-x-1.5 ${
                        diceSubView === "initiative"
                          ? "bg-amber-500 text-black font-bold"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <Swords className="w-3.5 h-3.5" />
                      <span>Initiative Order</span>
                    </button>
                    <button
                      onClick={() => setDiceSubView("roller")}
                      className={`px-3 py-1.5 rounded transition-all cursor-pointer flex items-center space-x-1.5 ${
                        diceSubView === "roller"
                          ? "bg-amber-500 text-black font-bold"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <Dices className="w-3.5 h-3.5" />
                      <span>Rolling Chamber</span>
                    </button>
                  </div>
                </div>

                {/* Quick Combat Status Indicator */}
                <div className="flex items-center space-x-2 text-2xs font-mono">
                  {state.initiativeOrder && state.initiativeOrder.length > 0 ? (
                    <div className="flex items-center space-x-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 px-3 py-1 rounded-full">
                      <Swords className="w-3 h-3 text-amber-500 animate-pulse" />
                      <span>Encounter Active • Round {state.initiativeRound || 1}</span>
                    </div>
                  ) : (
                    <span className="text-slate-500 hidden sm:inline">
                      ⚔️ Ready for encounter setup
                    </span>
                  )}
                </div>
              </div>

              {/* Tactical View */}
              {diceSubView === "tactical" && (
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 min-h-0 flex-1">
                  <div className="xl:col-span-7 flex flex-col min-h-[500px]">
                    <InitiativeOrder
                      characters={state.characters}
                      selectedCharacterId={selectedCharacterId}
                      onSelectCharacter={setSelectedCharacterId}
                      onAddRollResult={handleAddRollResult}
                      savedInitiativeOrder={state.initiativeOrder}
                      savedRound={state.initiativeRound}
                      savedTurnIndex={state.currentTurnIndex}
                      onSaveInitiative={handleSaveInitiative}
                      isDmMode={isDmMode}
                    />
                  </div>

                  <div className="xl:col-span-5 flex flex-col space-y-6">
                    <div className="shrink-0">
                      <DiceRoller
                        characters={state.characters}
                        selectedCharacterId={selectedCharacterId}
                        onSelectCharacter={setSelectedCharacterId}
                        recentRolls={state.recentRolls}
                        onAddRollResult={handleAddRollResult}
                        onOpenInitiative={() => setDiceSubView("initiative")}
                      />
                    </div>
                    {renderHpLogsCard()}
                  </div>
                </div>
              )}

              {/* Full Initiative View */}
              {diceSubView === "initiative" && (
                <div className="flex-1 flex flex-col min-h-[550px]">
                  <InitiativeOrder
                    characters={state.characters}
                    selectedCharacterId={selectedCharacterId}
                    onSelectCharacter={setSelectedCharacterId}
                    onAddRollResult={handleAddRollResult}
                    savedInitiativeOrder={state.initiativeOrder}
                    savedRound={state.initiativeRound}
                    savedTurnIndex={state.currentTurnIndex}
                    onSaveInitiative={handleSaveInitiative}
                    isDmMode={isDmMode}
                  />
                </div>
              )}

              {/* Rolling Chamber View */}
              {diceSubView === "roller" && (
                <div className="flex-1">
                  <DiceRoller
                    characters={state.characters}
                    selectedCharacterId={selectedCharacterId}
                    onSelectCharacter={setSelectedCharacterId}
                    recentRolls={state.recentRolls}
                    onAddRollResult={handleAddRollResult}
                    onOpenInitiative={() => setDiceSubView("initiative")}
                  />
                </div>
              )}
            </div>
          )}

          {activeTab === "journal" && (
            <div className="flex-1 p-4 lg:p-6 flex flex-col space-y-6 min-h-0 overflow-y-auto">
              <div className="flex flex-col md:flex-row gap-6">
                
                {/* Note Writer */}
                <div className="w-full md:w-80 space-y-4 shrink-0">
                  <div className="bg-[#0f1117] border border-white/10 rounded-xl p-5 space-y-4">
                    <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-amber-500">
                      Sync Note Writer
                    </h3>

                    <form onSubmit={handleAddNote} className="space-y-3 text-xs">
                      <div>
                        <label className="block text-[10px] uppercase font-mono text-slate-400 mb-1">
                          Chronicle Header
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Map of Wave Echo Cave"
                          value={newNoteTitle}
                          onChange={(e) => setNewNoteTitle(e.target.value)}
                          className="w-full bg-[#161822] border border-white/5 p-2 rounded focus:outline-none focus:border-amber-500 font-sans text-slate-100"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] uppercase font-mono text-slate-400 mb-1">
                            Chronicle Author
                          </label>
                          <span className="block bg-[#161822] border border-white/5 p-2 rounded text-amber-400 font-bold truncate">
                            {activeChar ? activeChar.name.split(" ")[0] : "Dungeon Master"}
                          </span>
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase font-mono text-slate-400 mb-1">
                            Classification
                          </label>
                          <select
                            value={newNoteCategory}
                            onChange={(e) => setNewNoteCategory(e.target.value as any)}
                            className="bg-[#161822] border border-white/5 p-2 rounded text-slate-200 focus:outline-none focus:border-amber-500 w-full"
                          >
                            <option value="session">🕯️ Session</option>
                            <option value="quest">📜 Quests</option>
                            <option value="lore">📚 Lore Book</option>
                            <option value="loot">🪙 Gold / Loot</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase font-mono text-slate-400 mb-1">
                          Chronicle Contents
                        </label>
                        <textarea
                          rows={4}
                          required
                          placeholder="Type notes for the party to see on their devices instantly..."
                          value={newNoteContent}
                          onChange={(e) => setNewNoteContent(e.target.value)}
                          className="w-full bg-[#161822] border border-white/5 p-2 rounded focus:outline-none focus:border-amber-500 font-sans text-slate-100"
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-mono font-bold uppercase text-xs rounded transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Replicate to Devices</span>
                      </button>
                    </form>
                  </div>

                  {renderHpLogsCard()}
                </div>

                {/* Chronicle Journal List */}
                <div className="flex-1 space-y-4">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <div className="flex items-center space-x-2">
                      <BookOpen className="w-4.5 h-4.5 text-amber-500" />
                      <h3 className="text-xs font-bold uppercase tracking-widest text-[#d1d5db]">
                        Campaign Chronicle Ledger
                      </h3>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 uppercase">
                      {filteredNotes.length} logs
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredNotes.length === 0 ? (
                      <div className="md:col-span-2 text-center py-20 bg-white/2 border border-white/5 rounded-xl text-slate-500 font-mono text-xs">
                        No notes recorded yet.
                      </div>
                    ) : (
                      filteredNotes.map((note) => {
                        const author = state.characters.find(c => c.id === note.authorCharacterId);

                        return (
                          <div 
                            key={note.id}
                            className="bg-[#0f1117] border border-white/10 rounded-xl p-5 hover:border-amber-500/35 transition-all flex flex-col justify-between space-y-4 shadow"
                          >
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-4xs font-mono text-slate-500">
                                <span className="uppercase text-amber-500/80 px-1.5 py-0.5 bg-amber-500/5 rounded border border-amber-500/10">
                                  {note.category}
                                </span>
                                <span>{new Date(note.createdAt).toLocaleDateString()}</span>
                              </div>

                              <h4 className="font-serif italic text-lg text-white leading-tight font-semibold tracking-tight">
                                {note.title}
                              </h4>
                              
                              <p className="text-xs text-slate-300 font-serif leading-relaxed whitespace-pre-line block">
                                "{note.content}"
                              </p>
                            </div>

                            <div className="pt-3 border-t border-white/5 flex items-center justify-between">
                              <span className="text-3xs text-slate-500 font-mono flex items-center gap-1.5">
                                Scribe: <span className="text-slate-300 font-bold uppercase">{author ? author.name.split(" ")[0] : "DM"}</span>
                              </span>

                              <button
                                onClick={() => handleDeleteNote(note.id)}
                                className="text-slate-500 hover:text-red-400 p-1 rounded hover:bg-red-950/20 transition-all cursor-pointer"
                                title="Delete note"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}
        </main>
      </div>

      {/* FOOTER BAR */}
      <footer className="h-8 sm:h-9 border-t border-white/10 bg-[#0c0e12] px-4 sm:px-6 flex items-center justify-between text-[10px] font-mono text-slate-500 select-none shrink-0">
        <div className="flex items-center space-x-4">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-amber-500" />
            Session Time: {new Date().toLocaleTimeString()}
          </span>
          <span className="hidden md:inline">•</span>
          <span className="hidden md:flex items-center gap-1">
            <Sun className="w-3 h-3 text-yellow-500" />
            Atmosphere: Twilight in Faerûn
          </span>
        </div>
        
        <div>
          <span>D&D Interactive Campaign Companion © 2026</span>
        </div>
      </footer>

      {/* ========================================================= */}
      {/* MODAL: EDIT CAMPAIGN & PARTY NAMES */}
      {/* ========================================================= */}
      <AnimatePresence>
        {isEditingCampaignMeta && (
          <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-[#0f111a] border border-amber-500/40 rounded-2xl p-5 shadow-2xl space-y-4 font-sans text-slate-200"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center space-x-2">
                  <Edit2 className="w-5 h-5 text-amber-500" />
                  <h3 className="text-base font-serif italic text-white font-bold">
                    Edit Campaign & Party Titles
                  </h3>
                </div>
                <button
                  onClick={() => setIsEditingCampaignMeta(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveCampaignMeta} className="space-y-4">
                <div>
                  <label className="block text-2xs uppercase font-mono text-amber-400 font-bold mb-1">
                    Campaign Name
                  </label>
                  <input
                    type="text"
                    required
                    value={campaignNameInput}
                    onChange={(e) => setCampaignNameInput(e.target.value)}
                    placeholder="e.g. Aethelgard / Curse of Strahd / Lost Mine"
                    className="w-full bg-[#161824] border border-white/10 text-white p-2.5 rounded-lg text-sm focus:outline-none focus:border-amber-500 font-serif italic"
                  />
                </div>

                <div>
                  <label className="block text-2xs uppercase font-mono text-amber-400 font-bold mb-1">
                    Party Alliance Name
                  </label>
                  <input
                    type="text"
                    required
                    value={partyNameInput}
                    onChange={(e) => setPartyNameInput(e.target.value)}
                    placeholder="e.g. The Silver Hand / The Wandering Troupe"
                    className="w-full bg-[#161824] border border-white/10 text-white p-2.5 rounded-lg text-sm focus:outline-none focus:border-amber-500 font-serif italic"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setIsEditingCampaignMeta(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-mono cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black font-mono font-bold text-xs uppercase rounded-lg transition-colors cursor-pointer"
                  >
                    Save Titles
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* MODAL: EDIT CHARACTER / HERO (NAME, PICTURE, CLASS, HP, STATS) */}
      {/* ========================================================= */}
      <AnimatePresence>
        {editingCharacter && (
          <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-[#0f111a] border border-amber-500/40 rounded-2xl p-5 shadow-2xl space-y-4 font-sans text-slate-200 max-h-[92vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center space-x-2">
                  <Edit2 className="w-5 h-5 text-amber-500" />
                  <h3 className="text-base font-serif italic text-white font-bold">
                    Edit Hero Profile: {editingCharacter.name}
                  </h3>
                </div>
                <button
                  onClick={() => setEditingCharacter(null)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveCharacterEdit} className="space-y-4">
                {/* Hero Avatar & Upload */}
                <div className="flex items-center space-x-4 bg-[#141624] p-3 rounded-xl border border-white/5">
                  <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-amber-500 shrink-0 bg-black/50 shadow">
                    {editCharAvatarUrl ? (
                      <img src={editCharAvatarUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center font-serif text-xl text-amber-400 font-bold">
                        {editCharName ? editCharName[0] : "?"}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 space-y-1.5 min-w-0">
                    <label className="block text-2xs uppercase font-mono text-amber-400 font-bold">
                      Character Picture (Upload or URL)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        placeholder="Image URL https://..."
                        value={editCharAvatarUrl}
                        onChange={(e) => setEditCharAvatarUrl(e.target.value)}
                        className="flex-1 bg-[#1a1d2e] border border-white/10 text-white px-2.5 py-1 rounded text-xs font-mono"
                      />
                      <input
                        type="file"
                        ref={charFileInputRef}
                        accept="image/*"
                        onChange={(e) => handleCharAvatarUpload(e, false)}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => charFileInputRef.current?.click()}
                        className="px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 rounded text-xs font-mono flex items-center gap-1 cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Saved Campaign Pictures Reuse */}
                {(() => {
                  const imgs = extractCampaignImages(state);
                  if (imgs.length === 0) return null;
                  return (
                    <div className="space-y-1">
                      <span className="text-[9px] uppercase font-mono text-emerald-400 font-bold">
                        Saved Campaign Pictures ({imgs.length}) — Click to reuse
                      </span>
                      <div className="flex gap-1.5 overflow-x-auto pb-1">
                        {imgs.slice(0, 18).map((img, i) => (
                          <button
                            key={`char-saved-${i}`}
                            type="button"
                            onClick={() => setEditCharAvatarUrl(img.url)}
                            title={img.label}
                            className={`w-10 h-10 rounded-lg overflow-hidden border shrink-0 cursor-pointer ${
                              editCharAvatarUrl === img.url
                                ? "border-amber-400 ring-2 ring-amber-400/50"
                                : "border-white/15 hover:border-amber-400"
                            }`}
                          >
                            <img src={img.url} alt={img.label} className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Name, Class & Race */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-2xs uppercase font-mono text-slate-400 font-bold mb-1">
                      Hero Name
                    </label>
                    <input
                      type="text"
                      required
                      value={editCharName}
                      onChange={(e) => setEditCharName(e.target.value)}
                      className="w-full bg-[#161824] border border-white/10 text-white p-2 rounded-lg text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-2xs uppercase font-mono text-slate-400 font-bold mb-1">
                      Class
                    </label>
                    <input
                      type="text"
                      required
                      value={editCharClass}
                      onChange={(e) => setEditCharClass(e.target.value)}
                      className="w-full bg-[#161824] border border-white/10 text-white p-2 rounded-lg text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-2xs uppercase font-mono text-slate-400 font-bold mb-1">
                      Race
                    </label>
                    <input
                      type="text"
                      value={editCharRace}
                      onChange={(e) => setEditCharRace(e.target.value)}
                      className="w-full bg-[#161824] border border-white/10 text-white p-2 rounded-lg text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                {/* Level, HP and Quick HP adjust */}
                <div className="bg-[#141624] p-3 rounded-xl border border-white/5 space-y-2">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-2xs uppercase font-mono text-slate-400 font-bold mb-1">
                        Hero Level
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={30}
                        value={editCharLevel}
                        onChange={(e) => setEditCharLevel(parseInt(e.target.value) || 1)}
                        className="w-full bg-[#1a1d2e] border border-white/10 text-white p-1.5 rounded text-xs text-center font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-2xs uppercase font-mono text-red-400 font-bold mb-1">
                        Current HP
                      </label>
                      {!isDmMode && editingCharacter.isHpHidden ? (
                        <div className="w-full bg-[#1a1d2e] border border-amber-500/30 text-amber-400 p-1.5 rounded text-xs text-center font-mono font-bold">
                          Hidden by DM
                        </div>
                      ) : (
                        <input
                          type="number"
                          min={0}
                          max={editCharMaxHp}
                          value={editCharCurrentHp}
                          onChange={(e) => setEditCharCurrentHp(parseInt(e.target.value) || 0)}
                          className="w-full bg-[#1a1d2e] border border-red-500/40 text-red-300 p-1.5 rounded text-xs text-center font-mono font-bold"
                        />
                      )}
                    </div>

                    <div>
                      <label className="block text-2xs uppercase font-mono text-slate-400 font-bold mb-1">
                        Max HP
                      </label>
                      {!isDmMode && editingCharacter.isHpHidden ? (
                        <div className="w-full bg-[#1a1d2e] border border-white/10 text-slate-500 p-1.5 rounded text-xs text-center font-mono font-bold">
                          —
                        </div>
                      ) : (
                        <input
                          type="number"
                          min={1}
                          value={editCharMaxHp}
                          onChange={(e) => setEditCharMaxHp(parseInt(e.target.value) || 1)}
                          className="w-full bg-[#1a1d2e] border border-white/10 text-white p-1.5 rounded text-xs text-center font-mono font-bold"
                        />
                      )}
                    </div>
                  </div>

                  {/* Quick HP Adjustment Buttons */}
                  {(isDmMode || !editingCharacter.isHpHidden) && (
                    <div className="flex items-center justify-between pt-1 text-3xs font-mono">
                      <span className="text-slate-400">Quick Vitality:</span>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditCharCurrentHp(prev => Math.max(0, prev - 5))}
                          className="px-2 py-0.5 bg-red-950/80 hover:bg-red-900 border border-red-500/40 text-red-300 rounded cursor-pointer"
                        >
                          -5
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditCharCurrentHp(prev => Math.max(0, prev - 1))}
                          className="px-2 py-0.5 bg-red-950/80 hover:bg-red-900 border border-red-500/40 text-red-300 rounded cursor-pointer"
                        >
                          -1
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditCharCurrentHp(prev => Math.min(editCharMaxHp, prev + 1))}
                          className="px-2 py-0.5 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 rounded cursor-pointer"
                        >
                          +1
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditCharCurrentHp(prev => Math.min(editCharMaxHp, prev + 5))}
                          className="px-2 py-0.5 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 rounded cursor-pointer"
                        >
                          +5
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditCharCurrentHp(editCharMaxHp)}
                          className="px-2 py-0.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 rounded cursor-pointer font-bold"
                        >
                          Full
                        </button>
                      </div>
                    </div>
                  )}

                  {isDmMode && editingCharacter.id !== "dm" && (
                    <label className="flex items-center gap-2 pt-1.5 border-t border-white/5 text-[11px] font-mono text-amber-300 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={editCharIsHpHidden}
                        onChange={(e) => setEditCharIsHpHidden(e.target.checked)}
                        className="rounded bg-[#1a1d2e] border-white/20 text-amber-500 focus:ring-0"
                      />
                      <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                      <span>Hide Health Points (HP) from Players (DM Only)</span>
                    </label>
                  )}
                </div>

                {/* Ability Scores (STR, DEX, CON, INT, WIS, CHA) */}
                <div>
                  <label className="block text-2xs uppercase font-mono text-slate-400 font-bold mb-1.5">
                    Ability Scores
                  </label>
                  <div className="grid grid-cols-6 gap-2 text-center font-mono">
                    {[
                      { key: "strength", label: "STR" },
                      { key: "dexterity", label: "DEX" },
                      { key: "constitution", label: "CON" },
                      { key: "intelligence", label: "INT" },
                      { key: "wisdom", label: "WIS" },
                      { key: "charisma", label: "CHA" }
                    ].map(stat => {
                      const val = (editCharStats as any)[stat.key] || 10;
                      const mod = Math.floor((val - 10) / 2);
                      const modStr = mod >= 0 ? `+${mod}` : `${mod}`;

                      return (
                        <div key={stat.key} className="bg-[#161824] p-1.5 rounded-lg border border-white/5">
                          <span className="text-3xs text-slate-400 block font-bold">{stat.label}</span>
                          <input
                            type="number"
                            min={1}
                            max={30}
                            value={val}
                            onChange={(e) => {
                              const v = parseInt(e.target.value) || 10;
                              setEditCharStats(prev => ({ ...prev, [stat.key]: v }));
                            }}
                            className="w-full bg-transparent text-center text-white text-xs font-bold focus:outline-none"
                          />
                          <span className="text-4xs text-amber-400 block">{modStr}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-between pt-3 border-t border-white/10">
                  {editingCharacter.id !== "dm" && (
                    <button
                      type="button"
                      onClick={() => setCharacterToDelete(editingCharacter)}
                      className="px-3 py-1.5 text-red-400 hover:text-red-300 hover:bg-red-950/40 border border-red-500/30 rounded-lg text-xs font-mono flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove Hero</span>
                    </button>
                  )}

                  <div className="flex gap-2 ml-auto">
                    <button
                      type="button"
                      onClick={() => setEditingCharacter(null)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-mono cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black font-mono font-bold text-xs uppercase rounded-lg transition-colors cursor-pointer shadow-lg"
                    >
                      Save Hero
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* IN-APP CONFIRMATION MODAL: REMOVE PARTY CHARACTER */}
      {/* ========================================================= */}
      <AnimatePresence>
        {characterToDelete && (
          <div className="fixed inset-0 z-70 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-[#12141e] border border-red-500/40 rounded-2xl p-5 shadow-2xl space-y-4 font-sans text-slate-200"
            >
              <div className="flex items-center space-x-3 text-red-400 border-b border-white/10 pb-3">
                <div className="p-2 bg-red-950/60 rounded-xl border border-red-500/30">
                  <Trash2 className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
                    Remove Party Hero?
                  </h3>
                  <span className="text-3xs text-slate-400 font-mono">Party Alliance Update</span>
                </div>
              </div>

              <div className="flex items-center space-x-3 bg-black/30 p-3 rounded-xl border border-white/5">
                <div className="w-10 h-10 rounded-full overflow-hidden border border-white/20 bg-[#1e2029] shrink-0">
                  {characterToDelete.avatarUrl ? (
                    <img src={characterToDelete.avatarUrl} alt={characterToDelete.name} className="object-cover w-full h-full" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-amber-500 font-bold font-serif">
                      {characterToDelete.name[0]}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-white font-serif italic truncate">
                    {characterToDelete.name}
                  </div>
                  <div className="text-3xs text-slate-400 font-mono">
                    Lvl {characterToDelete.level} {characterToDelete.race} {characterToDelete.className}
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed font-sans">
                Are you sure you want to dismiss <strong className="text-white">{characterToDelete.name}</strong> from the party alliance?
              </p>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setCharacterToDelete(null)}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-mono transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteCharacter(characterToDelete.id)}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white font-mono font-bold text-xs uppercase tracking-wider rounded-lg transition-colors cursor-pointer shadow-lg flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove Hero</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Campaign Save Manager (.json) Modal */}
      <StandaloneModal
        isOpen={isStandaloneModalOpen}
        onClose={() => setIsStandaloneModalOpen(false)}
        campaignState={state}
        persistenceMode={persistenceMode}
        onImportCampaign={(newState) => {
          applyIncomingCampaign(newState, true);
          setCampaignNameInput(newState.campaignName || "Aethelgard");
          setPartyNameInput(newState.partyName || "Campaign Party Alliance");
          if (newState.characters && newState.characters.length > 0) {
            setSelectedCharacterId(newState.characters[0].id);
          }
        }}
      />

    </div>
  );
}
