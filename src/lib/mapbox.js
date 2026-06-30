export function getMapboxStaticAccessToken() {
  return process.env.MAPBOX_STATIC_ACCESS_TOKEN || process.env.MAPBOX_ACCESS_TOKEN || null;
}
