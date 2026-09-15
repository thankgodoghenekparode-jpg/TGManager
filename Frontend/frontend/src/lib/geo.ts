/** Haversine distance in meters between two lat/lng points. */
export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

export interface GeoPosition {
  latitude: number
  longitude: number
}

export type GeoStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'denied'
  | 'unavailable'
  | 'timeout'

/**
 * Resolves the current browser position (one-shot, high accuracy). Resolves
 * with null coordinates when the user denies or location is unavailable so the
 * caller can show a helpful message.
 */
export function getCurrentPosition(
  timeoutMs = 10000,
): Promise<{ position: GeoPosition | null; status: GeoStatus }> {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    return Promise.resolve({ position: null, status: 'unavailable' })
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          position: {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          },
          status: 'ready',
        }),
      (err) => {
        const status: GeoStatus =
          err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable'
        resolve({ position: null, status })
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 },
    )
  })
}
