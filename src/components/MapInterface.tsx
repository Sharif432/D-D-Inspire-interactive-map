import React, { useState, useRef, useEffect, useCallback } from "react";
import { CampaignLocation, LocationType, CampaignState, SiteBattleMap, CityBuildingPin } from "../types";
import { 
  Map, 
  MapPin, 
  EyeOff, 
  Eye, 
  Plus, 
  ShieldAlert, 
  Compass, 
  Navigation, 
  Maximize2, 
  Minimize2, 
  ZoomIn, 
  ZoomOut, 
  Search, 
  Sliders, 
  Swords, 
  Upload, 
  Image as ImageIcon, 
  RotateCcw,
  Edit2,
  Trash2,
  Skull,
  Move,
  Check,
  X,
  AlertTriangle,
  Layers,
  Sparkles,
  Smartphone,
  ChevronDown,
  ChevronUp,
  Route,
  Tag
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import SiteBattleMapModal from "./SiteBattleMapModal";

interface MapInterfaceProps {
  campaignState: CampaignState;
  onMoveParty: (locationId: string) => Promise<void>;
  onToggleDiscovered: (locationId: string) => Promise<void>;
  onCreateLocation: (location: { name: string; description: string; type: LocationType; x: number; y: number; isHidden: boolean }) => Promise<void>;
  onSaveBattleMaps?: (locationId: string, interiorMaps: SiteBattleMap[], activeInteriorMapId: string) => Promise<void>;
  onUpdateRegionImage?: (regionId: string, imageUrl: string) => Promise<void>;
  onUpdateLocation?: (location: Partial<CampaignLocation> & { id: string }) => Promise<void>;
  onDeleteLocation?: (locationId: string) => Promise<void>;
  onToggleBossSlain?: (locationId: string) => Promise<void>;
  onToggleHidden?: (locationId: string) => Promise<void>;
}

export const REGION_PRESETS = [
  {
    id: "sword_coast_default",
    name: "Classic Sword Coast & Northern Faerûn",
    url: "https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&q=80&w=1200"
  },
  {
    id: "underdark_default",
    name: "The Underdark (Bioluminescent Abyss)",
    url: "https://images.unsplash.com/photo-1507163011986-e3d1796fd042?auto=format&fit=crop&q=80&w=1200"
  },
  {
    id: "parchment_continent",
    name: "Faerûn High-Parchment World Map",
    url: "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&q=80&w=1200"
  },
  {
    id: "maritime_isles",
    name: "Sea of Swords Coastal Maritime Chart",
    url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&q=80&w=1200"
  },
  {
    id: "frostfell",
    name: "Spine of the World Frostfell Wastes",
    url: "https://images.unsplash.com/photo-1483921020237-2ff51e8e4b22?auto=format&fit=crop&q=80&w=1200"
  },
  {
    id: "desert_ruins",
    name: "Anauroch Desert & Fallen Netheril",
    url: "https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&q=80&w=1200"
  }
];

export default function MapInterface({
  campaignState,
  onMoveParty,
  onToggleDiscovered,
  onCreateLocation,
  onSaveBattleMaps,
  onUpdateRegionImage,
  onUpdateLocation,
  onDeleteLocation,
  onToggleBossSlain,
  onToggleHidden
}: MapInterfaceProps) {
  const [activeRegionId, setActiveRegionId] = useState<string>("sword_coast");
  const [selectedLocation, setSelectedLocation] = useState<CampaignLocation | null>(null);
  const [insideBattleMapLocation, setInsideBattleMapLocation] = useState<CampaignLocation | null>(null);
  const [isRegionImageModalOpen, setIsRegionImageModalOpen] = useState(false);
  const [regionUrlInput, setRegionUrlInput] = useState("");
  const regionFileInputRef = useRef<HTMLInputElement>(null);

  // DM Mode vs Player View
  const [isDmMode, setIsDmMode] = useState<boolean>(true);
  const [isDmRosterOpen, setIsDmRosterOpen] = useState(false);
  const [rosterSearch, setRosterSearch] = useState("");

  // Edit Location Modal State
  const [editingLocation, setEditingLocation] = useState<CampaignLocation | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editType, setEditType] = useState<LocationType>("cave");
  const [editDanger, setEditDanger] = useState<number>(2);
  const [editImageUrl, setEditImageUrl] = useState("");
  const [editCondition, setEditCondition] = useState<'normal' | 'cleared' | 'besieged' | 'cursed' | 'hazardous'>('normal');
  const [editBossSlain, setEditBossSlain] = useState(false);
  const [editIsHidden, setEditIsHidden] = useState(false);
  const [isDeletingConfirm, setIsDeletingConfirm] = useState(false);
  const nodeFileInputRef = useRef<HTMLInputElement>(null);

  // Reposition / Dragging Node State
  const [repositioningLocId, setRepositioningLocId] = useState<string | null>(null);

  // Create Location states
  const [isAddingLocation, setIsAddingLocation] = useState(false);
  const [newLocName, setNewLocName] = useState("");
  const [newLocDesc, setNewLocDesc] = useState("");
  const [newLocType, setNewLocType] = useState<LocationType>("cave");
  const [newLocIsHidden, setNewLocIsHidden] = useState(false);
  const [tempCoords, setTempCoords] = useState<{ x: number; y: number } | null>(null);

  // Big Map states
  const [isBigMapOpen, setIsBigMapOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showGrid, setShowGrid] = useState(true);

  // Mobile drawer state
  const [mobileTab, setMobileTab] = useState<"map" | "roster" | "details">("map");

  // Map Fit Mode (Contain = uncropped 100% visible, Cover = fill canvas)
  const [mapFitMode, setMapFitMode] = useState<"contain" | "cover">("contain");
  const [mapAspect, setMapAspect] = useState<number>(16 / 9);

  // Multi-Level Map Hierarchy Navigation: 'realm' (World) -> 'city' (Settlement) -> 'tavern' (Building)
  const [mapNavLevel, setMapNavLevel] = useState<"realm" | "city" | "tavern">("realm");
  const [currentCityLocationId, setCurrentCityLocationId] = useState<string | null>(null);
  const [currentBuildingId, setCurrentBuildingId] = useState<string | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<CityBuildingPin | null>(null);

  // City & Tavern Image Modal State
  const [isCityImageModalOpen, setIsCityImageModalOpen] = useState(false);
  const [cityImageUrlInput, setCityImageUrlInput] = useState("");
  const cityFileInputRef = useRef<HTMLInputElement>(null);

  const [isTavernImageModalOpen, setIsTavernImageModalOpen] = useState(false);
  const [tavernImageUrlInput, setTavernImageUrlInput] = useState("");
  const tavernFileInputRef = useRef<HTMLInputElement>(null);

  // Line & Town Name Visibility Toggles
  const [showLines, setShowLines] = useState<boolean>(true);
  const [showTownNames, setShowTownNames] = useState<boolean>(true);

  // Connection routes editor state (for Edit Location Modal)
  const [editConnectedTo, setEditConnectedTo] = useState<string[]>([]);

  // Inner canvas refs for sub-pixel 1:1 coordinate alignment between standard view and big map view
  const innerCanvasRef = useRef<HTMLDivElement>(null);
  const innerBigCanvasRef = useRef<HTMLDivElement>(null);

  // Adding Building Pin inside City Map
  const [isAddingBuilding, setIsAddingBuilding] = useState(false);
  const [tempBuildingCoords, setTempBuildingCoords] = useState<{ x: number; y: number } | null>(null);
  const [newBuildingName, setNewBuildingName] = useState("");
  const [newBuildingDesc, setNewBuildingDesc] = useState("");
  const [newBuildingType, setNewBuildingType] = useState<CityBuildingPin["type"]>("tavern");
  const [newBuildingImageUrl, setNewBuildingImageUrl] = useState("");
  const buildingFileInputRef = useRef<HTMLInputElement>(null);

  // Pan & Zoom states (Unified for smooth drag & touch)
  const [zoomScale, setZoomScale] = useState<number>(1.0);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDraggingMap, setIsDraggingMap] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const touchDistanceRef = useRef<number | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const bigMapContainerRef = useRef<HTMLDivElement>(null);

  const activeRegion = campaignState.regions.find((r) => r.id === activeRegionId) || campaignState.regions[0];
  const partyLocation = campaignState.locations.find((l) => l.id === campaignState.partyLocationId);

  // Filter locations for active region
  const regionLocations = campaignState.locations.filter((loc) => {
    const isUnderdark = ["underdark_passage", "gracklstagh", "sloopidoop", "hidden_shrine"].includes(loc.id) || loc.id.startsWith("underdark_");
    return activeRegionId === "underdark" ? isUnderdark : !isUnderdark;
  });

  // Filter based on Player View vs DM Mode:
  // In Player View: hide any location where isHidden is true!
  const visibleLocations = regionLocations.filter((loc) => {
    if (isDmMode) return true;
    return !loc.isHidden;
  });

  // Auto-select party location on mount / region change
  useEffect(() => {
    if (partyLocation) {
      const isPartyInUnderdark = ["underdark_passage", "gracklstagh", "sloopidoop", "hidden_shrine"].includes(partyLocation.id);
      if (isPartyInUnderdark && activeRegionId !== "underdark") {
        setActiveRegionId("underdark");
      } else if (!isPartyInUnderdark && activeRegionId !== "sword_coast") {
        setActiveRegionId("sword_coast");
      }
      setSelectedLocation(partyLocation);
    }
  }, [campaignState.partyLocationId]);

  // Active Nested City Location
  const currentCityLocation = campaignState.locations.find((l) => l.id === currentCityLocationId) || null;
  // Active Nested Building (Tavern / Inn / Hall)
  const currentBuilding = currentCityLocation?.cityBuildings?.find((b) => b.id === currentBuildingId) || null;

  // Sync selected building
  useEffect(() => {
    if (currentBuilding) {
      setSelectedBuilding(currentBuilding);
    }
  }, [currentBuildingId]);

  // Helper for Building Icons
  const getBuildingIcon = (type: CityBuildingPin["type"]) => {
    switch (type) {
      case "tavern": return "🍺";
      case "shop": return "🛒";
      case "guild": return "🛡️";
      case "temple": return "⛩️";
      case "residence": return "🏡";
      case "civic": return "🏛️";
      case "ruin": return "🏚️";
      default: return "📍";
    }
  };

  // Enter City / Settlement Map
  const handleEnterCityMap = (location: CampaignLocation) => {
    setCurrentCityLocationId(location.id);
    setMapNavLevel("city");
    setCurrentBuildingId(null);
    setSelectedBuilding(null);
    setSelectedLocation(location);
    setZoomScale(1.0);
    setPanOffset({ x: 0, y: 0 });
  };

  // Enter Tavern / Building Interior Map
  const handleEnterTavernMap = (building: CityBuildingPin) => {
    setCurrentBuildingId(building.id);
    setSelectedBuilding(building);
    setMapNavLevel("tavern");
    setZoomScale(1.0);
    setPanOffset({ x: 0, y: 0 });
  };

  // Return to Realm Map
  const handleReturnToRealm = () => {
    setMapNavLevel("realm");
    setCurrentCityLocationId(null);
    setCurrentBuildingId(null);
    setSelectedBuilding(null);
    setZoomScale(1.0);
    setPanOffset({ x: 0, y: 0 });
  };

  // Return to City Map from Tavern
  const handleReturnToCity = () => {
    setMapNavLevel("city");
    setCurrentBuildingId(null);
    setSelectedBuilding(null);
    setZoomScale(1.0);
    setPanOffset({ x: 0, y: 0 });
  };

  // Launch Battle Map directly from Tavern or Location
  const handleOpenTacticalBattleGrid = () => {
    if (mapNavLevel === "tavern" && currentBuilding && currentCityLocation) {
      const interiorMaps = currentBuilding.interiorMaps && currentBuilding.interiorMaps.length > 0 
        ? currentBuilding.interiorMaps 
        : [
            {
              id: "map_" + currentBuilding.id,
              locationId: currentCityLocation.id,
              name: currentBuilding.name + " - Tactical Floor",
              description: currentBuilding.description,
              imageUrl: currentBuilding.imageUrl || "https://images.unsplash.com/photo-1543007630-9710e4a00a20?auto=format&fit=crop&q=80&w=1200",
              gridCols: 14,
              gridRows: 10,
              showGrid: true,
              tokens: []
            }
          ];
      setInsideBattleMapLocation({
        ...currentCityLocation,
        name: `${currentCityLocation.name} - ${currentBuilding.name}`,
        interiorMaps,
        activeInteriorMapId: interiorMaps[0]?.id
      });
    } else if (selectedLocation) {
      setInsideBattleMapLocation(selectedLocation);
    }
  };

  // Handle City Map Background Image Change (file upload or URL)
  const handleApplyCityImage = async (url: string) => {
    if (!currentCityLocation || !onUpdateLocation || !url.trim()) return;
    await onUpdateLocation({
      id: currentCityLocation.id,
      cityMapImageUrl: url.trim()
    });
    setIsCityImageModalOpen(false);
    setCityImageUrlInput("");
  };

  // Handle City File Upload
  const handleCityFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        await handleApplyCityImage(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle Tavern Map Background Image Change
  const handleApplyTavernImage = async (url: string) => {
    if (!currentCityLocation || !currentBuilding || !onUpdateLocation || !url.trim()) return;
    const updatedBuildings = (currentCityLocation.cityBuildings || []).map(b => 
      b.id === currentBuilding.id ? { ...b, imageUrl: url.trim() } : b
    );
    await onUpdateLocation({
      id: currentCityLocation.id,
      cityBuildings: updatedBuildings
    });
    setIsTavernImageModalOpen(false);
    setTavernImageUrlInput("");
  };

  // Handle Tavern File Upload
  const handleTavernFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        await handleApplyTavernImage(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  // Upload custom picture for city POI building / tavern
  const handleBuildingImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setNewBuildingImageUrl(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  // Add new Building Pin on City Map
  const handleCreateBuildingSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentCityLocation || !onUpdateLocation || !tempBuildingCoords || !newBuildingName.trim()) return;
    
    const defaultImage = newBuildingType === "tavern" 
      ? "https://images.unsplash.com/photo-1543007630-9710e4a00a20?auto=format&fit=crop&q=80&w=1200"
      : newBuildingType === "shop"
      ? "https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&q=80&w=1200"
      : newBuildingType === "temple"
      ? "https://images.unsplash.com/photo-1548625361-16eb15456f48?auto=format&fit=crop&q=80&w=1200"
      : "https://images.unsplash.com/photo-1584968153986-3fbae48835a7?auto=format&fit=crop&q=80&w=1200";

    const finalImage = newBuildingImageUrl.trim() || defaultImage;

    const newBuilding: CityBuildingPin = {
      id: "bld_" + Date.now(),
      name: newBuildingName.trim(),
      description: newBuildingDesc.trim() || "A notable structure in " + currentCityLocation.name,
      type: newBuildingType,
      x: tempBuildingCoords.x,
      y: tempBuildingCoords.y,
      imageUrl: finalImage,
      interiorMaps: ["tavern", "inn", "guild", "temple", "ruin"].includes(newBuildingType) ? [
        {
          id: "map_taproom_" + Date.now(),
          locationId: currentCityLocation.id,
          name: newBuildingName.trim() + " - Interior Floor",
          description: "Tactical floor plan with bar, tables, private rooms, and fireplace.",
          imageUrl: finalImage,
          gridCols: 14,
          gridRows: 10,
          showGrid: true,
          tokens: []
        }
      ] : undefined
    };
    const updatedBuildings = [...(currentCityLocation.cityBuildings || []), newBuilding];
    await onUpdateLocation({
      id: currentCityLocation.id,
      cityBuildings: updatedBuildings
    });
    setIsAddingBuilding(false);
    setTempBuildingCoords(null);
    setNewBuildingName("");
    setNewBuildingDesc("");
    setNewBuildingImageUrl("");
    setSelectedBuilding(newBuilding);
  };

  // Toggle Building Boss Slain (Red X)
  const handleToggleBuildingBossSlain = async (buildingId: string) => {
    if (!currentCityLocation || !onUpdateLocation) return;
    const updatedBuildings = (currentCityLocation.cityBuildings || []).map(b => 
      b.id === buildingId ? { ...b, bossSlain: !b.bossSlain } : b
    );
    await onUpdateLocation({
      id: currentCityLocation.id,
      cityBuildings: updatedBuildings
    });
  };

  // Delete Building Pin
  const handleDeleteBuilding = async (buildingId: string) => {
    if (!currentCityLocation || !onUpdateLocation) return;
    const updatedBuildings = (currentCityLocation.cityBuildings || []).filter(b => b.id !== buildingId);
    await onUpdateLocation({
      id: currentCityLocation.id,
      cityBuildings: updatedBuildings
    });
    if (selectedBuilding?.id === buildingId) setSelectedBuilding(null);
  };
  useEffect(() => {
    if (selectedLocation) {
      const updated = campaignState.locations.find(l => l.id === selectedLocation.id);
      if (updated) setSelectedLocation(updated);
    }
  }, [campaignState.locations]);

  // ==========================================
  // PAN & ZOOM EVENT HANDLERS (MOUSE & TOUCH)
  // ==========================================
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
    setZoomScale((prev) => Math.min(3.5, Math.max(0.6, parseFloat((prev * zoomFactor).toFixed(2)))));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isAddingLocation || repositioningLocId) return;
    if (e.button !== 0) return; // Only left click
    setIsDraggingMap(true);
    dragStartRef.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingMap) return;
    setPanOffset({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y
    });
  };

  const handleMouseUp = () => {
    setIsDraggingMap(false);
  };

  // Touch handlers for iPhone / mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isAddingLocation || repositioningLocId) return;
    if (e.touches.length === 1) {
      setIsDraggingMap(true);
      dragStartRef.current = {
        x: e.touches[0].clientX - panOffset.x,
        y: e.touches[0].clientY - panOffset.y
      };
    } else if (e.touches.length === 2) {
      // Pinch start
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchDistanceRef.current = Math.hypot(dx, dy);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDraggingMap) {
      setPanOffset({
        x: e.touches[0].clientX - dragStartRef.current.x,
        y: e.touches[0].clientY - dragStartRef.current.y
      });
    } else if (e.touches.length === 2 && touchDistanceRef.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const newDistance = Math.hypot(dx, dy);
      const ratio = newDistance / touchDistanceRef.current;
      setZoomScale((prev) => Math.min(3.5, Math.max(0.6, parseFloat((prev * ratio).toFixed(2)))));
      touchDistanceRef.current = newDistance;
    }
  };

  const handleTouchEnd = () => {
    setIsDraggingMap(false);
    touchDistanceRef.current = null;
  };

  // Center on Party or reset
  const handleResetZoom = () => {
    setZoomScale(1.0);
    setPanOffset({ x: 0, y: 0 });
  };

  const handleCenterParty = () => {
    if (!partyLocation) {
      handleResetZoom();
      return;
    }
    // Calculate offset to bring party (x%, y%) near center
    const targetX = (50 - partyLocation.x) * 4;
    const targetY = (50 - partyLocation.y) * 4;
    setZoomScale(1.25);
    setPanOffset({ x: targetX, y: targetY });
  };

  // Handle Map Click (Adding Location, POI Building Pin, or Repositioning Pin)
  const handleMapCanvasClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    // Calculate against the exact inner transformed aspect-ratio canvas where map image & pins reside
    const targetCanvas = isBigMapOpen ? innerBigCanvasRef.current : innerCanvasRef.current;
    if (!targetCanvas) return;

    const rect = targetCanvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Discard clicks outside the active map canvas (such as in outer letterbox / pillarbox bands)
    if (clickX < 0 || clickX > rect.width || clickY < 0 || clickY > rect.height) {
      return;
    }

    const xPct = Math.max(1, Math.min(99, parseFloat(((clickX / rect.width) * 100).toFixed(1))));
    const yPct = Math.max(1, Math.min(99, parseFloat(((clickY / rect.height) * 100).toFixed(1))));

    // If repositioning an existing pin
    if (repositioningLocId) {
      if (onUpdateLocation) {
        await onUpdateLocation({ id: repositioningLocId, x: xPct, y: yPct });
      }
      setRepositioningLocId(null);
      return;
    }

    // If adding a building pin in City Map mode
    if (isAddingBuilding && mapNavLevel === "city") {
      setTempBuildingCoords({ x: xPct, y: yPct });
      return;
    }

    // If adding a new pin on Realm map
    if (isAddingLocation) {
      setTempCoords({ x: xPct, y: yPct });
    }
  };

  // Open Edit Location Modal
  const openEditModal = (loc: CampaignLocation) => {
    setEditingLocation(loc);
    setEditName(loc.name);
    setEditDesc(loc.description);
    setEditType(loc.type);
    setEditDanger(loc.dangerLevel || 2);
    setEditImageUrl(loc.imageUrl || "");
    setEditCondition(loc.condition || "normal");
    setEditBossSlain(!!loc.bossSlain);
    setEditIsHidden(!!loc.isHidden);
    setEditConnectedTo(loc.connectedTo || []);
    setIsDeletingConfirm(false);
  };

  // Save Edit Location
  const handleSaveLocationEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLocation || !onUpdateLocation) return;

    await onUpdateLocation({
      id: editingLocation.id,
      name: editName,
      description: editDesc,
      type: editType,
      dangerLevel: editDanger,
      imageUrl: editImageUrl,
      condition: editCondition,
      bossSlain: editBossSlain,
      isHidden: editIsHidden,
      connectedTo: editConnectedTo
    });

    setEditingLocation(null);
  };

  // Delete Location
  const handleDeleteLocationConfirm = async () => {
    if (!editingLocation || !onDeleteLocation) return;
    await onDeleteLocation(editingLocation.id);
    if (selectedLocation?.id === editingLocation.id) {
      setSelectedLocation(null);
    }
    setEditingLocation(null);
    setIsDeletingConfirm(false);
  };

  // Node image upload handler
  const handleNodeImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) setEditImageUrl(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  // Create Location Submit
  const handleCreateLocationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocName || !tempCoords) return;

    await onCreateLocation({
      name: newLocName,
      description: newLocDesc,
      type: newLocType,
      x: tempCoords.x,
      y: tempCoords.y,
      isHidden: newLocIsHidden
    });

    setNewLocName("");
    setNewLocDesc("");
    setNewLocIsHidden(false);
    setTempCoords(null);
    setIsAddingLocation(false);
  };

  const getLocationIcon = (type: LocationType) => {
    switch (type) {
      case "town": return "🏰";
      case "dungeon": return "💀";
      case "forest": return "🌲";
      case "ruins": return "🏚️";
      case "castle": return "🛡️";
      case "cave": return "🕳️";
      case "shrine": return "🔮";
      default: return "📍";
    }
  };

  const getConditionBadge = (condition?: string) => {
    switch (condition) {
      case "cleared":
        return <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] font-mono px-1.5 py-0.5 rounded">Liberated 🛡️</span>;
      case "besieged":
        return <span className="bg-red-500/20 text-red-400 border border-red-500/30 text-[9px] font-mono px-1.5 py-0.5 rounded animate-pulse">Besieged ⚔️</span>;
      case "cursed":
        return <span className="bg-purple-500/20 text-purple-400 border border-purple-500/30 text-[9px] font-mono px-1.5 py-0.5 rounded">Cursed ☠️</span>;
      case "hazardous":
        return <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[9px] font-mono px-1.5 py-0.5 rounded">Perilous ⚠️</span>;
      default:
        return null;
    }
  };

  const getDistanceInLeagues = (loc: CampaignLocation) => {
    if (!partyLocation) return 0;
    const dx = loc.x - partyLocation.x;
    const dy = loc.y - partyLocation.y;
    return Math.floor(Math.sqrt(dx * dx + dy * dy) * 4.3);
  };

  // Region map image customizer
  const handleApplyRegionImage = async (url: string) => {
    if (!url.trim()) return;
    if (onUpdateRegionImage) {
      await onUpdateRegionImage(activeRegion.id, url.trim());
    }
    setRegionUrlInput("");
    setIsRegionImageModalOpen(false);
  };

  const handleRegionFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        await handleApplyRegionImage(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="bg-[#0e1017] border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-full font-sans text-slate-200">
      
      {/* TOP HEADER CONTROLS (RESPONSIVE) */}
      <div className="p-3 sm:p-4 bg-[#12141e] border-b border-white/10 flex flex-wrap items-center justify-between gap-2.5">
        
        {/* Left: Territory Title & Mode Switcher */}
        <div className="flex items-center flex-wrap gap-2 sm:gap-3">
          <div className="flex items-center space-x-2">
            <Compass className="w-5 h-5 text-amber-500 animate-spin-slow shrink-0" />
            <span className="font-serif italic font-bold text-base sm:text-lg text-white">
              {activeRegion.name}
            </span>
          </div>

          {/* DM Mode vs Player View Switcher */}
          <div className="flex items-center bg-[#1a1d2c] border border-white/10 rounded-lg p-0.5 text-xs font-mono">
            <button
              onClick={() => setIsDmMode(true)}
              className={`px-2.5 py-1 rounded transition-all cursor-pointer flex items-center gap-1.5 ${
                isDmMode 
                  ? "bg-amber-500 text-black font-bold shadow" 
                  : "text-slate-400 hover:text-white"
              }`}
              title="DM Mode: View all secret nodes and manage territory"
            >
              <span>🎭 DM Mode</span>
            </button>
            <button
              onClick={() => setIsDmMode(false)}
              className={`px-2.5 py-1 rounded transition-all cursor-pointer flex items-center gap-1.5 ${
                !isDmMode 
                  ? "bg-blue-600 text-white font-bold shadow" 
                  : "text-slate-400 hover:text-white"
              }`}
              title="Player View: Hidden locations are invisible"
            >
              <span>🛡️ Player View</span>
            </button>
          </div>

          {/* DM Roster / Secret Toggle Button */}
          {isDmMode && (
            <button
              onClick={() => setIsDmRosterOpen(!isDmRosterOpen)}
              className="px-2.5 py-1 bg-purple-950/40 hover:bg-purple-900/50 border border-purple-500/30 text-purple-300 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer"
              title="Toggle Secret Locations on/off by name"
            >
              <Eye className="w-3.5 h-3.5 text-purple-400" />
              <span className="hidden sm:inline">Secret Roster ({regionLocations.filter(l => l.isHidden).length} hidden)</span>
              <span className="sm:hidden">Roster</span>
            </button>
          )}
        </div>

        {/* Right: Region Switcher, Big Map & Tools */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Region Tabs */}
          <div className="flex space-x-1 bg-[#1a1d2c] p-0.5 rounded-lg border border-white/10 text-2xs font-mono">
            {campaignState.regions.map((reg) => (
              <button
                key={reg.id}
                onClick={() => {
                  setActiveRegionId(reg.id);
                  const firstInRegion = campaignState.locations.find(l => {
                    const isUd = ["underdark_passage", "gracklstagh", "sloopidoop", "hidden_shrine"].includes(l.id);
                    return reg.id === "underdark" ? isUd : !isUd;
                  });
                  if (firstInRegion) setSelectedLocation(firstInRegion);
                }}
                className={`px-2.5 py-1 rounded transition-all cursor-pointer uppercase ${
                  activeRegionId === reg.id
                    ? "bg-amber-600 text-white font-bold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {reg.name.split(" ")[0]}
              </button>
            ))}
          </div>

          {/* Change Map Image */}
          <button
            onClick={() => setIsRegionImageModalOpen(true)}
            className="p-1.5 sm:px-2.5 sm:py-1 bg-[#1a1d2c] hover:bg-[#23273a] text-slate-300 hover:text-white border border-white/10 rounded-lg text-2xs font-mono flex items-center gap-1 transition-all cursor-pointer"
            title="Change Map Background Image"
          >
            <Upload className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Map Image</span>
          </button>

          {/* Road Lines Toggle Button */}
          <button
            onClick={() => setShowLines((prev) => !prev)}
            className={`p-1.5 sm:px-2.5 sm:py-1 rounded-lg text-2xs font-mono font-bold flex items-center gap-1 transition-all border cursor-pointer ${
              showLines
                ? "bg-amber-500/20 text-amber-300 border-amber-500/50"
                : "bg-[#1a1d2c] hover:bg-[#23273a] text-slate-400 border-white/10 hover:text-white"
            }`}
            title="Toggle visibility of connecting road routes between towns"
          >
            <Route className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">{showLines ? "🛤️ Roads: ON" : "🛤️ Roads: OFF"}</span>
          </button>

          {/* Town Names Toggle Button */}
          <button
            onClick={() => setShowTownNames((prev) => !prev)}
            className={`p-1.5 sm:px-2.5 sm:py-1 rounded-lg text-2xs font-mono font-bold flex items-center gap-1 transition-all border cursor-pointer ${
              showTownNames
                ? "bg-amber-500/20 text-amber-300 border-amber-500/50"
                : "bg-[#1a1d2c] hover:bg-[#23273a] text-slate-400 border-white/10 hover:text-white"
            }`}
            title="Toggle visibility of town and landmark name tags on canvas"
          >
            <Tag className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">{showTownNames ? "🏷️ Names: ON" : "🏷️ Names: OFF"}</span>
          </button>

          {/* Map Fit Mode Toggle (Uncropped 100% visible vs Fill) */}
          <button
            onClick={() => setMapFitMode(m => m === "contain" ? "cover" : "contain")}
            className={`p-1.5 sm:px-2.5 sm:py-1 rounded-lg text-2xs font-mono font-bold flex items-center gap-1 transition-all border cursor-pointer ${
              mapFitMode === "contain"
                ? "bg-amber-500/20 text-amber-300 border-amber-500/50"
                : "bg-[#1a1d2c] hover:bg-[#23273a] text-slate-300 border-white/10 hover:text-white"
            }`}
            title="Ensure 100% of map picture is visible without edge cropping"
          >
            <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">{mapFitMode === "contain" ? "🖼️ Uncropped (100%)" : "↔️ Fill Canvas"}</span>
          </button>

          {/* Full Screen Big Map Projector */}
          <button
            onClick={() => setIsBigMapOpen(true)}
            className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-2xs font-mono font-bold flex items-center gap-1 transition-all cursor-pointer"
            title="Open Full Screen Big Map with Projector View"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Big Map</span>
          </button>
        </div>
      </div>

      {/* MULTI-LEVEL MAP HIERARCHY BREADCRUMB HEADER */}
      <div className="bg-[#0c0e14] border-b border-white/10 px-4 py-2 flex flex-wrap items-center justify-between gap-2 shadow-inner">
        <div className="flex items-center space-x-2 text-xs font-mono">
          <button
            onClick={handleReturnToRealm}
            className={`flex items-center space-x-1.5 transition-colors cursor-pointer ${
              mapNavLevel === "realm" ? "text-amber-400 font-bold" : "text-slate-400 hover:text-amber-300"
            }`}
          >
            <Compass className="w-3.5 h-3.5 text-amber-500" />
            <span>🌍 Realm: {activeRegion.name.split(" ")[0]}</span>
          </button>

          {currentCityLocation && (
            <>
              <span className="text-slate-600">/</span>
              <button
                onClick={handleReturnToCity}
                className={`flex items-center space-x-1.5 transition-colors cursor-pointer ${
                  mapNavLevel === "city" ? "text-amber-400 font-bold" : "text-slate-400 hover:text-amber-300"
                }`}
              >
                <span>🏰 {currentCityLocation.name}</span>
              </button>
            </>
          )}

          {currentBuilding && (
            <>
              <span className="text-slate-600">/</span>
              <span className="flex items-center space-x-1.5 text-amber-300 font-bold">
                <span>{getBuildingIcon(currentBuilding.type)}</span>
                <span>{currentBuilding.name}</span>
              </span>
            </>
          )}
        </div>

        {/* Level Controls & Quick Action Buttons */}
        <div className="flex items-center space-x-2">
          {mapNavLevel === "city" && (
            <>
              <button
                onClick={() => setIsCityImageModalOpen(true)}
                className="px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-3xs font-mono text-slate-300 hover:text-white transition-all cursor-pointer flex items-center space-x-1"
                title="Change city map image"
              >
                <Upload className="w-3 h-3 text-amber-400" />
                <span>City Image</span>
              </button>
              {isDmMode && (
                <button
                  onClick={() => setIsAddingBuilding(!isAddingBuilding)}
                  className={`px-2.5 py-1 rounded-lg text-3xs font-mono font-bold transition-all cursor-pointer flex items-center space-x-1 ${
                    isAddingBuilding ? "bg-amber-500 text-black font-bold" : "bg-amber-500/15 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40"
                  }`}
                >
                  <Plus className="w-3 h-3" />
                  <span>+ Add Building Pin</span>
                </button>
              )}
              <button
                onClick={handleReturnToRealm}
                className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg text-3xs font-mono cursor-pointer"
              >
                ← Realm Map
              </button>
            </>
          )}

          {mapNavLevel === "tavern" && (
            <>
              <button
                onClick={() => setIsTavernImageModalOpen(true)}
                className="px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-3xs font-mono text-slate-300 hover:text-white transition-all cursor-pointer flex items-center space-x-1"
                title="Change tavern floor plan or interior image"
              >
                <Upload className="w-3 h-3 text-amber-400" />
                <span>Tavern Image</span>
              </button>
              <button
                onClick={handleOpenTacticalBattleGrid}
                className="px-3 py-1 bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white font-bold rounded-lg text-3xs font-mono shadow flex items-center space-x-1.5 cursor-pointer"
              >
                <Swords className="w-3 h-3" />
                <span>⚔️ Open Tactical Combat Grid</span>
              </button>
              <button
                onClick={handleReturnToCity}
                className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg text-3xs font-mono cursor-pointer"
              >
                ← City Map
              </button>
            </>
          )}
        </div>
      </div>

      {/* MOBILE DEVICE TAB SWITCHER (For iPhone & small screens) */}
      <div className="lg:hidden flex border-b border-white/10 bg-[#12141e] text-xs font-mono">
        <button
          onClick={() => setMobileTab("map")}
          className={`flex-1 py-2 text-center transition-colors ${
            mobileTab === "map" ? "bg-amber-500/10 text-amber-400 font-bold border-b-2 border-amber-500" : "text-slate-400"
          }`}
        >
          🗺️ Interactive Map
        </button>
        <button
          onClick={() => setMobileTab("details")}
          className={`flex-1 py-2 text-center transition-colors ${
            mobileTab === "details" ? "bg-amber-500/10 text-amber-400 font-bold border-b-2 border-amber-500" : "text-slate-400"
          }`}
        >
          📜 Location Details {selectedLocation ? `(${selectedLocation.name.split(" ")[0]})` : ""}
        </button>
        {isDmMode && (
          <button
            onClick={() => setMobileTab("roster")}
            className={`flex-1 py-2 text-center transition-colors ${
              mobileTab === "roster" ? "bg-purple-500/10 text-purple-300 font-bold border-b-2 border-purple-500" : "text-slate-400"
            }`}
          >
            👁️ Secret Roster
          </button>
        )}
      </div>

      {/* REPOSITION PIN ACTIVE BANNER */}
      {repositioningLocId && (
        <div className="bg-amber-500 text-black px-4 py-2 text-xs font-mono font-bold flex items-center justify-between shadow-lg animate-pulse">
          <div className="flex items-center space-x-2">
            <Move className="w-4 h-4" />
            <span>Reposition Mode: Click anywhere on the map to set the new pin location!</span>
          </div>
          <button
            onClick={() => setRepositioningLocId(null)}
            className="bg-black text-white px-2 py-0.5 rounded text-2xs uppercase hover:bg-slate-900"
          >
            Cancel
          </button>
        </div>
      )}

      {/* MAIN WORKSPACE: MAP CANVAS + SIDE SCRIBE PANEL */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden relative">
        
        {/* MAP CANVAS VIEWPORT */}
        <div 
          className={`flex-1 flex flex-col relative overflow-hidden bg-[#07090e] ${
            mobileTab !== "map" ? "hidden lg:flex" : "flex"
          }`}
        >
          {/* FLOATING HUD CONTROLS (PAN & ZOOM HUD) */}
          <div className="absolute top-3 right-3 z-30 flex flex-col space-y-1.5 bg-[#0f111a]/90 backdrop-blur-md border border-white/10 rounded-xl p-1.5 shadow-xl">
            <button
              onClick={() => setZoomScale((prev) => Math.min(3.5, parseFloat((prev + 0.2).toFixed(2))))}
              className="p-2 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Zoom In (+)"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoomScale((prev) => Math.max(0.6, parseFloat((prev - 0.2).toFixed(2))))}
              className="p-2 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Zoom Out (-)"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={handleResetZoom}
              className="p-2 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer font-mono text-3xs font-bold"
              title="Reset Zoom & Pan (100%)"
            >
              {Math.round(zoomScale * 100)}%
            </button>
            <button
              onClick={handleCenterParty}
              className="p-2 hover:bg-amber-500/20 text-amber-400 rounded-lg transition-colors cursor-pointer"
              title="Center on Party Position"
            >
              <Compass className="w-4 h-4" />
            </button>
            {isDmMode && (
              <button
                onClick={() => setIsAddingLocation(!isAddingLocation)}
                className={`p-2 rounded-lg transition-colors cursor-pointer ${
                  isAddingLocation ? "bg-amber-500 text-black font-bold" : "hover:bg-white/10 text-slate-300 hover:text-amber-400"
                }`}
                title="Add New Custom Location to Map"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* FLOATING LEGEND & MOBILE NOTICE */}
          <div className="absolute bottom-3 left-3 z-30 bg-[#0f111a]/90 backdrop-blur-md border border-white/10 rounded-xl p-2.5 text-3xs font-mono text-slate-400 pointer-events-none space-y-1 shadow-xl max-w-[220px]">
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse inline-block" />
              <span className="text-white font-bold">Party Caravan</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="text-red-500 font-bold text-xs">⚔️</span>
              <span className="text-red-400">Boss Slain (Red X)</span>
            </div>
            {isDmMode ? (
              <div className="flex items-center space-x-1.5 text-purple-400">
                <EyeOff className="w-3 h-3" />
                <span>DM Hidden Node (Secret)</span>
              </div>
            ) : (
              <div className="text-slate-500">
                <span>🛡️ Player View Active</span>
              </div>
            )}
            <div className="text-4xs text-slate-500 pt-1 border-t border-white/5">
              Drag to pan • Pinch / wheel to zoom
            </div>
          </div>

          {/* INTERACTIVE PANNABLE & ZOOMABLE CANVAS */}
          <div
            ref={mapContainerRef}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onClick={handleMapCanvasClick}
            className={`relative flex-1 w-full h-full select-none overflow-hidden ${
              repositioningLocId 
                ? "cursor-crosshair" 
                : isAddingLocation 
                ? "cursor-crosshair" 
                : isDraggingMap 
                ? "cursor-grabbing" 
                : "cursor-grab"
            }`}
          >
            {/* TRANSFORM CONTAINER (PAN & ZOOM APPLIED HERE) */}
            <div
              ref={innerCanvasRef}
              style={{
                transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomScale})`,
                transformOrigin: "center center",
                transition: isDraggingMap ? "none" : "transform 0.08s ease-out",
                width: mapFitMode === "contain" && mapAspect ? `${mapAspect >= 1 ? "100%" : "auto"}` : "100%",
                height: mapFitMode === "contain" && mapAspect ? `${mapAspect < 1 ? "100%" : "auto"}` : "100%",
                aspectRatio: mapFitMode === "contain" && mapAspect ? `${mapAspect}` : undefined,
                maxHeight: "100%",
                maxWidth: "100%",
                minHeight: mapFitMode === "contain" ? undefined : "520px"
              }}
              className={`relative ${mapFitMode === "contain" ? "m-auto" : "w-full h-full"}`}
            >
              {/* Regional, City, or Tavern Map Background Image */}
              <img
                src={
                  mapNavLevel === "realm"
                    ? activeRegion.backgroundUrl
                    : mapNavLevel === "city"
                    ? (currentCityLocation?.cityMapImageUrl || "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80&w=1200")
                    : (currentBuilding?.imageUrl || "https://images.unsplash.com/photo-1543007630-9710e4a00a20?auto=format&fit=crop&q=80&w=1200")
                }
                alt="Active Map Canvas"
                onLoad={(e) => {
                  if (e.currentTarget.naturalWidth && e.currentTarget.naturalHeight) {
                    setMapAspect(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight);
                  }
                }}
                className={`absolute inset-0 w-full h-full ${
                  mapFitMode === "contain" ? "object-contain" : "object-cover"
                } pointer-events-none filter brightness-90 contrast-105`}
              />

              {/* Atmospheric Dark Grid Overlay */}
              {showGrid && (
                <div 
                  className="absolute inset-0 pointer-events-none opacity-20"
                  style={{
                    backgroundImage: `linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)`,
                    backgroundSize: "40px 40px"
                  }}
                />
              )}

              {/* LEVEL 1: REALM MAP PATHS & NODES */}
              {mapNavLevel === "realm" && (
                <>
                  {/* PATH LINES SVG */}
                  {showLines && (
                    <svg className="absolute inset-0 w-full h-full pointer-events-none">
                      {visibleLocations.map((loc) => {
                        return loc.connectedTo.map((connId) => {
                          const dest = campaignState.locations.find((l) => l.id === connId);
                          if (!dest) return null;

                          // In Player view, do not draw paths to hidden locations
                          if (!isDmMode && (dest.isHidden || loc.isHidden)) return null;

                          const isHighLighted = selectedLocation && (selectedLocation.id === loc.id || selectedLocation.id === dest.id);

                          return (
                            <line
                              key={`line-${loc.id}-${dest.id}`}
                              x1={`${loc.x}%`}
                              y1={`${loc.y}%`}
                              x2={`${dest.x}%`}
                              y2={`${dest.y}%`}
                              stroke={isHighLighted ? "#f59e0b" : "rgba(245, 158, 11, 0.35)"}
                              strokeWidth={isHighLighted ? "3.5" : "1.8"}
                              strokeDasharray={(!loc.isDiscovered || !dest.isDiscovered || loc.isHidden || dest.isHidden) ? "5,5" : undefined}
                              opacity={isHighLighted ? "0.95" : "0.55"}
                            />
                          );
                        });
                      })}
                    </svg>
                  )}

              {/* LOCATION NODES ON MAP */}
              {visibleLocations.map((loc) => {
                const isPartyHere = loc.id === campaignState.partyLocationId;
                const isNodeSelected = selectedLocation?.id === loc.id;
                const isBossSlain = !!loc.bossSlain;
                const isHiddenFromPlayers = !!loc.isHidden;

                return (
                  <div
                    key={`node-${loc.id}`}
                    style={{ left: `${loc.x}%`, top: `${loc.y}%` }}
                    className="absolute transform -translate-x-1/2 -translate-y-1/2 z-20 group"
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedLocation(loc);
                        setMobileTab("details");
                      }}
                      className={`relative p-2 rounded-full border flex items-center justify-center transition-all duration-200 shadow-2xl cursor-pointer ${
                        isPartyHere
                          ? "bg-amber-500 border-amber-200 ring-4 ring-amber-500/40 scale-125"
                          : isNodeSelected
                          ? "bg-amber-600 border-amber-300 ring-2 ring-amber-400/40 scale-115"
                          : isHiddenFromPlayers
                          ? "bg-purple-950/80 border-purple-500/70 border-dashed hover:scale-110"
                          : isBossSlain
                          ? "bg-slate-900 border-red-500/80 hover:scale-110"
                          : "bg-[#181b28] hover:bg-[#23273c] border-white/20 hover:scale-110"
                      }`}
                    >
                      {/* Location Icon or custom avatar */}
                      {loc.imageUrl ? (
                        <div className="w-6 h-6 rounded-full overflow-hidden">
                          <img src={loc.imageUrl} alt={loc.name} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <span className="text-sm select-none">{getLocationIcon(loc.type)}</span>
                      )}

                      {/* Party active beacon ping */}
                      {isPartyHere && (
                        <span className="absolute inset-0 rounded-full border-2 border-amber-400 animate-ping opacity-75" />
                      )}

                      {/* RED CROSS 'X' ACROSS MAP LOCATION INDICATING BOSS HAS BEEN SLAIN */}
                      {isBossSlain && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <svg className="w-9 h-9 text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.9)]" viewBox="0 0 40 40">
                            {/* Crimson slashed X strokes */}
                            <line x1="6" y1="6" x2="34" y2="34" stroke="#ef4444" strokeWidth="5.5" strokeLinecap="round" />
                            <line x1="34" y1="6" x2="6" y2="34" stroke="#ef4444" strokeWidth="5.5" strokeLinecap="round" />
                            <circle cx="20" cy="20" r="4" fill="#000" stroke="#ef4444" strokeWidth="1.5" />
                          </svg>
                        </div>
                      )}

                      {/* DM Secret Badge */}
                      {isHiddenFromPlayers && (
                        <span className="absolute -top-1.5 -right-1.5 bg-purple-900 border border-purple-400 rounded-full p-0.5 text-purple-200">
                          <EyeOff className="w-2.5 h-2.5" />
                        </span>
                      )}

                      {/* Condition Aura Badge */}
                      {loc.condition && loc.condition !== "normal" && (
                        <span className="absolute -bottom-1 -right-1 text-2xs">
                          {loc.condition === "cleared" ? "🛡️" : loc.condition === "besieged" ? "⚔️" : loc.condition === "cursed" ? "☠️" : "⚠️"}
                        </span>
                      )}
                    </button>

                    {/* LABEL BUBBLE BELOW PIN */}
                    {showTownNames && (
                      <div className="absolute top-9 left-1/2 transform -translate-x-1/2 flex flex-col items-center select-none pointer-events-none z-30">
                        <span
                          className={`whitespace-nowrap text-3xs font-mono rounded px-1.5 py-0.5 border shadow-lg transition-all flex items-center gap-1 ${
                            isPartyHere
                              ? "bg-amber-950 text-amber-200 border-amber-400 font-bold"
                              : isNodeSelected
                              ? "bg-amber-900 text-amber-100 border-amber-500 font-semibold"
                              : isBossSlain
                              ? "bg-red-950/90 text-red-200 border-red-500/60"
                              : isHiddenFromPlayers
                              ? "bg-purple-950/90 text-purple-200 border-purple-500/60 border-dashed"
                              : "bg-[#0d0f18]/90 text-slate-300 border-white/10"
                          }`}
                        >
                          {isBossSlain && <span className="text-red-400 font-bold">✕</span>}
                          {loc.name}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Temporary Plotted Pin (When Adding) */}
              {isAddingLocation && tempCoords && (
                <div
                  style={{ left: `${tempCoords.x}%`, top: `${tempCoords.y}%` }}
                  className="absolute transform -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none"
                >
                  <div className="p-2 rounded-full bg-red-600 animate-pulse text-white font-bold select-none text-base shadow-2xl">
                    🎯
                  </div>
                  <span className="absolute top-8 left-1/2 transform -translate-x-1/2 bg-black/90 border border-red-500 text-white text-3xs rounded px-2 py-0.5 whitespace-nowrap font-mono font-bold shadow-lg">
                    Target: X:{tempCoords.x}% Y:{tempCoords.y}%
                  </span>
                </div>
              )}
                </>
              )}

              {/* LEVEL 2: CITY MAP BUILDING PINS */}
              {mapNavLevel === "city" && (
                <>
                  {(currentCityLocation?.cityBuildings || []).map((bld) => {
                    const isBldSelected = selectedBuilding?.id === bld.id;
                    const isBossSlain = !!bld.bossSlain;

                    return (
                      <div
                        key={`bld-${bld.id}`}
                        style={{ left: `${bld.x}%`, top: `${bld.y}%` }}
                        className="absolute transform -translate-x-1/2 -translate-y-1/2 z-20 group"
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedBuilding(bld);
                            setMobileTab("details");
                          }}
                          className={`relative p-2.5 rounded-full border flex items-center justify-center transition-all duration-200 shadow-2xl cursor-pointer ${
                            isBldSelected
                              ? "bg-amber-500 border-amber-200 ring-4 ring-amber-500/50 scale-125"
                              : isBossSlain
                              ? "bg-slate-900 border-red-500 hover:scale-115"
                              : "bg-[#141624] hover:bg-[#202438] border-amber-500/40 hover:scale-115"
                          }`}
                        >
                          <span className="text-base select-none">{getBuildingIcon(bld.type)}</span>

                          {/* Red X if boss slain */}
                          {isBossSlain && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <svg className="w-9 h-9 text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.9)]" viewBox="0 0 40 40">
                                <line x1="6" y1="6" x2="34" y2="34" stroke="#ef4444" strokeWidth="5.5" strokeLinecap="round" />
                                <line x1="34" y1="6" x2="6" y2="34" stroke="#ef4444" strokeWidth="5.5" strokeLinecap="round" />
                                <circle cx="20" cy="20" r="4" fill="#000" stroke="#ef4444" strokeWidth="1.5" />
                              </svg>
                            </div>
                          )}
                        </button>

                        {/* Building Name Tag */}
                        {showTownNames && (
                          <div className="absolute top-11 left-1/2 transform -translate-x-1/2 pointer-events-none whitespace-nowrap z-10">
                            <span className="bg-black/90 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded text-3xs font-mono font-bold shadow-lg">
                              {bld.name}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Temporary Plotted POI Reticle in City Map */}
                  {isAddingBuilding && tempBuildingCoords && (
                    <div
                      style={{ left: `${tempBuildingCoords.x}%`, top: `${tempBuildingCoords.y}%` }}
                      className="absolute transform -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none"
                    >
                      <div className="p-2.5 rounded-full bg-amber-500 animate-pulse text-black font-bold select-none text-base shadow-2xl border-2 border-white">
                        {getBuildingIcon(newBuildingType)}
                      </div>
                      <span className="absolute top-9 left-1/2 transform -translate-x-1/2 bg-black/95 border border-amber-500 text-amber-300 text-3xs rounded px-2 py-0.5 whitespace-nowrap font-mono font-bold shadow-xl">
                        POI Target: X:{tempBuildingCoords.x}% Y:{tempBuildingCoords.y}%
                      </span>
                    </div>
                  )}
                </>
              )}

              {/* LEVEL 3: TAVERN INTERIOR ROOM / MAP PROMPT */}
              {mapNavLevel === "tavern" && currentBuilding && (
                <div className="absolute inset-0 flex items-center justify-center p-6 pointer-events-none">
                  <div className="bg-black/85 backdrop-blur-md border border-amber-500/40 rounded-2xl p-6 text-center max-w-md shadow-2xl pointer-events-auto space-y-3">
                    <span className="text-4xl">{getBuildingIcon(currentBuilding.type)}</span>
                    <h3 className="font-serif italic text-xl text-amber-400 font-bold">
                      {currentBuilding.name}
                    </h3>
                    <p className="text-xs text-slate-300 font-serif italic leading-relaxed">
                      "{currentBuilding.description}"
                    </p>
                    <div className="pt-2 flex flex-col space-y-2">
                      <button
                        onClick={handleOpenTacticalBattleGrid}
                        className="py-2.5 px-4 bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white font-mono font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg flex items-center justify-center space-x-2 cursor-pointer"
                      >
                        <Swords className="w-4 h-4" />
                        <span>⚔️ Open Tactical Combat Grid & Tokens</span>
                      </button>
                      <button
                        onClick={handleReturnToCity}
                        className="py-1.5 px-3 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg text-2xs font-mono cursor-pointer"
                      >
                        ← Return to {currentCityLocation?.name || "City Map"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* SIDE PANEL: SCRIBE & LOCATION DETAILS / DM ROSTER (RESPONSIVE) */}
        <div 
          className={`w-full lg:w-96 bg-[#0f111a] border-t lg:border-t-0 lg:border-l border-white/10 p-4 sm:p-5 flex flex-col justify-between shrink-0 overflow-y-auto space-y-4 ${
            mobileTab === "map" ? "hidden lg:flex" : "flex"
          }`}
        >
          {/* VIEW A: DM SECRET ROSTER TAB */}
          {mobileTab === "roster" || (isDmRosterOpen && mobileTab !== "details") ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center space-x-2">
                  <Eye className="w-4 h-4 text-purple-400" />
                  <h3 className="text-sm font-bold font-mono uppercase tracking-wider text-purple-300">
                    DM Secret Location Roster
                  </h3>
                </div>
                <button
                  onClick={() => setIsDmRosterOpen(false)}
                  className="text-slate-400 hover:text-white text-xs font-mono"
                >
                  Close
                </button>
              </div>

              <p className="text-2xs font-mono text-slate-400 leading-relaxed">
                Toggle any location visible or hidden from players by its name. Secret locations remain hidden until you reveal them!
              </p>

              {/* Search filter input */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Find location by name..."
                  value={rosterSearch}
                  onChange={(e) => setRosterSearch(e.target.value)}
                  className="w-full bg-[#171a26] border border-white/10 pl-8 pr-3 py-1.5 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Roster list */}
              <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                {regionLocations
                  .filter((l) => !rosterSearch || l.name.toLowerCase().includes(rosterSearch.toLowerCase()))
                  .map((loc) => {
                    const isHidden = !!loc.isHidden;
                    const isBossSlain = !!loc.bossSlain;

                    return (
                      <div
                        key={`roster-${loc.id}`}
                        onClick={() => {
                          setSelectedLocation(loc);
                          setMobileTab("details");
                        }}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                          isHidden
                            ? "bg-purple-950/20 border-purple-500/30 hover:border-purple-400"
                            : "bg-[#141622] border-white/5 hover:border-white/15"
                        }`}
                      >
                        <div className="flex items-center space-x-2 min-w-0">
                          <span className="text-base shrink-0">{getLocationIcon(loc.type)}</span>
                          <div className="truncate">
                            <div className="flex items-center space-x-1.5">
                              <span className="font-bold text-xs text-white truncate">{loc.name}</span>
                              {isBossSlain && <span className="text-red-400 text-2xs font-mono font-bold">💀 SLAIN</span>}
                            </div>
                            <span className="text-3xs font-mono text-slate-400 capitalize block">
                              {loc.type} • Danger Tier {loc.dangerLevel || 1}
                            </span>
                          </div>
                        </div>

                        {/* 1-Click Eye toggle by name */}
                        <div className="flex items-center space-x-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={async () => {
                              if (onToggleHidden) await onToggleHidden(loc.id);
                            }}
                            className={`p-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
                              isHidden
                                ? "bg-purple-900/60 border-purple-400 text-purple-300 hover:bg-purple-800"
                                : "bg-emerald-950/40 border-emerald-500/30 text-emerald-300 hover:bg-emerald-900/50"
                            }`}
                            title={isHidden ? "Currently hidden from players. Click to reveal!" : "Visible to players. Click to hide!"}
                          >
                            {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>

                          <button
                            onClick={() => openEditModal(loc)}
                            className="p-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-slate-300 hover:text-white"
                            title="Edit this location"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          ) : mapNavLevel === "city" && selectedBuilding ? (
            /* VIEW C: SELECTED CITY BUILDING INSPECTOR */
            <div className="space-y-4">
              <div className="flex items-start justify-between border-b border-white/10 pb-3">
                <div className="min-w-0 pr-2">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-3xs font-mono uppercase bg-amber-500/15 border border-amber-500/40 text-amber-300 px-2 py-0.5 rounded font-bold">
                      {selectedBuilding.type}
                    </span>
                    {selectedBuilding.bossSlain && (
                      <span className="bg-red-950/80 text-red-300 border border-red-500/50 text-[9px] font-mono px-2 py-0.5 rounded font-bold">
                        💀 CLEARED / BOSS SLAIN (X)
                      </span>
                    )}
                  </div>
                  <h3 className="font-serif italic text-lg sm:text-xl font-bold text-white tracking-tight flex items-center space-x-2">
                    <span>{getBuildingIcon(selectedBuilding.type)}</span>
                    <span className="truncate">{selectedBuilding.name}</span>
                  </h3>
                </div>

                {isDmMode && (
                  <button
                    onClick={() => handleDeleteBuilding(selectedBuilding.id)}
                    className="p-1.5 bg-white/5 hover:bg-red-950/50 border border-white/10 text-slate-400 hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                    title="Remove building pin"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Building Picture */}
              {selectedBuilding.imageUrl && (
                <div className="relative rounded-xl overflow-hidden border border-white/10 h-32 w-full shadow-md">
                  <img src={selectedBuilding.imageUrl} alt={selectedBuilding.name} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-2.5">
                    <span className="text-3xs font-mono text-slate-300 uppercase tracking-wider">
                      Structure Scenery
                    </span>
                  </div>
                </div>
              )}

              <p className="text-xs text-slate-300 font-serif italic leading-relaxed bg-[#141622] p-3 rounded-xl border border-white/5">
                "{selectedBuilding.description}"
              </p>

              {/* Actions */}
              <div className="space-y-2 pt-2 border-t border-white/10">
                {/* Enter Tavern / Building Map */}
                <button
                  onClick={() => handleEnterTavernMap(selectedBuilding)}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black font-mono font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <Map className="w-4 h-4" />
                  <span>🍺 Enter Tavern / Building Map</span>
                </button>

                {/* Open Battle Grid */}
                <button
                  onClick={handleOpenTacticalBattleGrid}
                  className="w-full py-2 px-4 bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white font-mono font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <Swords className="w-4 h-4" />
                  <span>⚔️ Open Tactical Combat Grid</span>
                </button>

                {/* Toggle Boss Slain (Red X) */}
                {isDmMode && (
                  <button
                    onClick={() => handleToggleBuildingBossSlain(selectedBuilding.id)}
                    className={`w-full py-2 px-3 rounded-xl border font-mono text-2xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      selectedBuilding.bossSlain
                        ? "bg-red-950/60 border-red-500 text-red-300 font-bold"
                        : "bg-[#141622] border-white/10 text-slate-400 hover:text-white"
                    }`}
                  >
                    <Skull className="w-3.5 h-3.5 text-red-400" />
                    <span>{selectedBuilding.bossSlain ? "Boss Slain (X) - Cleared" : "Mark Boss Slain (Red X)"}</span>
                  </button>
                )}
              </div>
            </div>
          ) : selectedLocation ? (
            /* VIEW B: SELECTED LOCATION DETAILS & CONTROLS */
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between border-b border-white/10 pb-3">
                <div className="min-w-0 pr-2">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-3xs font-mono uppercase bg-amber-500/10 border border-amber-500/30 text-amber-400 px-2 py-0.5 rounded font-bold">
                      {selectedLocation.type}
                    </span>
                    {getConditionBadge(selectedLocation.condition)}
                    {selectedLocation.bossSlain && (
                      <span className="bg-red-950/80 text-red-300 border border-red-500/50 text-[9px] font-mono px-2 py-0.5 rounded font-bold flex items-center gap-1">
                        💀 BOSS SLAIN (X)
                      </span>
                    )}
                    {selectedLocation.isHidden && isDmMode && (
                      <span className="bg-purple-950/80 text-purple-300 border border-purple-500/50 text-[9px] font-mono px-2 py-0.5 rounded flex items-center gap-1">
                        <EyeOff className="w-2.5 h-2.5" /> Secret
                      </span>
                    )}
                  </div>
                  <h3 className="font-serif italic text-lg sm:text-xl font-bold text-white tracking-tight truncate">
                    {selectedLocation.name}
                  </h3>
                </div>

                {/* Edit & Delete Action Buttons (DM Mode) */}
                {isDmMode && (
                  <div className="flex items-center space-x-1 shrink-0">
                    <button
                      onClick={() => openEditModal(selectedLocation)}
                      className="p-1.5 bg-white/5 hover:bg-white/15 border border-white/10 text-amber-400 hover:text-amber-300 rounded-lg transition-colors cursor-pointer"
                      title="Edit this location (Name, image, condition, coordinates)"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setEditingLocation(selectedLocation);
                        setIsDeletingConfirm(true);
                      }}
                      className="p-1.5 bg-white/5 hover:bg-red-950/50 border border-white/10 text-slate-400 hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                      title="Remove this location from the map"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Location Banner Image if present */}
              {selectedLocation.imageUrl && (
                <div className="relative rounded-xl overflow-hidden border border-white/10 h-32 w-full shadow-md">
                  <img src={selectedLocation.imageUrl} alt={selectedLocation.name} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-2.5">
                    <span className="text-3xs font-mono text-slate-300 uppercase tracking-wider">
                      Location Scenery Illustration
                    </span>
                  </div>
                </div>
              )}

              {/* Lore Description */}
              <p className="text-xs text-slate-300 font-serif italic leading-relaxed bg-[#141622] p-3 rounded-xl border border-white/5">
                "{selectedLocation.description}"
              </p>

              {/* Distance from Party */}
              {partyLocation && selectedLocation.id !== partyLocation.id && (
                <div className="bg-[#141622] p-2.5 rounded-xl border border-white/5 flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400">Travel Distance:</span>
                  <span className="text-amber-400 font-bold">{getDistanceInLeagues(selectedLocation)} Leagues</span>
                </div>
              )}

              {/* Quick Actions Menu */}
              <div className="space-y-2 pt-2 border-t border-white/10">
                {/* Enter Settlement / City Map (Nested Map Drilldown) */}
                <button
                  onClick={() => handleEnterCityMap(selectedLocation)}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black font-mono font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg flex items-center justify-center space-x-2 cursor-pointer"
                  title="Drill into the City/Settlement map with taverns, shops, and buildings"
                >
                  <Map className="w-4 h-4" />
                  <span>🏰 Enter Settlement / City Map</span>
                </button>

                {/* 1. Enter Interior Battle Map */}
                <button
                  onClick={() => setInsideBattleMapLocation(selectedLocation)}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-red-650 to-red-600 hover:from-red-550 hover:to-red-500 text-white font-mono font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <Swords className="w-4 h-4" />
                  <span>Enter Battle Map & Chambers</span>
                </button>

                {/* 2. Move Party Here */}
                {selectedLocation.id !== campaignState.partyLocationId && (
                  <button
                    onClick={() => onMoveParty(selectedLocation.id)}
                    className="w-full py-2 px-4 bg-amber-500 hover:bg-amber-400 text-black font-mono font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    <Compass className="w-4 h-4" />
                    <span>March Party To Site</span>
                  </button>
                )}

                {/* 3. DM Quick Slain & Hidden Toggles */}
                {isDmMode && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {/* Toggle Boss Slain (Red X) */}
                    <button
                      onClick={async () => {
                        if (onToggleBossSlain) await onToggleBossSlain(selectedLocation.id);
                      }}
                      className={`py-2 px-3 rounded-xl border font-mono text-2xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        selectedLocation.bossSlain
                          ? "bg-red-950/60 border-red-500 text-red-300 font-bold"
                          : "bg-[#141622] border-white/10 text-slate-400 hover:text-white"
                      }`}
                    >
                      <Skull className="w-3.5 h-3.5 text-red-400" />
                      <span>{selectedLocation.bossSlain ? "Boss Slain (X)" : "Mark Boss Slain"}</span>
                    </button>

                    {/* Toggle Hidden / Reveal */}
                    <button
                      onClick={async () => {
                        if (onToggleHidden) await onToggleHidden(selectedLocation.id);
                      }}
                      className={`py-2 px-3 rounded-xl border font-mono text-2xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        selectedLocation.isHidden
                          ? "bg-purple-950/60 border-purple-500 text-purple-300 font-bold"
                          : "bg-[#141622] border-white/10 text-slate-400 hover:text-white"
                      }`}
                    >
                      {selectedLocation.isHidden ? <EyeOff className="w-3.5 h-3.5 text-purple-400" /> : <Eye className="w-3.5 h-3.5" />}
                      <span>{selectedLocation.isHidden ? "Hidden (DM)" : "Visible to All"}</span>
                    </button>
                  </div>
                )}

                {/* 4. DM Move Pin Coordinates */}
                {isDmMode && (
                  <button
                    onClick={() => setRepositioningLocId(selectedLocation.id)}
                    className="w-full py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white rounded-xl text-3xs font-mono uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Move className="w-3 h-3 text-amber-400" />
                    <span>Relocate Pin on Canvas</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* VIEW C: EMPTY / DEFAULT STATE */
            <div className="text-center py-16 space-y-3 font-mono text-xs text-slate-500">
              <Compass className="w-10 h-10 text-slate-650 mx-auto animate-pulse" />
              <p>Select any location marker on the map to inspect lore, battle chambers, or reposition.</p>
              {isDmMode && (
                <button
                  onClick={() => setIsDmRosterOpen(true)}
                  className="px-3 py-1.5 bg-purple-950/40 border border-purple-500/30 text-purple-300 rounded-lg text-xs"
                >
                  Open Secret Locations Roster
                </button>
              )}
            </div>
          )}

          {/* Quick Footer Details */}
          <div className="border-t border-white/10 pt-3 flex items-center justify-between text-3xs font-mono text-slate-500">
            <span>Locations in Territory: {regionLocations.length}</span>
            <span className="text-amber-500">Faerûn Cartography v2.0</span>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* MODAL 1: EDIT LOCATION DETAILS (Name, Type, Img, Condition, Coordinates) */}
      {/* ========================================================= */}
      <AnimatePresence>
        {editingLocation && (
          <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-[#0f111a] border border-amber-500/40 rounded-2xl p-5 shadow-2xl space-y-4 font-sans text-slate-200 max-h-[90vh] overflow-y-auto"
            >
              {isDeletingConfirm ? (
                /* Delete Confirmation Screen */
                <div className="space-y-4 py-4 text-center">
                  <AlertTriangle className="w-12 h-12 text-red-500 mx-auto animate-bounce" />
                  <h3 className="text-lg font-bold text-white">Strike Location from Map?</h3>
                  <p className="text-xs text-slate-300 leading-relaxed max-w-sm mx-auto">
                    Are you sure you want to permanently remove <strong className="text-white">"{editingLocation.name}"</strong>? All interior battle maps and connected paths will be erased.
                  </p>
                  <div className="flex justify-center gap-3 pt-2">
                    <button
                      onClick={handleDeleteLocationConfirm}
                      className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white font-mono font-bold text-xs uppercase rounded-lg transition-colors cursor-pointer"
                    >
                      Yes, Remove Location
                    </button>
                    <button
                      onClick={() => setIsDeletingConfirm(false)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-mono cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* Edit Form */
                <form onSubmit={handleSaveLocationEdit} className="space-y-3.5">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <div className="flex items-center space-x-2">
                      <Edit2 className="w-5 h-5 text-amber-500" />
                      <h3 className="text-base font-bold text-white font-serif italic">
                        Modify Location: {editingLocation.name}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingLocation(null)}
                      className="text-slate-400 hover:text-white"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Name */}
                  <div>
                    <label className="block text-2xs uppercase font-mono text-slate-400 font-bold mb-1">
                      Location Title
                    </label>
                    <input
                      type="text"
                      required
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full bg-[#161824] border border-white/10 text-white px-3 py-1.5 rounded-lg text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-2xs uppercase font-mono text-slate-400 font-bold mb-1">
                      Lore / DM Secret Notes
                    </label>
                    <textarea
                      rows={2}
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      className="w-full bg-[#161824] border border-white/10 text-slate-200 px-3 py-1.5 rounded-lg text-xs focus:outline-none focus:border-amber-500 font-serif italic"
                    />
                  </div>

                  {/* Type & Danger Level */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-2xs uppercase font-mono text-slate-400 font-bold mb-1">
                        Classification Type
                      </label>
                      <select
                        value={editType}
                        onChange={(e) => setEditType(e.target.value as LocationType)}
                        className="w-full bg-[#161824] border border-white/10 text-slate-200 p-2 rounded-lg text-xs focus:outline-none focus:border-amber-500"
                      >
                        <option value="town">Town / Tavern 🏰</option>
                        <option value="dungeon">Dungeon / Vault 💀</option>
                        <option value="forest">Mystic Forest 🌲</option>
                        <option value="ruins">Ancient Ruins 🏚️</option>
                        <option value="castle">Stronghold 🛡️</option>
                        <option value="cave">Cave / Underdark 🕳️</option>
                        <option value="shrine">Mystic Shrine 🔮</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-2xs uppercase font-mono text-slate-400 font-bold mb-1">
                        Condition State
                      </label>
                      <select
                        value={editCondition}
                        onChange={(e) => setEditCondition(e.target.value as any)}
                        className="w-full bg-[#161824] border border-white/10 text-slate-200 p-2 rounded-lg text-xs focus:outline-none focus:border-amber-500"
                      >
                        <option value="normal">Normal / Neutral</option>
                        <option value="cleared">Cleared / Safe Haven 🛡️</option>
                        <option value="besieged">Besieged by Hostiles ⚔️</option>
                        <option value="cursed">Cursed / Blighted ☠️</option>
                        <option value="hazardous">High Peril / Hazard ⚠️</option>
                      </select>
                    </div>
                  </div>

                  {/* Custom Location Image */}
                  <div>
                    <label className="block text-2xs uppercase font-mono text-slate-400 font-bold mb-1">
                      Location Image (Upload or Web URL)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        placeholder="https://..."
                        value={editImageUrl}
                        onChange={(e) => setEditImageUrl(e.target.value)}
                        className="flex-1 bg-[#161824] border border-white/10 text-slate-200 px-3 py-1.5 rounded-lg text-xs focus:outline-none focus:border-amber-500 font-mono"
                      />
                      <input
                        type="file"
                        ref={nodeFileInputRef}
                        accept="image/*"
                        onChange={handleNodeImageUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => nodeFileInputRef.current?.click()}
                        className="px-3 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-lg text-xs font-mono flex items-center gap-1 cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload</span>
                      </button>
                    </div>
                    {editImageUrl && (
                      <div className="mt-2 h-16 w-32 rounded-lg overflow-hidden border border-white/10">
                        <img src={editImageUrl} alt="Preview" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>

                  {/* Toggles: Boss Slain & Hidden */}
                  <div className="bg-[#141624] p-3 rounded-xl border border-white/5 space-y-2">
                    <label className="flex items-center space-x-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editBossSlain}
                        onChange={(e) => setEditBossSlain(e.target.checked)}
                        className="rounded bg-[#1a1d2e] border-white/20 text-red-600 focus:ring-0 w-4 h-4 cursor-pointer"
                      />
                      <div>
                        <span className="text-xs font-bold text-red-400 flex items-center gap-1">
                          💀 Boss / Threat Slain (Red "X" on Map)
                        </span>
                        <span className="text-3xs text-slate-400 block font-mono">
                          Displays a prominent crossed crimson "X" slash across this pin on the map.
                        </span>
                      </div>
                    </label>

                    <label className="flex items-center space-x-2.5 cursor-pointer pt-2 border-t border-white/5">
                      <input
                        type="checkbox"
                        checked={editIsHidden}
                        onChange={(e) => setEditIsHidden(e.target.checked)}
                        className="rounded bg-[#1a1d2e] border-white/20 text-purple-600 focus:ring-0 w-4 h-4 cursor-pointer"
                      />
                      <div>
                        <span className="text-xs font-bold text-purple-300 flex items-center gap-1">
                          👁️ Hidden from Players (Secret Location)
                        </span>
                        <span className="text-3xs text-slate-400 block font-mono">
                          Only visible when DM Mode is turned on. Players cannot see or click it.
                        </span>
                      </div>
                    </label>
                  </div>

                  {/* CONNECTING ROAD ROUTES (CAN BE EDITED / TOGGLED) */}
                  <div className="bg-[#141624] p-3 rounded-xl border border-white/5 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1.5">
                        <Route className="w-3.5 h-3.5 text-amber-500" />
                        <label className="text-2xs uppercase font-mono text-slate-300 font-bold">
                          Connecting Roads ({editConnectedTo.length} routes)
                        </label>
                      </div>
                      <div className="flex items-center space-x-2 text-3xs font-mono">
                        <button
                          type="button"
                          onClick={() => setEditConnectedTo(regionLocations.filter(l => l.id !== editingLocation.id).map(l => l.id))}
                          className="text-amber-400 hover:text-amber-300 underline cursor-pointer"
                        >
                          Select All
                        </button>
                        <span className="text-slate-600">•</span>
                        <button
                          type="button"
                          onClick={() => setEditConnectedTo([])}
                          className="text-slate-400 hover:text-white underline cursor-pointer"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                    <p className="text-3xs text-slate-400 font-mono">
                      Choose which towns and landmarks are linked by road lines to {editingLocation.name}.
                    </p>
                    <div className="max-h-36 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                      {regionLocations
                        .filter((l) => l.id !== editingLocation.id)
                        .map((otherLoc) => {
                          const isConnected = editConnectedTo.includes(otherLoc.id);
                          return (
                            <label
                              key={otherLoc.id}
                              className={`flex items-center justify-between p-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                                isConnected
                                  ? "bg-amber-500/10 border-amber-500/40 text-amber-200"
                                  : "bg-[#181a28]/60 border-white/5 text-slate-400 hover:text-white"
                              }`}
                            >
                              <div className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  checked={isConnected}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setEditConnectedTo((prev) => [...prev, otherLoc.id]);
                                    } else {
                                      setEditConnectedTo((prev) => prev.filter((id) => id !== otherLoc.id));
                                    }
                                  }}
                                  className="rounded bg-[#1a1d2e] border-white/20 text-amber-500 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                                />
                                <span className="font-serif">{otherLoc.name}</span>
                              </div>
                              <span className="text-3xs font-mono text-slate-500">
                                {isConnected ? "Road Linked 🛤️" : "Unconnected"}
                              </span>
                            </label>
                          );
                        })}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={() => setIsDeletingConfirm(true)}
                      className="px-3 py-2 text-red-400 hover:text-red-300 hover:bg-red-950/30 rounded-lg text-xs font-mono transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Location</span>
                    </button>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingLocation(null)}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-mono cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black font-mono font-bold text-xs uppercase rounded-lg transition-colors cursor-pointer shadow-lg"
                      >
                        Save Changes
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* MODAL 2: ADD NEW LOCATION (MATERIALIZATION DIALOG) */}
      {/* ========================================================= */}
      <AnimatePresence>
        {isAddingLocation && tempCoords && (
          <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-[#0f111a] border border-amber-500/40 rounded-2xl p-5 shadow-2xl space-y-3.5 font-sans text-slate-200"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                <div className="flex items-center space-x-2">
                  <Plus className="w-5 h-5 text-amber-500" />
                  <h3 className="text-base font-bold text-white font-serif italic">
                    Materialize Custom Landmark
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setTempCoords(null);
                    setIsAddingLocation(false);
                  }}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateLocationSubmit} className="space-y-3 text-xs">
                <div>
                  <label className="block text-2xs uppercase font-mono text-slate-400 mb-1">
                    Landmark Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dragon's Boneyard"
                    value={newLocName}
                    onChange={(e) => setNewLocName(e.target.value)}
                    className="w-full bg-[#161824] border border-white/10 text-white p-2 rounded-lg text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-2xs uppercase font-mono text-slate-400 mb-1">
                    Lore Description
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Mysterious mist curls among ancient monoliths..."
                    value={newLocDesc}
                    onChange={(e) => setNewLocDesc(e.target.value)}
                    className="w-full bg-[#161824] border border-white/10 text-slate-200 p-2 rounded-lg text-xs focus:outline-none focus:border-amber-500 font-serif italic"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-2xs uppercase font-mono text-slate-400 mb-1">
                      Type
                    </label>
                    <select
                      value={newLocType}
                      onChange={(e) => setNewLocType(e.target.value as LocationType)}
                      className="w-full bg-[#161824] border border-white/10 text-slate-200 p-2 rounded-lg text-xs focus:outline-none focus:border-amber-500"
                    >
                      <option value="cave">Cave / Underdark 🕳️</option>
                      <option value="town">Town / Tavern 🏰</option>
                      <option value="dungeon">Dungeon 💀</option>
                      <option value="forest">Forest 🌲</option>
                      <option value="ruins">Ruins 🏚️</option>
                      <option value="castle">Stronghold 🛡️</option>
                      <option value="shrine">Shrine 🔮</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-2xs uppercase font-mono text-slate-400 mb-1">
                      Coordinates
                    </label>
                    <span className="block bg-[#161824] border border-white/10 text-amber-400 font-mono p-2 rounded-lg text-xs font-bold truncate">
                      X: {tempCoords.x}% • Y: {tempCoords.y}%
                    </span>
                  </div>
                </div>

                <label className="flex items-center space-x-2 cursor-pointer bg-[#141624] p-2.5 rounded-lg border border-white/5">
                  <input
                    type="checkbox"
                    checked={newLocIsHidden}
                    onChange={(e) => setNewLocIsHidden(e.target.checked)}
                    className="rounded bg-[#1a1d2e] border-white/20 text-purple-600 focus:ring-0"
                  />
                  <span className="text-2xs text-purple-300 font-mono font-bold">
                    Mark Secret (Hidden from Players until revealed)
                  </span>
                </label>

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 text-black font-mono font-bold text-xs uppercase rounded-lg transition-colors cursor-pointer"
                  >
                    Plot Location
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTempCoords(null);
                      setIsAddingLocation(false);
                    }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-mono cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* MODAL 2B: ADD PLACE OF INTEREST PIN (CITY MAP POI) */}
      {/* ========================================================= */}
      <AnimatePresence>
        {isAddingBuilding && tempBuildingCoords && currentCityLocation && (
          <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-[#0f111a] border border-amber-500/40 rounded-2xl p-5 shadow-2xl space-y-3.5 font-sans text-slate-200"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                <div className="flex items-center space-x-2">
                  <MapPin className="w-5 h-5 text-amber-500" />
                  <h3 className="text-base font-bold text-white font-serif italic">
                    Add Place of Interest to {currentCityLocation.name}
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setTempBuildingCoords(null);
                    setIsAddingBuilding(false);
                  }}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateBuildingSubmit} className="space-y-3 text-xs">
                <div>
                  <label className="block text-2xs uppercase font-mono text-slate-400 mb-1">
                    Place of Interest Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. The Moonstone Mask, The Beached Leviathan, Arcane Sanctum..."
                    value={newBuildingName}
                    onChange={(e) => setNewBuildingName(e.target.value)}
                    className="w-full bg-[#161824] border border-white/10 text-white p-2 rounded-lg text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-2xs uppercase font-mono text-slate-400 mb-1">
                      POI Category
                    </label>
                    <select
                      value={newBuildingType}
                      onChange={(e) => setNewBuildingType(e.target.value as any)}
                      className="w-full bg-[#161824] border border-white/10 text-slate-200 p-2 rounded-lg text-xs focus:outline-none focus:border-amber-500"
                    >
                      <option value="tavern">Tavern & Taproom 🍺</option>
                      <option value="shop">Market & Shop 🛒</option>
                      <option value="guild">Guildhall 🛡️</option>
                      <option value="temple">Temple & Sanctuary ⛩️</option>
                      <option value="civic">Palace / Civic Hall 🏛️</option>
                      <option value="residence">Noble Residence 🏡</option>
                      <option value="ruin">Ancient Ruins 🏚️</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-2xs uppercase font-mono text-slate-400 mb-1">
                      City Coordinates
                    </label>
                    <span className="block bg-[#161824] border border-white/10 text-amber-400 font-mono p-2 rounded-lg text-xs font-bold truncate">
                      X: {tempBuildingCoords.x}% • Y: {tempBuildingCoords.y}%
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-2xs uppercase font-mono text-slate-400 mb-1">
                    Description & Lore
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Lively tavern with warm hearth, roasted boar, and traveling minstrels..."
                    value={newBuildingDesc}
                    onChange={(e) => setNewBuildingDesc(e.target.value)}
                    className="w-full bg-[#161824] border border-white/10 text-slate-200 p-2 rounded-lg text-xs focus:outline-none focus:border-amber-500 font-serif italic"
                  />
                </div>

                {/* Picture URL or Upload */}
                <div>
                  <label className="block text-2xs uppercase font-mono text-slate-400 mb-1">
                    Building or Interior Picture (Optional)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="https://..."
                      value={newBuildingImageUrl}
                      onChange={(e) => setNewBuildingImageUrl(e.target.value)}
                      className="flex-1 bg-[#161824] border border-white/10 text-slate-200 p-2 rounded-lg text-xs font-mono focus:outline-none focus:border-amber-500"
                    />
                    <input
                      type="file"
                      ref={buildingFileInputRef}
                      accept="image/*"
                      onChange={handleBuildingImageUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => buildingFileInputRef.current?.click()}
                      className="px-3 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-lg text-xs font-mono flex items-center gap-1 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload</span>
                    </button>
                  </div>
                  {newBuildingImageUrl && (
                    <div className="mt-2 h-16 w-32 rounded-lg overflow-hidden border border-white/10">
                      <img src={newBuildingImageUrl} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 text-black font-mono font-bold text-xs uppercase rounded-lg transition-colors cursor-pointer"
                  >
                    Plot POI on City Map
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTempBuildingCoords(null);
                      setIsAddingBuilding(false);
                    }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-mono cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* MODAL 3: FULL SCREEN BIG MAP PROJECTOR WITH PAN & ZOOM */}
      {/* ========================================================= */}
      <AnimatePresence>
        {isBigMapOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#07090e] flex flex-col font-sans"
          >
            {/* Big Map Header Bar */}
            <div className="h-14 bg-[#0e1017] border-b border-white/10 px-4 sm:px-6 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-3">
                <Compass className="w-5 h-5 text-amber-500 animate-spin-slow" />
                <h2 className="text-base sm:text-lg font-serif italic text-white font-bold">
                  Big Map Projector — {activeRegion.name}
                </h2>
                <span className="hidden sm:inline px-2 py-0.5 rounded text-3xs font-mono bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  Tactical Tabletop Display
                </span>
              </div>

              {/* Big Map Controls */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setIsRegionImageModalOpen(true)}
                  className="px-2.5 py-1.5 bg-[#171a26] hover:bg-[#202436] text-slate-200 border border-white/10 rounded-lg text-xs font-mono flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Change Map Image</span>
                </button>

                <button
                  onClick={() => setIsDmMode(!isDmMode)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 cursor-pointer ${
                    isDmMode ? "bg-amber-500 text-black font-bold" : "bg-blue-600 text-white"
                  }`}
                >
                  <span>{isDmMode ? "🎭 DM View" : "🛡️ Player View"}</span>
                </button>

                <button
                  onClick={() => setIsBigMapOpen(false)}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-mono flex items-center gap-1 cursor-pointer"
                >
                  <Minimize2 className="w-3.5 h-3.5" />
                  <span>Exit Projector</span>
                </button>
              </div>
            </div>

            {/* Big Map Body with Floating HUD and Pannable Canvas */}
            <div 
              ref={bigMapContainerRef}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onClick={handleMapCanvasClick}
              className="relative flex-1 w-full h-full overflow-hidden select-none cursor-grab active:cursor-grabbing"
            >
              {/* Floating Big Map HUD */}
              <div className="absolute top-4 right-4 z-40 flex items-center space-x-2 bg-[#0e1017]/90 backdrop-blur-md p-1.5 rounded-xl border border-white/10 shadow-2xl">
                {/* Uncropped 100% Fit Toggle */}
                <button
                  onClick={() => setMapFitMode(m => m === "contain" ? "cover" : "contain")}
                  className={`px-3 py-1.5 rounded-lg text-2xs font-mono font-bold flex items-center gap-1.5 border cursor-pointer ${
                    mapFitMode === "contain"
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/50"
                      : "bg-[#1a1c28] text-slate-300 border-white/10 hover:text-white"
                  }`}
                  title="Toggle uncropped map picture vs fill screen"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                  <span>{mapFitMode === "contain" ? "🖼️ Uncropped (100% Full View)" : "↔️ Fill Screen"}</span>
                </button>

                <button
                  onClick={() => setZoomScale((prev) => Math.min(3.5, parseFloat((prev + 0.25).toFixed(2))))}
                  className="p-2 hover:bg-white/10 rounded-lg text-white"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setZoomScale((prev) => Math.max(0.6, parseFloat((prev - 0.25).toFixed(2))))}
                  className="p-2 hover:bg-white/10 rounded-lg text-white"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  onClick={handleResetZoom}
                  className="px-2.5 py-1 hover:bg-white/10 rounded-lg text-xs font-mono text-amber-400 font-bold"
                  title="Reset View"
                >
                  {Math.round(zoomScale * 100)}%
                </button>
                <button
                  onClick={handleCenterParty}
                  className="p-2 hover:bg-amber-500/20 text-amber-400 rounded-lg"
                  title="Center Party"
                >
                  <Compass className="w-4 h-4" />
                </button>
              </div>

              {/* Pan & Zoom Canvas */}
              <div
                style={{
                  transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomScale})`,
                  transformOrigin: "center center",
                  transition: isDraggingMap ? "none" : "transform 0.08s ease-out",
                  width: mapFitMode === "contain" && mapAspect ? `${mapAspect >= 1 ? "100%" : "auto"}` : "100%",
                  height: mapFitMode === "contain" && mapAspect ? `${mapAspect < 1 ? "100%" : "auto"}` : "100%",
                  aspectRatio: mapFitMode === "contain" && mapAspect ? `${mapAspect}` : undefined,
                  maxHeight: "100%",
                  maxWidth: "100%"
                }}
                className={`relative ${mapFitMode === "contain" ? "m-auto" : "w-full h-full"}`}
              >
                <img
                  src={
                    mapNavLevel === "realm"
                      ? activeRegion.backgroundUrl
                      : mapNavLevel === "city"
                      ? (currentCityLocation?.cityMapImageUrl || "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80&w=1200")
                      : (currentBuilding?.imageUrl || "https://images.unsplash.com/photo-1543007630-9710e4a00a20?auto=format&fit=crop&q=80&w=1200")
                  }
                  alt={activeRegion.name}
                  onLoad={(e) => {
                    if (e.currentTarget.naturalWidth && e.currentTarget.naturalHeight) {
                      setMapAspect(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight);
                    }
                  }}
                  className={`absolute inset-0 w-full h-full ${
                    mapFitMode === "contain" ? "object-contain" : "object-cover"
                  } pointer-events-none filter brightness-95`}
                />

                {mapNavLevel === "realm" && (
                  <>
                    {/* SVG Connections */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none">
                      {visibleLocations.map((loc) => {
                    return loc.connectedTo.map((connId) => {
                      const dest = campaignState.locations.find((l) => l.id === connId);
                      if (!dest) return null;
                      if (!isDmMode && (dest.isHidden || loc.isHidden)) return null;

                      const isSelected = selectedLocation && (selectedLocation.id === loc.id || selectedLocation.id === dest.id);

                      return (
                        <line
                          key={`big-line-${loc.id}-${dest.id}`}
                          x1={`${loc.x}%`}
                          y1={`${loc.y}%`}
                          x2={`${dest.x}%`}
                          y2={`${dest.y}%`}
                          stroke={isSelected ? "#f59e0b" : "rgba(245, 158, 11, 0.4)"}
                          strokeWidth={isSelected ? "4" : "2"}
                          strokeDasharray={(!loc.isDiscovered || !dest.isDiscovered) ? "6,6" : undefined}
                        />
                      );
                    });
                  })}
                </svg>

                {/* Big Map Pins */}
                {visibleLocations.map((loc) => {
                  const isPartyHere = loc.id === campaignState.partyLocationId;
                  const isBossSlain = !!loc.bossSlain;
                  const isNodeSelected = selectedLocation?.id === loc.id;

                  return (
                    <div
                      key={`big-pin-${loc.id}`}
                      style={{ left: `${loc.x}%`, top: `${loc.y}%` }}
                      className="absolute transform -translate-x-1/2 -translate-y-1/2 z-20"
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedLocation(loc);
                        }}
                        className={`relative p-2.5 rounded-full border flex items-center justify-center transition-all duration-200 shadow-2xl cursor-pointer ${
                          isPartyHere
                            ? "bg-amber-500 border-amber-200 ring-4 ring-amber-500/40 scale-135"
                            : isNodeSelected
                            ? "bg-amber-600 border-amber-300 ring-2 ring-amber-400 scale-120"
                            : isBossSlain
                            ? "bg-slate-900 border-red-500"
                            : "bg-[#181b28] border-white/20 hover:scale-115"
                        }`}
                      >
                        {loc.imageUrl ? (
                          <div className="w-8 h-8 rounded-full overflow-hidden">
                            <img src={loc.imageUrl} alt={loc.name} className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <span className="text-lg select-none">{getLocationIcon(loc.type)}</span>
                        )}

                        {isPartyHere && (
                          <span className="absolute inset-0 rounded-full border-2 border-amber-400 animate-ping opacity-75" />
                        )}

                        {/* RED X ACROSS BIG MAP LOCATION */}
                        {isBossSlain && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <svg className="w-11 h-11 text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.95)]" viewBox="0 0 40 40">
                              <line x1="5" y1="5" x2="35" y2="35" stroke="#ef4444" strokeWidth="6" strokeLinecap="round" />
                              <line x1="35" y1="5" x2="5" y2="35" stroke="#ef4444" strokeWidth="6" strokeLinecap="round" />
                              <circle cx="20" cy="20" r="4.5" fill="#000" stroke="#ef4444" strokeWidth="2" />
                            </svg>
                          </div>
                        )}
                      </button>

                      <div className="absolute top-11 left-1/2 transform -translate-x-1/2 flex flex-col items-center select-none pointer-events-none">
                        <span className="whitespace-nowrap text-2xs font-mono rounded px-2 py-0.5 bg-black/90 text-white border border-white/10 font-bold shadow-lg">
                          {isBossSlain && <span className="text-red-400 mr-1">✕</span>}
                          {loc.name}
                        </span>
                      </div>
                    </div>
                  );
                })}
                  </>
                )}

                {/* Big Map City Building Pins */}
                {mapNavLevel === "city" && (
                  <>
                    {(currentCityLocation?.cityBuildings || []).map((bld) => {
                      const isBldSelected = selectedBuilding?.id === bld.id;
                      const isBossSlain = !!bld.bossSlain;

                      return (
                        <div
                          key={`big-bld-${bld.id}`}
                          style={{ left: `${bld.x}%`, top: `${bld.y}%` }}
                          className="absolute transform -translate-x-1/2 -translate-y-1/2 z-20"
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedBuilding(bld);
                            }}
                            className={`relative p-3 rounded-full border flex items-center justify-center transition-all duration-200 shadow-2xl cursor-pointer ${
                              isBldSelected
                                ? "bg-amber-500 border-amber-200 ring-4 ring-amber-500/50 scale-130"
                                : isBossSlain
                                ? "bg-slate-900 border-red-500"
                                : "bg-[#141624] hover:bg-[#202438] border-amber-500/40 hover:scale-115"
                            }`}
                          >
                            <span className="text-xl select-none">{getBuildingIcon(bld.type)}</span>

                            {isBossSlain && (
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <svg className="w-11 h-11 text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.95)]" viewBox="0 0 40 40">
                                  <line x1="5" y1="5" x2="35" y2="35" stroke="#ef4444" strokeWidth="6" strokeLinecap="round" />
                                  <line x1="35" y1="5" x2="5" y2="35" stroke="#ef4444" strokeWidth="6" strokeLinecap="round" />
                                  <circle cx="20" cy="20" r="4.5" fill="#000" stroke="#ef4444" strokeWidth="2" />
                                </svg>
                              </div>
                            )}
                          </button>

                          <div className="absolute top-12 left-1/2 transform -translate-x-1/2 flex flex-col items-center select-none pointer-events-none">
                            <span className="whitespace-nowrap text-2xs font-mono rounded px-2 py-0.5 bg-black/90 text-amber-300 border border-amber-500/30 font-bold shadow-lg">
                              {bld.name}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>

              {/* Selected Location Floating Bar inside Big Map */}
              {selectedLocation && (
                <div className="absolute bottom-5 left-1/2 transform -translate-x-1/2 z-40 bg-[#0e1017]/95 border border-amber-500/40 p-3 sm:p-4 rounded-2xl shadow-2xl backdrop-blur-md flex items-center space-x-4 max-w-xl w-[90%]">
                  <span className="text-2xl">{getLocationIcon(selectedLocation.type)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-serif italic font-bold text-white text-sm sm:text-base truncate">
                        {selectedLocation.name}
                      </h4>
                      {selectedLocation.bossSlain && (
                        <span className="text-2xs font-mono text-red-400 font-bold bg-red-950/60 px-1.5 py-0.5 rounded border border-red-500/40">
                          💀 BOSS SLAIN
                        </span>
                      )}
                    </div>
                    <p className="text-3xs text-slate-300 font-serif italic truncate">
                      "{selectedLocation.description}"
                    </p>
                  </div>
                  <button
                    onClick={() => setInsideBattleMapLocation(selectedLocation)}
                    className="px-3.5 py-2 bg-red-600 hover:bg-red-500 text-white font-mono font-bold text-xs uppercase rounded-xl transition-all shadow shrink-0"
                  >
                    Battle Map
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* MODAL 4: INSIDE LOCATION BATTLE MAP & COMBAT PLACEMENT */}
      {/* ========================================================= */}
      {insideBattleMapLocation && (
        <SiteBattleMapModal
          location={campaignState.locations.find(l => l.id === insideBattleMapLocation.id) || insideBattleMapLocation}
          characters={campaignState.characters}
          partyLocationId={campaignState.partyLocationId}
          onClose={() => setInsideBattleMapLocation(null)}
          onSaveBattleMaps={onSaveBattleMaps || (async () => {})}
        />
      )}

      {/* ========================================================= */}
      {/* MODAL 5: REGION / BIG MAP IMAGE IMPORTER */}
      {/* ========================================================= */}
      <AnimatePresence>
        {isRegionImageModalOpen && (
          <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-xl bg-[#0f111a] border border-amber-500/40 rounded-2xl p-5 shadow-2xl space-y-4 font-sans text-slate-200"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center space-x-2">
                  <ImageIcon className="w-5 h-5 text-amber-500" />
                  <div>
                    <h3 className="text-base font-serif italic text-white font-bold">
                      Change Big Map Cartography Image
                    </h3>
                    <p className="text-3xs font-mono text-slate-400">
                      Territory: <span className="text-amber-400 font-bold">{activeRegion.name}</span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsRegionImageModalOpen(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Upload Image File */}
              <div className="space-y-1.5">
                <label className="block text-2xs uppercase font-mono text-amber-400 font-bold">
                  Option 1: Upload Map Image File (JPG, PNG, WEBP)
                </label>
                <input
                  type="file"
                  ref={regionFileInputRef}
                  accept="image/*"
                  onChange={handleRegionFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => regionFileInputRef.current?.click()}
                  className="w-full py-4 border-2 border-dashed border-white/20 hover:border-amber-500 rounded-xl bg-white/2 hover:bg-amber-500/5 transition-all flex flex-col items-center justify-center space-y-1 cursor-pointer text-slate-300 hover:text-amber-400"
                >
                  <Upload className="w-6 h-6 text-amber-500" />
                  <span className="text-xs font-mono font-bold uppercase">Click to Select Map File</span>
                  <span className="text-3xs text-slate-500 font-mono">Uploads instantly from your computer into this region map</span>
                </button>
              </div>

              {/* Web URL */}
              <div className="space-y-1.5">
                <label className="block text-2xs uppercase font-mono text-amber-400 font-bold">
                  Option 2: Direct Image URL
                </label>
                <div className="flex space-x-2">
                  <input
                    type="url"
                    placeholder="https://... (e.g. from Forgotten Realms wiki, Reddit dndmaps)"
                    value={regionUrlInput}
                    onChange={(e) => setRegionUrlInput(e.target.value)}
                    className="flex-1 bg-[#161824] border border-white/10 text-slate-200 px-3 py-2 rounded-lg text-xs font-mono focus:outline-none focus:border-amber-500"
                  />
                  <button
                    onClick={() => handleApplyRegionImage(regionUrlInput)}
                    disabled={!regionUrlInput.trim()}
                    className="px-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-mono font-bold text-xs uppercase rounded-lg transition-colors cursor-pointer"
                  >
                    Apply URL
                  </button>
                </div>
              </div>

              {/* Curated Presets */}
              <div className="space-y-1.5 pt-2 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <label className="block text-2xs uppercase font-mono text-slate-400 font-bold">
                    Option 3: Curated Regional Presets
                  </label>
                  <button
                    onClick={() => {
                      const def = activeRegionId === "underdark" ? REGION_PRESETS[1].url : REGION_PRESETS[0].url;
                      handleApplyRegionImage(def);
                    }}
                    className="text-3xs font-mono text-amber-500 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                    Reset to Default
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-44 overflow-y-auto pr-1">
                  {REGION_PRESETS.map((preset) => (
                    <div
                      key={preset.id}
                      onClick={() => handleApplyRegionImage(preset.url)}
                      className="group/p relative rounded-lg overflow-hidden border border-white/10 hover:border-amber-500 cursor-pointer h-20 transition-all shadow"
                    >
                      <img src={preset.url} alt={preset.name} className="w-full h-full object-cover group-hover/p:scale-105 transition-transform" />
                      <div className="absolute inset-0 bg-black/55 group-hover/p:bg-black/35 transition-colors flex items-end p-1.5">
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

      {/* MODAL 5: CITY MAP IMAGE CHANGER */}
      <AnimatePresence>
        {isCityImageModalOpen && currentCityLocation && (
          <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-[#0e1017] border border-amber-500/40 rounded-2xl p-6 shadow-2xl space-y-4 font-sans text-slate-200"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center space-x-2">
                  <Map className="w-5 h-5 text-amber-500" />
                  <h3 className="text-base font-serif italic text-white font-bold">
                    Change City Map Image: {currentCityLocation.name}
                  </h3>
                </div>
                <button
                  onClick={() => setIsCityImageModalOpen(false)}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Upload File */}
              <div className="space-y-2">
                <label className="block text-2xs uppercase font-mono text-slate-400 font-bold">
                  Option 1: Upload Image File from Computer
                </label>
                <input
                  type="file"
                  ref={cityFileInputRef}
                  accept="image/*"
                  onChange={handleCityFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => cityFileInputRef.current?.click()}
                  className="w-full py-2.5 bg-[#161824] hover:bg-[#1f2233] border border-dashed border-white/20 hover:border-amber-500/60 rounded-xl flex items-center justify-center space-x-2 text-xs font-mono text-slate-300 hover:text-white transition-all cursor-pointer"
                >
                  <Upload className="w-4 h-4 text-amber-500" />
                  <span>Choose City Image File</span>
                </button>
              </div>

              {/* Web URL */}
              <div className="space-y-2">
                <label className="block text-2xs uppercase font-mono text-slate-400 font-bold">
                  Option 2: Paste Web Image URL
                </label>
                <div className="flex space-x-2">
                  <input
                    type="url"
                    placeholder="https://... (e.g. fantasy town map)"
                    value={cityImageUrlInput}
                    onChange={(e) => setCityImageUrlInput(e.target.value)}
                    className="flex-1 bg-[#161824] border border-white/10 text-slate-200 px-3 py-2 rounded-lg text-xs font-mono focus:outline-none focus:border-amber-500"
                  />
                  <button
                    onClick={() => handleApplyCityImage(cityImageUrlInput)}
                    disabled={!cityImageUrlInput.trim()}
                    className="px-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-mono font-bold text-xs uppercase rounded-lg transition-colors cursor-pointer"
                  >
                    Apply URL
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 6: TAVERN MAP IMAGE CHANGER */}
      <AnimatePresence>
        {isTavernImageModalOpen && currentBuilding && (
          <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-[#0e1017] border border-amber-500/40 rounded-2xl p-6 shadow-2xl space-y-4 font-sans text-slate-200"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center space-x-2">
                  <span className="text-xl">🍺</span>
                  <h3 className="text-base font-serif italic text-white font-bold">
                    Change Tavern Floor Plan Image: {currentBuilding.name}
                  </h3>
                </div>
                <button
                  onClick={() => setIsTavernImageModalOpen(false)}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Upload File */}
              <div className="space-y-2">
                <label className="block text-2xs uppercase font-mono text-slate-400 font-bold">
                  Option 1: Upload Floor Plan / Picture from Computer
                </label>
                <input
                  type="file"
                  ref={tavernFileInputRef}
                  accept="image/*"
                  onChange={handleTavernFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => tavernFileInputRef.current?.click()}
                  className="w-full py-2.5 bg-[#161824] hover:bg-[#1f2233] border border-dashed border-white/20 hover:border-amber-500/60 rounded-xl flex items-center justify-center space-x-2 text-xs font-mono text-slate-300 hover:text-white transition-all cursor-pointer"
                >
                  <Upload className="w-4 h-4 text-amber-500" />
                  <span>Choose Tavern Picture File</span>
                </button>
              </div>

              {/* Web URL */}
              <div className="space-y-2">
                <label className="block text-2xs uppercase font-mono text-slate-400 font-bold">
                  Option 2: Paste Web Image URL
                </label>
                <div className="flex space-x-2">
                  <input
                    type="url"
                    placeholder="https://... (e.g. tavern battle map)"
                    value={tavernImageUrlInput}
                    onChange={(e) => setTavernImageUrlInput(e.target.value)}
                    className="flex-1 bg-[#161824] border border-white/10 text-slate-200 px-3 py-2 rounded-lg text-xs font-mono focus:outline-none focus:border-amber-500"
                  />
                  <button
                    onClick={() => handleApplyTavernImage(tavernImageUrlInput)}
                    disabled={!tavernImageUrlInput.trim()}
                    className="px-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-mono font-bold text-xs uppercase rounded-lg transition-colors cursor-pointer"
                  >
                    Apply URL
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
