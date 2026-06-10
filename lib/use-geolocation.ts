'use client';

import { useCallback, useState } from 'react';

export type GeolocationStatus =
  | 'idle'
  | 'pending'
  | 'granted'
  | 'denied'
  | 'unavailable';

export interface GeolocationState {
  position: { lat: number; lng: number } | null;
  status: GeolocationStatus;
  error: string | null;
}

/** Browser geolocation hook. Does NOT auto-request — the caller fires
 *  `request()` when the user opts in (e.g. clicking 'Nearest first'), so we
 *  don't trigger a permission prompt on page load. */
export function useGeolocation(): GeolocationState & { request: () => void } {
  const [state, setState] = useState<GeolocationState>({
    position: null,
    status: 'idle',
    error: null,
  });

  const request = useCallback(() => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      setState({ position: null, status: 'unavailable', error: 'Geolocation not supported' });
      return;
    }
    setState((s) => ({ ...s, status: 'pending', error: null }));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setState({
          position: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          status: 'granted',
          error: null,
        });
      },
      (err) => {
        setState({
          position: null,
          status: err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable',
          error: err.message,
        });
      },
      {
        enableHighAccuracy: false,
        timeout: 10_000,
        maximumAge: 60_000,
      }
    );
  }, []);

  return { ...state, request };
}
