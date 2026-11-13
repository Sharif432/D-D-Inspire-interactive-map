import { FogOfWarState } from "../types";

export const DEFAULT_FOG_OF_WAR: FogOfWarState = {
  enabled: false,
  strokes: []
};

/**
 * Checks whether a point (in 0-100% coordinates) is visible to players
 * under the current Fog of War configuration.
 */
export function isPointVisibleToPlayers(
  fog: FogOfWarState | undefined,
  xPct: number,
  yPct: number,
  aspect = 16 / 9
): boolean {
  if (!fog || !fog.enabled) {
    return true;
  }

  let isVisible = false;
  const safeAspect = aspect > 0.1 ? aspect : 16 / 9;

  for (const stroke of fog.strokes) {
    const dx = xPct - stroke.x;
    const dy = (yPct - stroke.y) / safeAspect;
    const distSq = dx * dx + dy * dy;
    if (distSq <= stroke.r * stroke.r) {
      isVisible = stroke.mode !== "hide";
    }
  }

  return isVisible;
}
