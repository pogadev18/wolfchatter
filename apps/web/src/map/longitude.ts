/**
 * Brings a longitude from any copy of the world into -180…180, the range the API accepts. Leaflet
 * reports longitudes such as 723.71 after the map has been panned around the world twice.
 */
export function wrapLongitude(lng: number): number {
  if (lng >= -180 && lng <= 180) return lng
  return ((((lng + 180) % 360) + 360) % 360) - 180
}

/** The copy of `lng` nearest the map's centre, so a pin shows in the copy of the world in view. */
export function nearestWorldCopy(lng: number, centerLng: number): number {
  return lng + 360 * Math.round((centerLng - lng) / 360)
}
