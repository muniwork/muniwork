const DEFAULT_STATIC_STYLE = 'mapbox/light-v11';

export function getMapboxStaticAccessToken() {
  return process.env.MAPBOX_STATIC_ACCESS_TOKEN || process.env.MAPBOX_ACCESS_TOKEN || null;
}

export function getMapboxStaticStyle() {
  return process.env.MAPBOX_STATIC_STYLE || DEFAULT_STATIC_STYLE;
}

export function getMapboxStaticZoomOverride() {
  const rawZoom = process.env.MAPBOX_STATIC_ZOOM_OVERRIDE?.trim();

  if (!rawZoom) {
    return null;
  }

  const zoom = Number(rawZoom);

  return Number.isFinite(zoom) ? zoom : null;
}
