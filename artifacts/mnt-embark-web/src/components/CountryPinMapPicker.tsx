import React, { useRef, useState, useCallback } from "react";
import { WORLD_COUNTRY_PATHS } from "@/components/DestinationsMap";
import {
  MAP_W,
  MAP_H,
  proj,
  unproj,
  resolveDefaultCountryCoords,
} from "@/lib/countryCoordinates";
import { Button } from "@workspace/mnt-embark/components/ui/button";
import { Badge } from "@workspace/mnt-embark/components/ui/badge";
import { Compass, RotateCcw, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Eye } from "lucide-react";
import { cn } from "@workspace/mnt-embark/lib/utils";

interface CountryPinMapPickerProps {
  latitude?: number | null;
  longitude?: number | null;
  onChange: (lat: number, lng: number) => void;
  pinImage?: string | null;
  countryName?: string;
  countryCode?: string | null;
  className?: string;
}

export function CountryPinMapPicker({
  latitude,
  longitude,
  onChange,
  pinImage,
  countryName = "",
  countryCode = "",
  className,
}: CountryPinMapPickerProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverCoord, setHoverCoord] = useState<{ x: number; y: number; lat: number; lng: number } | null>(null);

  const hasCoords =
    latitude !== null &&
    latitude !== undefined &&
    !isNaN(Number(latitude)) &&
    longitude !== null &&
    longitude !== undefined &&
    !isNaN(Number(longitude));

  const currentLat = hasCoords ? Number(latitude) : 0;
  const currentLng = hasCoords ? Number(longitude) : 0;
  const [pinX, pinY] = proj(currentLat, currentLng);

  const handlePointerEvent = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const scaleX = MAP_W / rect.width;
      const scaleY = MAP_H / rect.height;

      const clickX = Math.max(0, Math.min(MAP_W, (e.clientX - rect.left) * scaleX));
      const clickY = Math.max(0, Math.min(MAP_H, (e.clientY - rect.top) * scaleY));

      const [newLat, newLng] = unproj(clickX, clickY);
      onChange(newLat, newLng);
    },
    [onChange]
  );

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = MAP_W / rect.width;
    const scaleY = MAP_H / rect.height;

    const mx = Math.max(0, Math.min(MAP_W, (e.clientX - rect.left) * scaleX));
    const my = Math.max(0, Math.min(MAP_H, (e.clientY - rect.top) * scaleY));
    const [lat, lng] = unproj(mx, my);
    setHoverCoord({ x: mx, y: my, lat, lng });

    if (isDragging) {
      handlePointerEvent(e);
    }
  };

  const handleResetDefault = () => {
    const def = resolveDefaultCountryCoords(countryName, countryCode);
    if (def) {
      onChange(def[0], def[1]);
    }
  };

  const nudge = (dLat: number, dLng: number) => {
    const nLat = Math.max(-90, Math.min(90, Number((currentLat + dLat).toFixed(4))));
    const nLng = Math.max(-180, Math.min(180, Number((currentLng + dLng).toFixed(4))));
    onChange(nLat, nLng);
  };

  const defaultCoords = resolveDefaultCountryCoords(countryName, countryCode);

  return (
    <div className={cn("rounded-lg border border-border/60 bg-card/60 p-3 space-y-3", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Compass className="h-4 w-4 text-primary" />
          <span className="font-serif text-sm font-medium text-foreground tracking-wide">
            Interactive Pin Positioner
          </span>
        </div>
        {defaultCoords && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleResetDefault}
            className="h-6 px-2 text-[11px] font-sans text-muted-foreground hover:text-primary gap-1"
            title="Reset to standard country centroid"
          >
            <RotateCcw className="h-3 w-3" /> Centroid
          </Button>
        )}
      </div>

      {/* SVG Canvas */}
      <div className="relative rounded overflow-hidden border border-border/40 bg-background/80 shadow-inner group">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${MAP_W} ${MAP_H}`}
          className="w-full h-auto cursor-crosshair select-none block"
          onPointerDown={(e) => {
            setIsDragging(true);
            handlePointerEvent(e);
          }}
          onPointerUp={() => setIsDragging(false)}
          onPointerLeave={() => {
            setIsDragging(false);
            setHoverCoord(null);
          }}
          onPointerMove={handlePointerMove}
        >
          <defs>
            {/* Dark ocean gradient */}
            <radialGradient id="picker-ocean-grad" cx="50%" cy="50%" r="60%">
              <stop offset="0%" stopColor="hsl(var(--background))" />
              <stop offset="100%" stopColor="hsl(var(--card))" />
            </radialGradient>

            {/* Circular clip for the pin image */}
            <clipPath id="picker-pin-clip">
              <circle cx="0" cy="0" r="14" />
            </clipPath>
          </defs>

          {/* Background Ocean */}
          <rect width={MAP_W} height={MAP_H} fill="url(#picker-ocean-grad)" />

          {/* Latitude & Longitude Subtle Grid */}
          <g stroke="hsl(var(--border) / 0.25)" strokeWidth="0.8" strokeDasharray="3 3">
            {/* Equator */}
            <line x1="0" y1="290" x2={MAP_W} y2="290" stroke="hsl(var(--primary) / 0.3)" strokeWidth="1" />
            {/* Tropics */}
            <line x1="0" y1="214" x2={MAP_W} y2="214" />
            <line x1="0" y1="366" x2={MAP_W} y2="366" />
            {/* Prime Meridian */}
            <line x1="600" y1="0" x2="600" y2={MAP_H} stroke="hsl(var(--primary) / 0.3)" strokeWidth="1" />
            {/* Meridians 90W and 90E */}
            <line x1="300" y1="0" x2="300" y2={MAP_H} />
            <line x1="900" y1="0" x2="900" y2={MAP_H} />
          </g>

          {/* Landmass Paths */}
          <g fill="hsl(var(--muted) / 0.45)" stroke="hsl(var(--border) / 0.5)" strokeWidth="0.6">
            {WORLD_COUNTRY_PATHS.map((c) => (
              <path key={c.id} d={c.d} className="pointer-events-none" />
            ))}
          </g>

          {/* Crosshairs & Current Pin */}
          {hasCoords && (
            <g>
              {/* Target crosshair guide lines */}
              <line
                x1={pinX}
                y1="0"
                x2={pinX}
                y2={MAP_H}
                stroke="hsl(var(--primary) / 0.4)"
                strokeWidth="0.8"
                strokeDasharray="2 2"
                className="pointer-events-none"
              />
              <line
                x1="0"
                y1={pinY}
                x2={MAP_W}
                y2={pinY}
                stroke="hsl(var(--primary) / 0.4)"
                strokeWidth="0.8"
                strokeDasharray="2 2"
                className="pointer-events-none"
              />

              {/* Pin marker group */}
              <g transform={`translate(${pinX}, ${pinY})`} className="pointer-events-none">
                {/* Concentric subtle radar pulse */}
                <circle cx="0" cy="0" r="26" fill="hsl(var(--primary) / 0.15)" stroke="hsl(var(--primary) / 0.3)" strokeWidth="1" />
                <circle cx="0" cy="0" r="18" fill="hsl(var(--primary) / 0.25)" />

                {/* Disc */}
                <circle
                  cx="0"
                  cy="0"
                  r="14"
                  fill="hsl(var(--card))"
                  stroke="hsl(var(--primary))"
                  strokeWidth="2"
                  filter="drop-shadow(0 2px 4px rgba(0,0,0,0.5))"
                />

                {/* Country Image or Default Icon */}
                {pinImage ? (
                  <g clipPath="url(#picker-pin-clip)">
                    <image
                      href={pinImage}
                      x="-14"
                      y="-14"
                      width="28"
                      height="28"
                      preserveAspectRatio="xMidYMid slice"
                    />
                  </g>
                ) : (
                  <text
                    x="0"
                    y="4"
                    textAnchor="middle"
                    fill="hsl(var(--primary))"
                    fontSize="9"
                    fontFamily="sans-serif"
                    fontWeight="bold"
                  >
                    {countryCode || "●"}
                  </text>
                )}

                {/* Pin stem / indicator dot */}
                <circle cx="0" cy="0" r="2.5" fill="hsl(var(--primary))" />
              </g>
            </g>
          )}

          {/* Hover guide when hovering without coords or moving around */}
          {hoverCoord && (
            <g transform={`translate(${hoverCoord.x}, ${hoverCoord.y})`} className="pointer-events-none opacity-60">
              <circle cx="0" cy="0" r="6" fill="none" stroke="hsl(var(--foreground))" strokeWidth="1" strokeDasharray="2 2" />
            </g>
          )}
        </svg>

        {/* Hover Coordinate Tag */}
        {hoverCoord && (
          <div className="absolute top-2 right-2 bg-background/85 backdrop-blur-sm border border-border/60 text-[10px] font-mono text-muted-foreground px-2 py-0.5 rounded shadow pointer-events-none">
            {hoverCoord.lat.toFixed(2)}°, {hoverCoord.lng.toFixed(2)}°
          </div>
        )}
      </div>

      {/* Coordinate & X/Y HUD Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs bg-muted/20 border border-border/40 rounded p-2">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span className="text-muted-foreground">Coords:</span>
            <span className="text-foreground font-medium">
              {hasCoords ? `${currentLat.toFixed(4)}°, ${currentLng.toFixed(4)}°` : "Not set (click map)"}
            </span>
          </div>
          <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
            <span>Projected:</span>
            <span className="text-primary font-medium">
              {hasCoords ? `X: ${Math.round(pinX)}px, Y: ${Math.round(pinY)}px` : "—"}
            </span>
            <span className="text-muted-foreground/60">(Canvas: 1200 × 580)</span>
          </div>
        </div>

        {/* Fine Nudge Controls */}
        {hasCoords && (
          <div className="flex items-center gap-1">
            <span className="text-[10px] uppercase font-sans text-muted-foreground mr-1">Nudge:</span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-6 w-6"
              onClick={() => nudge(1, 0)}
              title="Nudge North +1°"
            >
              <ArrowUp className="h-3 w-3" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-6 w-6"
              onClick={() => nudge(-1, 0)}
              title="Nudge South -1°"
            >
              <ArrowDown className="h-3 w-3" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-6 w-6"
              onClick={() => nudge(0, -1)}
              title="Nudge West -1°"
            >
              <ArrowLeft className="h-3 w-3" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-6 w-6"
              onClick={() => nudge(0, 1)}
              title="Nudge East +1°"
            >
              <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
