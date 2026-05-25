import { useState, useEffect, useCallback, useRef } from 'react';

export interface GPSPosition {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
}

interface UseGPSTrackingOptions {
  enableHighAccuracy?: boolean;
  maximumAge?: number;
  timeout?: number;
  onPositionChange?: (position: GPSPosition) => void;
  saveInterval?: number; // How often to save to DB (ms)
}

export function useGPSTracking(options: UseGPSTrackingOptions = {}) {
  const {
    enableHighAccuracy = true,
    maximumAge = 0,
    timeout = 10000,
    onPositionChange,
    saveInterval = 5000
  } = options;

  const [position, setPosition] = useState<GPSPosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [route, setRoute] = useState<[number, number][]>([]);
  
  const watchIdRef = useRef<number | null>(null);
  const lastSaveTimeRef = useRef<number>(0);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    setIsTracking(true);
    setError(null);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const newPosition: GPSPosition = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp
        };

        setPosition(newPosition);
        setError(null);

        // Add to route if enough time has passed
        const now = Date.now();
        if (now - lastSaveTimeRef.current >= saveInterval) {
          setRoute(prev => [...prev, [newPosition.lng, newPosition.lat]]);
          lastSaveTimeRef.current = now;
          onPositionChange?.(newPosition);
        }
      },
      (err) => {
        let errorMessage = 'Unknown error occurred';
        switch (err.code) {
          case err.PERMISSION_DENIED:
            errorMessage = 'Location permission denied. Please enable location services.';
            break;
          case err.POSITION_UNAVAILABLE:
            errorMessage = 'Location information unavailable.';
            break;
          case err.TIMEOUT:
            errorMessage = 'Location request timed out.';
            break;
        }
        setError(errorMessage);
      },
      {
        enableHighAccuracy,
        maximumAge,
        timeout
      }
    );
  }, [enableHighAccuracy, maximumAge, timeout, saveInterval, onPositionChange]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTracking(false);
  }, []);

  const clearRoute = useCallback(() => {
    setRoute([]);
  }, []);

  const getCurrentPosition = useCallback((): Promise<GPSPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const gpsPos: GPSPosition = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            timestamp: pos.timestamp
          };
          resolve(gpsPos);
        },
        (err) => {
          reject(err);
        },
        {
          enableHighAccuracy,
          maximumAge,
          timeout
        }
      );
    });
  }, [enableHighAccuracy, maximumAge, timeout]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return {
    position,
    error,
    isTracking,
    route,
    startTracking,
    stopTracking,
    clearRoute,
    getCurrentPosition
  };
}
