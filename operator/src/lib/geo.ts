import { useCallback, useState } from 'react';

/** Distance in km between two [lat, lng] points. */
export function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const lat1 = (a[0] * Math.PI) / 180;
  const lat2 = (b[0] * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export type GeoStatus = 'idle' | 'locating' | 'ready' | 'denied' | 'unsupported';

export interface GeoState {
  status: GeoStatus;
  position: [number, number] | null;
}

/** Geolocation on demand — we never auto-prompt; the user taps to enable. */
export function useGeolocation() {
  const [state, setState] = useState<GeoState>({ status: 'idle', position: null });

  const request = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setState({ status: 'unsupported', position: null });
      return;
    }
    setState((s) => ({ ...s, status: 'locating' }));
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setState({
          status: 'ready',
          position: [pos.coords.latitude, pos.coords.longitude],
        }),
      () => setState({ status: 'denied', position: null }),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  }, []);

  return { ...state, request };
}
