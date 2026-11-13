import { BuildingType, CampaignState, LocationType } from "../types";

export const LOCATION_TYPE_OPTIONS: { value: LocationType; label: string; icon: string }[] = [
  { value: "town", label: "City / Town", icon: "🏰" },
  { value: "village", label: "Village / Hamlet", icon: "🏘️" },
  { value: "harbour", label: "Harbour / Seaport", icon: "⚓" },
  { value: "castle_wall", label: "Castle Wall / Rampart", icon: "🧱" },
  { value: "castle", label: "Stronghold / Keep", icon: "🛡️" },
  { value: "fortress", label: "Citadel / Bastion", icon: "🏯" },
  { value: "tower", label: "Watchtower / Spire", icon: "🗼" },
  { value: "bridge", label: "Bridge / Crossing", icon: "🌉" },
  { value: "market", label: "Bazaar / Trading Post", icon: "⚖️" },
  { value: "temple", label: "Temple / Monastery", icon: "⛩️" },
  { value: "shrine", label: "Mystic Shrine", icon: "🔮" },
  { value: "camp", label: "Encampment / Outpost", icon: "⛺" },
  { value: "forest", label: "Mystic Forest", icon: "🌲" },
  { value: "mountain", label: "Mountain / Pass", icon: "⛰️" },
  { value: "swamp", label: "Swamp / Marsh", icon: "🐊" },
  { value: "desert", label: "Desert / Oasis", icon: "🏜️" },
  { value: "lake", label: "Lake / Riverbed", icon: "🌊" },
  { value: "ruins", label: "Ancient Ruins", icon: "🏚️" },
  { value: "cave", label: "Cave / Underdark", icon: "🕳️" },
  { value: "dungeon", label: "Dungeon / Vault", icon: "💀" }
];

export const BUILDING_TYPE_OPTIONS: { value: BuildingType; label: string; icon: string }[] = [
  { value: "tavern", label: "Tavern & Inn", icon: "🍺" },
  { value: "shop", label: "Market & Shop", icon: "🛒" },
  { value: "harbour", label: "Harbour / Docks", icon: "⚓" },
  { value: "castle_wall", label: "Castle Wall / Gatehouse", icon: "🧱" },
  { value: "guild", label: "Guildhall", icon: "🛡️" },
  { value: "barracks", label: "Barracks / Garrison", icon: "⚔️" },
  { value: "smith", label: "Blacksmith / Forge", icon: "⚒️" },
  { value: "market", label: "Bazaar / Square", icon: "🎪" },
  { value: "stable", label: "Stables & Caravan", icon: "🐎" },
  { value: "temple", label: "Temple & Sanctuary", icon: "⛩️" },
  { value: "library", label: "Library / Arcane Hall", icon: "📚" },
  { value: "civic", label: "Palace / Civic Hall", icon: "🏛️" },
  { value: "residence", label: "Noble Residence", icon: "🏡" },
  { value: "prison", label: "Dungeon / Prison", icon: "⛓️" },
  { value: "ruin", label: "Ancient Ruins", icon: "🏚️" }
];

export function getLocationIconByType(type: LocationType | string): string {
  const found = LOCATION_TYPE_OPTIONS.find((opt) => opt.value === type);
  return found ? found.icon : "📍";
}

export function getBuildingIconByType(type: BuildingType | string): string {
  const found = BUILDING_TYPE_OPTIONS.find((opt) => opt.value === type);
  return found ? found.icon : "📍";
}

/**
 * Reads an uploaded File as a base64 Data URL and optimizes large images (>1.2MB or >2200px)
 * so they remain crisp while keeping exported campaign JSON files fast and portable.
 */
export function processUploadedImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read image file."));
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (!dataUrl) {
        reject(new Error("Empty image data."));
        return;
      }

      // Preserve small images, SVGs, or animated GIFs untouched
      const isSvgOrGif = file.type === "image/svg+xml" || file.type === "image/gif";
      if (isSvgOrGif || file.size < 900 * 1024) {
        resolve(dataUrl);
        return;
      }

      const img = new Image();
      img.onload = () => {
        const maxDim = 2200;
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (width <= maxDim && height <= maxDim && file.size < 1.8 * 1024 * 1024) {
          resolve(dataUrl);
          return;
        }

        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.max(1, Math.round(width * ratio));
          height = Math.max(1, Math.round(height * ratio));
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL("image/webp", 0.86);
        resolve(compressed && compressed.length < dataUrl.length ? compressed : dataUrl);
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

export interface ExtractedCampaignImage {
  url: string;
  label: string;
  isEmbedded: boolean;
}

/**
 * Extracts all unique pictures used across the campaign (maps, cities, taverns, battle grids, tokens, heroes)
 * so they can be reused in 1 click after importing a save file without manually re-uploading anything.
 */
export function extractCampaignImages(campaign: CampaignState | null | undefined): ExtractedCampaignImage[] {
  if (!campaign) return [];
  const seen = new Set<string>();
  const results: ExtractedCampaignImage[] = [];

  const add = (url: string | undefined, label: string) => {
    const clean = url?.trim();
    if (!clean || seen.has(clean)) return;
    seen.add(clean);
    results.push({
      url: clean,
      label,
      isEmbedded: clean.startsWith("data:")
    });
  };

  (campaign.mediaLibrary || []).forEach((m) => add(m.url, m.name));
  (campaign.regions || []).forEach((r) => add(r.backgroundUrl, `Region: ${r.name}`));
  (campaign.locations || []).forEach((loc) => {
    add(loc.imageUrl, `Pin: ${loc.name}`);
    add(loc.cityMapImageUrl, `City Map: ${loc.name}`);
    (loc.interiorMaps || []).forEach((m) => {
      add(m.imageUrl, `Battle Map: ${m.name}`);
      (m.tokens || []).forEach((t) => add(t.avatarUrl, `Token: ${t.name}`));
    });
    (loc.cityBuildings || []).forEach((bld) => {
      add(bld.imageUrl, `POI: ${bld.name}`);
      (bld.interiorMaps || []).forEach((m) => {
        add(m.imageUrl, `Interior: ${m.name}`);
        (m.tokens || []).forEach((t) => add(t.avatarUrl, `Token: ${t.name}`));
      });
    });
  });
  (campaign.characters || []).forEach((c) => add(c.avatarUrl, `Hero: ${c.name}`));

  return results;
}
