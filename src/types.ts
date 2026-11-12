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
}

export type LocationType = 'town' | 'dungeon' | 'forest' | 'ruins' | 'castle' | 'cave' | 'shrine';

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
}

export interface CityBuildingPin {
  id: string;
  name: string;
  description: string;
  type: 'tavern' | 'shop' | 'guild' | 'temple' | 'residence' | 'civic' | 'ruin';
  x: number; // percentage-based 0-100 on city map
  y: number; // percentage-based 0-100 on city map
  imageUrl?: string;
  isHidden?: boolean;
  bossSlain?: boolean;
  interiorMaps?: SiteBattleMap[];
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
  interiorMaps?: SiteBattleMap[];
  activeInteriorMapId?: string;
}

export interface Region {
  id: string;
  name: string;
  description: string;
  backgroundUrl: string;
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
}
