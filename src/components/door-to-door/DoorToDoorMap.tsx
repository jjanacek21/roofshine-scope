import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { DoorKnock, DoorDisposition } from '@/hooks/useDoorToDoorSession';
import type { PropertyData, PropertyDisposition } from '@/hooks/usePropertyDispositions';
import { getDispositionColor, isDispositionFilled } from './DispositionQuickBar';

interface DoorToDoorMapProps {
  position: { lat: number; lng: number } | null;
  route: [number, number][];
  doorKnocks: DoorKnock[];
  properties: PropertyData[];
  onMapClick?: (lat: number, lng: number) => void;
  onPropertyClick?: (property: { lat: number; lng: number; address?: string; existingData?: PropertyData }) => void;
  isSessionActive: boolean;
  onBoundsChange?: (bounds: { north: number; south: number; east: number; west: number }) => void;
  focusLat?: number;
  focusLng?: number;
}

import { useMapboxToken } from "@/hooks/useMapboxToken";

// Use the shared color function from DispositionQuickBar

export function DoorToDoorMap({
  position,
  route,
  doorKnocks,
  properties,
  onMapClick,
  onPropertyClick,
  isSessionActive,
  onBoundsChange,
  focusLat,
  focusLng,
}: DoorToDoorMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const userMarker = useRef<mapboxgl.Marker | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const { data: MAPBOX_TOKEN } = useMapboxToken();

  // Generate property markers GeoJSON
  const getPropertyGeoJSON = useCallback(() => {
    const features = properties.map(p => ({
      type: 'Feature' as const,
      properties: {
        latLngHash: p.latLngHash,
        disposition: p.disposition,
        address: p.address || '',
        isFilled: isDispositionFilled(p.disposition),
        color: getDispositionColor(p.disposition),
      },
      geometry: {
        type: 'Point' as const,
        coordinates: [p.lng, p.lat],
      },
    }));

    return {
      type: 'FeatureCollection' as const,
      features,
    };
  }, [properties]);

  // Notify parent of bounds change
  const emitBoundsChange = useCallback(() => {
    if (!map.current || !onBoundsChange) return;
    
    const bounds = map.current.getBounds();
    if (!bounds) return;
    onBoundsChange({
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest(),
    });
  }, [onBoundsChange]);

  const refreshBuildingPinsRef = useRef<() => void>(() => {});
  const refreshBuildingPins = useCallback(() => {
    if (!map.current) return;
    const m = map.current;
    if (m.getZoom() < 16) {
      const src = m.getSource('building-pins') as mapboxgl.GeoJSONSource | undefined;
      src?.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    let feats: mapboxgl.MapboxGeoJSONFeature[] = [];
    try {
      feats = m.querySourceFeatures('composite', { sourceLayer: 'building' });
    } catch {
      return;
    }

    const savedHashes = new Set(properties.map(p => p.latLngHash));
    const seen = new Set<string>();
    const features: GeoJSON.Feature[] = [];

    for (const f of feats) {
      const geom = f.geometry as GeoJSON.Geometry;
      let ring: number[][] | null = null;
      if (geom.type === 'Polygon') ring = geom.coordinates[0];
      else if (geom.type === 'MultiPolygon') ring = geom.coordinates[0]?.[0] ?? null;
      if (!ring || ring.length < 3) continue;

      let sx = 0, sy = 0, n = 0;
      for (const c of ring) { sx += c[0]; sy += c[1]; n++; }
      const lng = sx / n;
      const lat = sy / n;

      const key = `${Math.round(lat * 10000) / 10000}_${Math.round(lng * 10000) / 10000}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const savedKey = `${Math.round(lat * 100000) / 100000}_${Math.round(lng * 100000) / 100000}`;
      if (savedHashes.has(savedKey)) continue;

      features.push({
        type: 'Feature',
        properties: {},
        geometry: { type: 'Point', coordinates: [lng, lat] },
      });
    }

    const src = m.getSource('building-pins') as mapboxgl.GeoJSONSource | undefined;
    src?.setData({ type: 'FeatureCollection', features });
  }, [properties]);

  useEffect(() => {
    refreshBuildingPinsRef.current = refreshBuildingPins;
  }, [refreshBuildingPins]);


  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !MAPBOX_TOKEN) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: focusLat != null && focusLng != null
        ? [focusLng, focusLat]
        : position ? [position.lng, position.lat] : [-80.1918, 25.7617],
      zoom: 18,
      pitch: 0,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    map.current.addControl(
      new mapboxgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
        showUserHeading: true,
      }),
      'top-right'
    );

    map.current.on('load', () => {
      setMapLoaded(true);

      // Add route source
      map.current?.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: route
          }
        }
      });

      // Add route layer
      map.current?.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#3b82f6',
          'line-width': 4,
          'line-opacity': 0.8
        }
      });

      // Add property markers source
      map.current?.addSource('properties', {
        type: 'geojson',
        data: getPropertyGeoJSON()
      });

      // Add building-detected pins source (one dot per building footprint)
      map.current?.addSource('building-pins', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });

      // Building-detected pins (drawn below saved-disposition pins)
      map.current?.addLayer({
        id: 'building-pins-layer',
        type: 'circle',
        source: 'building-pins',
        paint: {
          'circle-radius': 10,
          'circle-color': 'transparent',
          'circle-stroke-width': 2.5,
          'circle-stroke-color': '#f59e0b',
          'circle-opacity': 0.95,
        }
      });

      // Add property circles layer - filled circles
      map.current?.addLayer({
        id: 'property-circles-filled',
        type: 'circle',
        source: 'properties',
        filter: ['==', ['get', 'isFilled'], true],
        paint: {
          'circle-radius': 12,
          'circle-color': ['get', 'color'],
          'circle-stroke-width': 3,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.9,
        }
      });

      // Add property circles layer - empty circles (not contacted)
      map.current?.addLayer({
        id: 'property-circles-empty',
        type: 'circle',
        source: 'properties',
        filter: ['==', ['get', 'isFilled'], false],
        paint: {
          'circle-radius': 12,
          'circle-color': 'transparent',
          'circle-stroke-width': 3,
          'circle-stroke-color': '#f59e0b',
          'circle-opacity': 1,
        }
      });

      // Click + cursor handlers for building-detected pins
      map.current?.on('click', 'building-pins-layer', (e) => {
        if (!e.features?.[0]) return;
        e.originalEvent.stopPropagation();
        const coords = (e.features[0].geometry as GeoJSON.Point).coordinates;
        onPropertyClick?.({
          lat: coords[1],
          lng: coords[0],
          address: undefined,
          existingData: undefined,
        });
      });
      map.current?.on('mouseenter', 'building-pins-layer', () => {
        if (map.current) map.current.getCanvas().style.cursor = 'pointer';
      });
      map.current?.on('mouseleave', 'building-pins-layer', () => {
        if (map.current) map.current.getCanvas().style.cursor = '';
      });

      map.current?.once('idle', () => refreshBuildingPinsRef.current());
      emitBoundsChange();
    });

    map.current.on('moveend', () => {
      emitBoundsChange();
      refreshBuildingPinsRef.current();
    });

    // Handle clicks on property circles
    map.current.on('click', 'property-circles-filled', (e) => {
      if (!e.features?.[0]) return;
      e.originalEvent.stopPropagation();
      
      const feature = e.features[0];
      const coords = (feature.geometry as GeoJSON.Point).coordinates;
      const props = feature.properties;
      
      const existingProperty = properties.find(p => p.latLngHash === props?.latLngHash);
      
      onPropertyClick?.({
        lat: coords[1],
        lng: coords[0],
        address: props?.address,
        existingData: existingProperty,
      });
    });

    map.current.on('click', 'property-circles-empty', (e) => {
      if (!e.features?.[0]) return;
      e.originalEvent.stopPropagation();
      
      const feature = e.features[0];
      const coords = (feature.geometry as GeoJSON.Point).coordinates;
      const props = feature.properties;
      
      const existingProperty = properties.find(p => p.latLngHash === props?.latLngHash);
      
      onPropertyClick?.({
        lat: coords[1],
        lng: coords[0],
        address: props?.address,
        existingData: existingProperty,
      });
    });

    // Change cursor on hover
    map.current.on('mouseenter', 'property-circles-filled', () => {
      if (map.current) map.current.getCanvas().style.cursor = 'pointer';
    });
    map.current.on('mouseleave', 'property-circles-filled', () => {
      if (map.current) map.current.getCanvas().style.cursor = '';
    });
    map.current.on('mouseenter', 'property-circles-empty', () => {
      if (map.current) map.current.getCanvas().style.cursor = 'pointer';
    });
    map.current.on('mouseleave', 'property-circles-empty', () => {
      if (map.current) map.current.getCanvas().style.cursor = '';
    });

    // Handle general map clicks (for adding new properties)
    map.current.on('click', (e) => {
      // Check if click was on a property circle
      const features = map.current?.queryRenderedFeatures(e.point, {
        layers: ['property-circles-filled', 'property-circles-empty', 'building-pins-layer']
      });
      
      if (features && features.length > 0) return; // Click was on a circle
      
      if (isSessionActive && onMapClick) {
        onMapClick(e.lngLat.lat, e.lngLat.lng);
      }
    });

    return () => {
      map.current?.remove();
    };
  }, [MAPBOX_TOKEN]);

  // Update user position marker
  useEffect(() => {
    if (!map.current || !position) return;

    if (!userMarker.current) {
      const el = document.createElement('div');
      el.className = 'user-location-marker';
      el.innerHTML = `
        <div class="relative">
          <div class="w-6 h-6 bg-blue-500 rounded-full border-3 border-white shadow-lg pulse-ring"></div>
          <div class="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-30"></div>
        </div>
      `;

      userMarker.current = new mapboxgl.Marker({ element: el })
        .setLngLat([position.lng, position.lat])
        .addTo(map.current);
    } else {
      userMarker.current.setLngLat([position.lng, position.lat]);
    }

    map.current.easeTo({
      center: [position.lng, position.lat],
      duration: 500
    });
  }, [position]);

  // Fly to focused property when deep-linked from Dispositions list
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    if (focusLat == null || focusLng == null) return;
    map.current.flyTo({
      center: [focusLng, focusLat],
      zoom: 19,
      duration: 1200,
      essential: true,
    });
  }, [focusLat, focusLng, mapLoaded]);

  // Update route line
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const source = map.current.getSource('route') as mapboxgl.GeoJSONSource;
    if (source) {
      source.setData({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: route
        }
      });
    }
  }, [route, mapLoaded]);

  // Update property markers
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const source = map.current.getSource('properties') as mapboxgl.GeoJSONSource;
    if (source) {
      source.setData(getPropertyGeoJSON());
    }
    // Re-derive detected building pins so saved properties hide their duplicates
    refreshBuildingPins();
  }, [properties, mapLoaded, getPropertyGeoJSON, refreshBuildingPins]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />
      
      {!mapLoaded && (
        <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-muted-foreground">Loading map...</span>
          </div>
        </div>
      )}

      <style>{`
        .user-location-marker {
          cursor: pointer;
        }
        .pulse-ring {
          animation: pulse-ring 2s cubic-bezier(0.455, 0.03, 0.515, 0.955) infinite;
        }
        @keyframes pulse-ring {
          0% {
            box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7);
          }
          70% {
            box-shadow: 0 0 0 10px rgba(59, 130, 246, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(59, 130, 246, 0);
          }
        }
      `}</style>
    </div>
  );
}
