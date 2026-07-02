const DEFAULT_STATIC_STYLE = 'mapbox/light-v11';
const MAPBOX_STYLE_URL_PREFIX = 'mapbox://styles/';

function getEnv(name) {
  return process.env[name] || import.meta.env?.[name] || null;
}

export function getMapboxStaticAccessToken() {
  return getEnv('MAPBOX_STATIC_ACCESS_TOKEN') || getEnv('MAPBOX_ACCESS_TOKEN');
}

export function getMapboxStaticStyle() {
  const style = getEnv('MAPBOX_STATIC_STYLE') || DEFAULT_STATIC_STYLE;

  return style.startsWith(MAPBOX_STYLE_URL_PREFIX)
    ? style.slice(MAPBOX_STYLE_URL_PREFIX.length)
    : style;
}
