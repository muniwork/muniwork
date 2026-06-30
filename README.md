# Muniwork

Public site and front end for Muniwork.

## Current Scope

- Astro + Netlify + Tailwind CSS + Basecoat Rhea
- Root-level organization profile pages only
- Shared template for municipalities and counties

## Runtime

- Node `22.13.0` or compatible. Volta uses the `package.json` pin automatically;
  run `nvm use` from the project root if you use nvm.

## UI conventions

- Use Tailwind CSS for layout, spacing, typography, and one-off adjustments.
- Prefer Basecoat components before building common UI from scratch.
- Use the Basecoat Rhea style bundle through `basecoat-css/rhea`.
- Reach for Basecoat `card`, `badge`, `alert`, `button`, `breadcrumb`,
  `input`, `table`, `tabs`, `accordion`, `field`, `select`, and `empty`
  patterns as the app grows.

## Required environment variables

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MAPBOX_STATIC_ACCESS_TOKEN` for static organization profile map covers
- `MAPBOX_GEOCODING_TOKEN` for the offline map-cover enrichment script

For local development, copy `.env.example` to `.env` and fill in the values from
Supabase before starting Astro. `SUPABASE_SERVICE_ROLE_KEY` is server-only; do
not expose it in browser code or prefix it with a public client variable name.

## Map cover enrichment

Organization profile pages render a thin Mapbox Static Images cover only when
stored `cover_lat` and `cover_lng` coordinates exist. When coordinates are
absent, the page renders a neutral background instead of a broken or arbitrary
map.

Coordinates are populated outside page rendering:

```bash
npm run enrich:map-covers
npm run enrich:map-covers -- --organization boca-raton-fl
npm run enrich:map-covers -- --limit 25
npm run enrich:map-covers -- --write
```

Dry-run mode is the default. `--write` stores coordinates after a conservative
server-side Mapbox geocoding match. The script uses existing Muniwork data only:
municipalities use Census `CITY` plus `STATE`, counties use the organization
county name plus state, and other organization types require a full Census
address. Rows with existing `cover_lat`, `cover_lng`, `cover_zoom`, or
`cover_location_label` are skipped so manual values are preserved.
