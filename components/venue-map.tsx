"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { MapPinned } from "lucide-react";
import type { ArenaVenue } from "@/lib/types";

type VenuePoint = {
  venue: ArenaVenue;
  coordinates: [number, number];
};

const buenosAiresCoordinates: Array<[number, number]> = [
  [-58.4894, -34.6009],
  [-58.3772, -34.6412],
  [-58.4216, -34.6033],
  [-58.4502, -34.6157],
  [-58.4691, -34.5861],
  [-58.4075, -34.6238]
];

function venueCoordinate(index: number): [number, number] {
  return buenosAiresCoordinates[index % buenosAiresCoordinates.length];
}

function coordinatesForVenue(venue: ArenaVenue, index: number): [number, number] {
  if (typeof venue.longitude === "number" && typeof venue.latitude === "number") {
    return [venue.longitude, venue.latitude];
  }
  return venueCoordinate(index);
}

export function VenueMap({
  venues,
  selectedVenueId,
  onSelectVenue,
  userLocation
}: {
  venues: ArenaVenue[];
  selectedVenueId?: string;
  onSelectVenue: (venueId: string) => void;
  userLocation?: { latitude: number; longitude: number } | null;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<{ remove: () => void } | null>(null);
  const [mapUnavailable, setMapUnavailable] = useState(false);

  const points = useMemo<VenuePoint[]>(
    () => venues.map((venue, index) => ({ venue, coordinates: coordinatesForVenue(venue, index) })),
    [venues]
  );

  useEffect(() => {
    let cancelled = false;

    async function mountMap() {
      if (!containerRef.current || (!points.length && !userLocation)) return;
      try {
        const maplibregl = await import("maplibre-gl");
        if (cancelled || !containerRef.current) return;

        const selected = points.find((point) => point.venue.id === selectedVenueId) ?? points[0];
        const userCoordinates: [number, number] | null = userLocation ? [userLocation.longitude, userLocation.latitude] : null;
        const map = new maplibregl.Map({
          container: containerRef.current,
          style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
          center: selected?.coordinates ?? userCoordinates ?? [-58.3816, -34.6037],
          zoom: selected ? 11.6 : userCoordinates ? 12.2 : 10.8,
          dragPan: false,
          dragRotate: false,
          scrollZoom: false,
          touchZoomRotate: false,
          doubleClickZoom: false,
          keyboard: false,
          attributionControl: false
        });

        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
        if (userCoordinates) {
          const userMarker = document.createElement("span");
          userMarker.className = "venue-user-marker";
          userMarker.innerHTML = "<i></i>";
          new maplibregl.Marker({ element: userMarker, anchor: "center" })
            .setLngLat(userCoordinates)
            .setPopup(new maplibregl.Popup({ closeButton: false, offset: 16 }).setText("Tu ubicacion"))
            .addTo(map);
        }
        points.forEach((point) => {
          const markerNode = document.createElement("button");
          markerNode.type = "button";
          markerNode.className = point.venue.id === selectedVenueId ? "venue-map-marker is-active" : "venue-map-marker";
          markerNode.innerHTML = "<i></i>";
          markerNode.setAttribute("aria-label", point.venue.name);
          markerNode.addEventListener("click", () => onSelectVenue(point.venue.id));

          new maplibregl.Marker({ element: markerNode, anchor: "bottom" })
            .setLngLat(point.coordinates)
            .setPopup(new maplibregl.Popup({ closeButton: false, offset: 22 }).setText(point.venue.name))
            .addTo(map);
        });

        mapRef.current = map;
      } catch {
        if (!cancelled) setMapUnavailable(true);
      }
    }

    mountMap();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [onSelectVenue, points, selectedVenueId, userLocation]);

  return (
    <section className="venue-map-console">
      <div className="venue-map-head">
        <MapPinned size={18} />
        <div>
          <strong>Mapa de sedes</strong>
          <span>MapLibre / ubicacion por cancha</span>
        </div>
      </div>
      <div className="venue-map-canvas" ref={containerRef}>
        {mapUnavailable ? (
          <div className="venue-map-fallback">
            {userLocation ? <span className="venue-map-user-fallback" /> : null}
            {points.map((point, index) => (
              <button
                className={point.venue.id === selectedVenueId ? "is-active" : ""}
                key={point.venue.id}
                onClick={() => onSelectVenue(point.venue.id)}
                style={{ "--x": `${18 + (index % 3) * 30}%`, "--y": `${28 + Math.floor(index / 3) * 34}%` } as CSSProperties}
                type="button"
              >
                <i />
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
