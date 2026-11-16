export interface Character {
  id: string;
  name: string;
  race: string;
  className: string;
  level: number;
  hp: {
    current: number;
    max: number;
  };
  stats: {
    strength: number;
    dexterity: number;
    constitution: number;
    intelligence: number;
    wisdom: number;
    charisma: number;
  };
  voice: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';
  avatarUrl: string;
  statusEffects?: string[];
  exhaustionLevel?: number;
}

export type LocationType =
  | 'town'
  | 'village'
  | 'dungeon'
  | 'forest'
  | 'ruins'
  | 'castle'
  | 'castle_wall'
  | 'fortress'
  | 'harbour'
  | 'tower'
  | 'bridge'
  | 'camp'
  | 'temple'
  | 'market'
  | 'mountain'
  | 'swamp'
  | 'desert'
  | 'lake'
  | 'cave'
  | 'shrine';

export type BuildingType =
  | 'tavern'
  | 'shop'
  | 'guild'
  | 'temple'
  | 'residence'
  | 'civic'
  | 'ruin'
  | 'harbour'
  | 'castle_wall'
  | 'barracks'
  | 'market'
  | 'stable'
  | 'smith'
  | 'library'
  | 'prison';

export interface MapToken {
  id: string;
  name: string;
  characterId?: string; // if tied to a campaign character
  avatarUrl?: string;
  type: 'player' | 'enemy' | 'npc';
  x: number; // grid column (0 to gridCols-1)
  y: number; // grid row (0 to gridRows-1)
  hp?: {
    current: number;
    max: number;
  };
  color?: string;
  notes?: string;
}

export interface FogOfWarShape {
  x: number; // 0-100 percentage of map width
  y: number; // 0-100 percentage of map height
  r: number; // radius in percentage of map width
  mode: 'reveal' | 'hide';
}

export interface FogOfWarState {
  enabled: boolean;
  strokes: FogOfWarShape[];
}

export interface SiteBattleMap {
  id: string;
  locationId: string;
  name: string;
  description?: string;
  level?: 'region' | 'city' | 'building' | 'interior';
  parentMapId?: string;
  imageUrl: string;
  gridCols: number;
  gridRows: number;
  showGrid: boolean;
  gridColor?: string;
  tokens: MapToken[];
  subMaps?: SiteBattleMap[];
  fogOfWar?: FogOfWarState;
}

export interface CityBuildingPin {
  id: string;
  name: string;
  description: string;
  type: BuildingType;
  x: number; // percentage-based 0-100 on city map
  y: number; // percentage-based 0-100 on city map
  imageUrl?: string;
  isHidden?: boolean;
  bossSlain?: boolean;
  interiorMaps?: SiteBattleMap[];
  activeInteriorMapId?: string;
  fogOfWar?: FogOfWarState;
}

export interface CampaignLocation {
  id: string;
  name: string;
  description: string;
  type: LocationType;
  x: number; // percentage-based 0-100 for canvas coordinate plotting
  y: number; // percentage-based 0-100 for canvas coordinate plotting
  isHidden: boolean;
  isDiscovered: boolean;
  connectedTo: string[]; // other location IDs
  dangerLevel: number; // T1 to T4 or 1 to 5
  imageUrl?: string;
  condition?: 'normal' | 'cleared' | 'besieged' | 'cursed' | 'hazardous';
  bossSlain?: boolean;
  isBossLocation?: boolean;
  cityMapImageUrl?: string;
  cityBuildings?: CityBuildingPin[];
  cityFogOfWar?: FogOfWarState;
  interiorMaps?: SiteBattleMap[];
  activeInteriorMapId?: string;
}

export interface Region {
  id: string;
  name: string;
  description: string;
  backgroundUrl: string;
  fogOfWar?: FogOfWarState;
}

export interface JournalNote {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  authorCharacterId?: string; // which character wrote it, or "DM"
  category: 'quest' | 'lore' | 'session' | 'loot';
}

export interface DiceRollResult {
  id: string;
  characterId?: string;
  characterName: string;
  diceNotation: string;
  rolls: number[];
  modifier: number;
  statName?: string;
  total: number;
  timestamp: string;
}

export interface InitiativeCombatant {
  id: string;
  characterId?: string;
  name: string;
  race?: string;
  className?: string;
  avatarUrl?: string;
  initiativeScore: number;
  dexModifier: number;
  hp?: {
    current: number;
    max: number;
  };
  isCustom?: boolean;
}

export interface CampaignMediaAsset {
  id: string;
  name: string;
  url: string;
}

export interface LiveViewState {
  regionId: string;
  navLevel: 'realm' | 'city' | 'tavern';
  cityLocationId?: string | null;
  buildingId?: string | null;
  battleMapLocationId?: string | null;
  battleMapBuildingId?: string | null;
  activeInteriorMapId?: string | null;
  isBigMapOpen?: boolean;
  showLines?: boolean;
  showTownNames?: boolean;
  updatedAt?: string;
}

export interface CampaignState {
  campaignName?: string;
  partyName?: string;
  currentRegionId: string;
  partyLocationId: string;
  regions: Region[];
  locations: CampaignLocation[];
  characters: Character[];
  notes: JournalNote[];
  recentRolls: DiceRollResult[];
  initiativeOrder?: InitiativeCombatant[];
  initiativeRound?: number;
  currentTurnIndex?: number;
  mediaLibrary?: CampaignMediaAsset[];
  liveView?: LiveViewState;
  stateVersion?: number;
}
