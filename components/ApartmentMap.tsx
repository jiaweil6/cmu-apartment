"use client";

import { useEffect, useRef, useState } from "react";
import { loadHereMaps } from "@/lib/here-maps";
import type { Place } from "@/lib/types";

const MARKER_ICON = "https://cdn-icons-png.flaticon.com/128/684/684908.png";
const INITIAL_VIEW = { center: { lat: 40.4481986, lng: -79.9382407 }, zoom: 14.5 };

interface Props {
  apiKey: string | undefined;
  places: Place[];
}

function labelFor(place: Place): HTMLAnchorElement {
  const link = document.createElement("a");
  link.className = "map-label";
  link.href = place.website;
  link.textContent = place.shortName;
  return link;
}

export default function ApartmentMap({ apiKey, places }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!apiKey) return;
    let map: H.Map | undefined;
    let cancelled = false;
    const onResize = () => map?.getViewPort().resize();

    loadHereMaps()
      .then((H) => {
        if (cancelled || !containerRef.current) return;

        const platform = new H.service.Platform({ apikey: apiKey });
        const layers = platform.createDefaultLayers();
        map = new H.Map(containerRef.current, layers.vector.normal.map, {
          ...INITIAL_VIEW,
          pixelRatio: window.devicePixelRatio || 1,
        });
        new H.mapevents.Behavior(new H.mapevents.MapEvents(map)); // pan and zoom
        H.ui.UI.createDefault(map, layers);

        const icon = new H.map.Icon(MARKER_ICON, { size: { w: 24, h: 24 } });
        const markers = new H.map.Group();
        markers.addObjects(
          places.flatMap((place) => [
            new H.map.Marker(place.location, { icon }),
            new H.map.DomMarker(place.location, { icon: new H.map.DomIcon(labelFor(place)) }),
          ]),
        );
        map.addObject(markers);

        // Fit every pin in view, leaving room for the labels.
        const bounds = markers.getBoundingBox();
        if (bounds) {
          map.getViewPort().setPadding(40, 120, 70, 50);
          map.getViewModel().setLookAtData({ bounds });
        }
        window.addEventListener("resize", onResize);
      })
      .catch(() => {
        if (!cancelled) setError("The map couldn't be loaded. Check your connection and try again.");
      });

    return () => {
      cancelled = true;
      window.removeEventListener("resize", onResize);
      map?.dispose();
    };
  }, [apiKey, places]);

  if (!apiKey || error) {
    return (
      <div className="map-container map-notice">
        {error ?? "Map unavailable: set NEXT_PUBLIC_HERE_API_KEY to show the apartment map."}
      </div>
    );
  }

  return <div ref={containerRef} className="map-container" />;
}
