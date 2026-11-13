import React, { useState, useRef, useEffect, useId } from "react";
import { FogOfWarShape, FogOfWarState } from "../types";

interface FogOfWarOverlayProps {
  fogOfWar?: FogOfWarState;
  aspect: number;
  isDmMode: boolean;
  brushMode: "off" | "reveal" | "hide";
  brushRadius: number;
  onUpdateFog: (nextFog: FogOfWarState) => void;
  zIndexClass?: string;
}

export default function FogOfWarOverlay({
  fogOfWar,
  aspect,
  isDmMode,
  brushMode,
  brushRadius,
  onUpdateFog,
  zIndexClass = "z-[25]"
}: FogOfWarOverlayProps) {
  const uniqueId = useId().replace(/:/g, "");
  const maskId = `fog-mask-${uniqueId}`;
  const blurId = `fog-blur-${uniqueId}`;
  const patternId = `fog-pattern-${uniqueId}`;

  const safeAspect = aspect > 0.1 ? aspect : 16 / 9;
  const isEnabled = !!fogOfWar?.enabled;

  // Local draft state for smooth 60fps painting without spamming API requests
  const [draftFog, setDraftFog] = useState<FogOfWarState>(
    fogOfWar || { enabled: false, strokes: [] }
  );
  const draftRef = useRef<FogOfWarState>(draftFog);
  const isPaintingRef = useRef<boolean>(false);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

  // Sync external state updates when not actively painting
  useEffect(() => {
    if (!isPaintingRef.current) {
      const next = fogOfWar || { enabled: false, strokes: [] };
      setDraftFog(next);
      draftRef.current = next;
    }
  }, [fogOfWar]);

  const isBrushActive = isDmMode && isEnabled && brushMode !== "off";

  if (!isEnabled) {
    return null;
  }

  const getRelativePercent = (clientX: number, clientY: number, el: HTMLDivElement) => {
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const x = Math.max(0, Math.min(100, parseFloat((((clientX - rect.left) / rect.width) * 100).toFixed(2))));
    const y = Math.max(0, Math.min(100, parseFloat((((clientY - rect.top) / rect.height) * 100).toFixed(2))));
    return { x, y };
  };

  const appendStrokeIfNeeded = (x: number, y: number, force = false) => {
    const current = draftRef.current;
    const mode: "reveal" | "hide" = brushMode === "hide" ? "hide" : "reveal";
    const last = current.strokes[current.strokes.length - 1];

    if (!force && last && last.mode === mode) {
      const dx = x - last.x;
      const dy = (y - last.y) / safeAspect;
      const minStep = Math.max(1.2, brushRadius * 0.28);
      if (Math.hypot(dx, dy) < minStep) {
        return;
      }
    }

    const nextStroke: FogOfWarShape = {
      x,
      y,
      r: brushRadius,
      mode
    };
    const nextState: FogOfWarState = {
      enabled: true,
      strokes: [...current.strokes, nextStroke]
    };
    draftRef.current = nextState;
    setDraftFog(nextState);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isBrushActive) return;
    e.stopPropagation();
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture is unsupported
    }
    const coords = getRelativePercent(e.clientX, e.clientY, e.currentTarget);
    if (!coords) return;
    isPaintingRef.current = true;
    setCursorPos(coords);
    appendStrokeIfNeeded(coords.x, coords.y, true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isBrushActive) return;
    const coords = getRelativePercent(e.clientX, e.clientY, e.currentTarget);
    if (!coords) return;
    setCursorPos(coords);
    if (isPaintingRef.current) {
      e.stopPropagation();
      appendStrokeIfNeeded(coords.x, coords.y, false);
    }
  };

  const finishPainting = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPaintingRef.current) return;
    e.stopPropagation();
    isPaintingRef.current = false;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore
    }
    onUpdateFog(draftRef.current);
  };

  const handlePointerLeave = (e: React.PointerEvent<HTMLDivElement>) => {
    setCursorPos(null);
    if (isPaintingRef.current) {
      finishPainting(e);
    }
  };

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishPainting}
      onPointerCancel={finishPainting}
      onPointerLeave={handlePointerLeave}
      onMouseDown={(e) => {
        if (isBrushActive) e.stopPropagation();
      }}
      onTouchStart={(e) => {
        if (isBrushActive) e.stopPropagation();
      }}
      onClick={(e) => {
        if (isBrushActive) e.stopPropagation();
      }}
      style={{
        touchAction: isBrushActive ? "none" : "auto"
      }}
      className={`absolute inset-0 ${zIndexClass} select-none ${
        isBrushActive ? "pointer-events-auto cursor-crosshair" : "pointer-events-none"
      }`}
    >
      {/* SVG Fog Mask Layer */}
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="w-full h-full block"
      >
        <defs>
          <filter id={blurId} x="-15%" y="-15%" width="130%" height="130%">
            <feGaussianBlur stdDeviation="0.6" />
          </filter>

          {/* Subtle dark mist texture pattern for atmospheric fog */}
          <pattern id={patternId} width="12" height="12" patternUnits="userSpaceOnUse">
            <rect width="12" height="12" fill={isDmMode ? "rgba(6, 8, 16, 0.62)" : "#05070e"} />
            <circle cx="3" cy="3" r="4" fill={isDmMode ? "rgba(30, 41, 59, 0.25)" : "rgba(15, 23, 42, 0.45)"} />
            <circle cx="9" cy="9" r="3.5" fill={isDmMode ? "rgba(15, 23, 42, 0.25)" : "rgba(10, 14, 24, 0.5)"} />
          </pattern>

          <mask id={maskId}>
            {/* White = fogged (opaque), Black = revealed (transparent) */}
            <rect x="0" y="0" width="100" height="100" fill="white" />
            <g filter={`url(#${blurId})`}>
              {draftFog.strokes.map((s, idx) => (
                <ellipse
                  key={idx}
                  cx={s.x}
                  cy={s.y}
                  rx={s.r}
                  ry={s.r * safeAspect}
                  fill={s.mode === "hide" ? "white" : "black"}
                />
              ))}
            </g>
          </mask>
        </defs>

        <rect
          x="0"
          y="0"
          width="100"
          height="100"
          fill={`url(#${patternId})`}
          mask={`url(#${maskId})`}
        />
      </svg>

      {/* Brush Cursor Ring Preview (DM Brush Active) */}
      {isBrushActive && cursorPos && (
        <div
          style={{
            left: `${cursorPos.x}%`,
            top: `${cursorPos.y}%`,
            width: `${brushRadius * 2}%`,
            height: `${brushRadius * 2 * safeAspect}%`,
            transform: "translate(-50%, -50%)"
          }}
          className={`absolute rounded-full border-2 pointer-events-none shadow-lg transition-colors ${
            brushMode === "reveal"
              ? "border-amber-400 bg-amber-400/15"
              : "border-purple-400 bg-purple-900/30"
          }`}
        />
      )}
    </div>
  );
}
